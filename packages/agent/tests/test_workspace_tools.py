"""
Unit Tests for Quantitative Workspace File & Code Editing Tools Plugin.
Verifies file creation, line inspection, full & partial edits, search,
sandbox execution, deletion, and harness tool registration.
"""

import pytest
import asyncio
from packages.agent.src.tools.workspace import (
    create_file,
    create_folder,
    read_file,
    edit_file,
    edit_file_partially,
    delete_file,
    list_workspace_files,
    search_in_files,
    register_workspace_tools,
    save_strategy_version,
    list_strategy_versions,
    _resolve_file_path,
)


class DummyHarness:
    def __init__(self):
        self.tools = {}

    def register_tool(self, name, description, parameters, handler, **kwargs):
        self.tools[name] = {"description": description, "parameters": parameters, "handler": handler}


TEST_USER = "test_agent_user"
TEST_FILE = "test_alpha_strategy.py"


@pytest.mark.asyncio
async def test_create_and_read_file():
    """Verifies file creation and line-level reading."""
    code = (
        "# Strategy File\n"
        "import polars as pl\n"
        "\n"
        "class MomentumAlpha:\n"
        "    def __init__(self, period: int = 14):\n"
        "        self.period = period\n"
    )
    # Clean up before
    await delete_file(TEST_FILE, username=TEST_USER)

    # 1. Create file
    create_res = await create_file(TEST_FILE, code, username=TEST_USER)
    assert create_res["success"] is True
    assert create_res["filename"] == TEST_FILE

    # 2. Read full file
    read_full = await read_file(TEST_FILE, username=TEST_USER)
    assert read_full["success"] is True
    assert "class MomentumAlpha" in read_full["content"]
    assert read_full["total_lines"] >= 6

    # 3. Read sliced lines (L4 to L6)
    read_slice = await read_file(TEST_FILE, start_line=4, end_line=6, username=TEST_USER)
    assert read_slice["success"] is True
    assert "4 | class MomentumAlpha:" in read_slice["content"]
    assert "6 |         self.period = period" in read_slice["content"]


@pytest.mark.asyncio
async def test_edit_file_full():
    """Verifies full file replacement."""
    new_code = (
        "# Updated Alpha\n"
        "import polars as pl\n"
        "class FastEMA:\n"
        "    pass\n"
    )
    edit_res = await edit_file(TEST_FILE, new_code, username=TEST_USER)
    assert edit_res["success"] is True
    assert edit_res["lines_count"] == 4
    assert "lines_added" in edit_res
    assert "lines_removed" in edit_res
    assert edit_res["lines_added"] > 0

    read_res = await read_file(TEST_FILE, username=TEST_USER)
    assert "class FastEMA:" in read_res["content"]


@pytest.mark.asyncio
async def test_edit_file_partially():
    """Verifies precision surgical find-and-replace."""
    target = "class FastEMA:\n    pass"
    replacement = "class FastEMA:\n    def on_tick(self):\n        return True"

    partial_res = await edit_file_partially(
        TEST_FILE,
        target_content=target,
        replacement_content=replacement,
        username=TEST_USER,
    )
    assert partial_res["success"] is True
    assert "diff" in partial_res
    assert partial_res["lines_added"] == 2
    assert partial_res["lines_removed"] == 1

    read_res = await read_file(TEST_FILE, username=TEST_USER)
    assert "def on_tick(self):" in read_res["content"]
    assert "return True" in read_res["content"]


@pytest.mark.asyncio
async def test_edit_file_partially_not_found():
    """Verifies error reporting when target snippet does not exist."""
    res = await edit_file_partially(
        TEST_FILE,
        target_content="non_existent_function_abc()",
        replacement_content="something_else()",
        username=TEST_USER,
    )
    assert res["success"] is False
    assert "not found" in res["error"].lower()


@pytest.mark.asyncio
async def test_list_and_search_files():
    """Verifies listing files and keyword searching."""
    list_res = await list_workspace_files(username=TEST_USER)
    assert list_res["success"] is True
    file_names = [f["name"] for f in list_res["files"]]
    assert TEST_FILE in file_names

    # Search in files
    search_res = await search_in_files("FastEMA", username=TEST_USER)
    assert search_res["success"] is True
    assert search_res["matches_count"] >= 1
    match_files = [m["filename"] for m in search_res["matches"]]
    assert TEST_FILE in match_files




@pytest.mark.asyncio
async def test_delete_file():
    """Verifies clean deletion of workspace file."""
    del_res = await delete_file(TEST_FILE, username=TEST_USER)
    assert del_res["success"] is True

    # Confirm gone
    read_res = await read_file(TEST_FILE, username=TEST_USER)
    assert read_res["success"] is False


def test_register_workspace_tools():
    """Verifies all 11 tools are correctly registered into the harness."""
    harness = DummyHarness()
    register_workspace_tools(harness, user_id=TEST_USER)

    expected_tools = [
        "list_workspace_files",
        "read_file",
        "create_file",
        "create_folder",
        "edit_file",
        "edit_file_partially",
        "delete_file",
        "search_in_files",
        "save_strategy_version",
        "list_strategy_versions",
    ]
    for t in expected_tools:
        assert t in harness.tools, f"Missing tool registration for {t}"


@pytest.mark.asyncio
async def test_strategy_folder_and_version_bumping():
    """Verifies dedicated folder creation, version bumping (_v1 -> _v2), and path resolution."""
    user = "trader_version_test"
    strat_name = "ict_gold_scalper"
    v1_code = "# Version 1 of ICT Gold Scalper\nclass ICTGoldScalper:\n    pass\n"
    v2_code = "# Version 2 of ICT Gold Scalper\nclass ICTGoldScalperV2:\n    pass\n"

    # Clean up test strategy folder and DB before test
    import shutil
    from packages.agent.src.tools.workspace import _get_user_dir
    from apps.api.src.db.repository import DatabaseRepository
    repo = DatabaseRepository()
    db_existing = repo.get_strategy_by_name(strat_name, user_id=user)
    if db_existing:
        repo.delete_strategy(db_existing["id"])

    user_dir = _get_user_dir(user)
    strat_dir = user_dir / strat_name
    if strat_dir.exists():
        shutil.rmtree(strat_dir)
    for f in user_dir.glob(f"{strat_name}*"):
        try:
            f.unlink()
        except Exception:
            pass

    # 1. Reject invalid strategy names
    invalid_res = await save_strategy_version(
        strategy_name="invalid",
        code=v1_code,
        username=user,
    )
    assert invalid_res["success"] is False
    assert "strictly 2 or 3 words" in invalid_res["error"]

    # 2. Save initial version (_v1)
    res_v1 = await save_strategy_version(
        strategy_name=strat_name,
        code=v1_code,
        username=user,
        bump_version=False,
    )
    assert res_v1["success"] is True
    assert res_v1["strategy_name"] == strat_name
    assert res_v1["version"] == 1
    assert res_v1["filename"] == "ict_gold_scalper_v1.py"
    assert "ict_gold_scalper" in res_v1["folder"]

    # 3. List versions after v1
    list_1 = await list_strategy_versions(strat_name, username=user)
    assert list_1["success"] is True
    assert list_1["latest_version"] == 1
    assert len(list_1["versions"]) == 1
    assert list_1["versions"][0]["version"] == 1

    # 4. Bump version to _v2
    res_v2 = await save_strategy_version(
        strategy_name=strat_name,
        code=v2_code,
        username=user,
        bump_version=True,
    )
    assert res_v2["success"] is True
    assert res_v2["version"] == 2
    assert res_v2["filename"] == "ict_gold_scalper_v2.py"

    # 5. List versions after v2
    list_2 = await list_strategy_versions(strat_name, username=user)
    assert list_2["success"] is True
    assert list_2["latest_version"] == 2
    assert len(list_2["versions"]) == 2
    assert list_2["next_version"] == 3

    # 6. Verify file resolution finds the nested file inside strategy folder
    resolved_path = _resolve_file_path("ict_gold_scalper_v2.py", username=user)
    assert resolved_path.exists()
    assert resolved_path.name == "ict_gold_scalper_v2.py"

    # 7. Read file via standard read_file tool using filename
    read_v2 = await read_file("ict_gold_scalper_v2.py", username=user)
    assert read_v2["success"] is True
    assert "ICTGoldScalperV2" in read_v2["content"]

    # 8. Verify root unversioned working file exists and is kept in sync
    read_base = await read_file("ict_gold_scalper.py", username=user)
    assert read_base["success"] is True
    assert "ICTGoldScalperV2" in read_base["content"]


@pytest.mark.asyncio
async def test_version_stability_prevents_accidental_jumping():
    """
    CRITICAL REGRESSION TEST:
    Ensures that multiple code edits, syntax fixes, comments, and partial edits
    do NOT bump the strategy version prematurely (e.g. jumping from v2 to v8).
    Version bump must ONLY happen on explicit bump_version=True or header increment.
    """
    user = "trader_stability_test"
    strat_name = "fvg_trend_rider"
    file_name = f"{strat_name}.mq5"

    import shutil
    from packages.agent.src.tools.workspace import _get_user_dir
    from apps.api.src.db.repository import DatabaseRepository
    repo = DatabaseRepository()
    db_existing = repo.get_strategy_by_name(strat_name, user_id=user)
    if db_existing:
        repo.delete_strategy(db_existing["id"])

    user_dir = _get_user_dir(user)
    strat_dir = user_dir / strat_name
    if strat_dir.exists():
        shutil.rmtree(strat_dir)
    for f in user_dir.glob(f"{strat_name}*"):
        try:
            f.unlink()
        except Exception:
            pass

    # 1. Create file initial code with MQL5 header
    initial_code = (
        '//+------------------------------------------------------------------+\n'
        '//|                                               fvg_trend_rider.mq5 |\n'
        '//+------------------------------------------------------------------+\n'
        '#property copyright "BacktestAI"\n'
        '#property version   "1.00"\n'
        'input double InpLotSize = 0.01;\n'
        'void OnTick() {}\n'
    )
    c_res = await create_file(file_name, content=initial_code, username=user)
    assert c_res["success"] is True

    # 2. Perform 5 sequential edits on the file (simulating self-healing / bug fixes)
    for i in range(1, 6):
        edit_code = (
            f'//+------------------------------------------------------------------+\n'
            f'//|                                               fvg_trend_rider.mq5 |\n'
            f'//| Edit revision {i}                                                 |\n'
            f'//+------------------------------------------------------------------+\n'
            f'#property copyright "BacktestAI"\n'
            f'#property version   "1.00"\n'
            f'input double InpLotSize = {0.01 * i:.2f};\n'
            f'void OnTick() {{ /* iteration {i} */ }}\n'
        )
        res_edit = await edit_file(file_name, content=edit_code, username=user)
        assert res_edit["success"] is True
        # Version MUST remain 1 throughout all 5 edits!
        assert res_edit["version"] == 1, f"Edit {i} caused accidental version bump to {res_edit['version']}!"

    # 3. Perform a partial edit
    res_partial = await edit_file_partially(
        file_name,
        target_content='void OnTick() { /* iteration 5 */ }',
        replacement_content='void OnTick() { Print("Tick processed"); }',
        username=user,
    )
    assert res_partial["success"] is True
    # Version MUST STILL be 1!
    assert res_partial["version"] == 1

    # 4. Check version list from filesystem and DB
    v_list = await list_strategy_versions(strat_name, username=user)
    assert v_list["success"] is True
    assert v_list["latest_version"] == 1
    assert len(v_list["versions"]) <= 1

    # 5. Now explicitly bump version to v2
    bump_code = (
        '//+------------------------------------------------------------------+\n'
        '//|                                               fvg_trend_rider.mq5 |\n'
        '//+------------------------------------------------------------------+\n'
        '#property copyright "BacktestAI"\n'
        '#property version   "2.00"\n'
        'input double InpLotSize = 0.05;\n'
        'void OnTick() {}\n'
    )
    res_bump = await save_strategy_version(
        strategy_name=strat_name,
        code=bump_code,
        username=user,
        bump_version=True,
    )
    assert res_bump["success"] is True
    assert res_bump["version"] == 2

    # 6. Perform another 3 edits on version 2 without bumping
    for j in range(1, 4):
        edit_v2_code = (
            f'//+------------------------------------------------------------------+\n'
            f'//|                                               fvg_trend_rider.mq5 |\n'
            f'//| Version 2 bugfix {j}                                              |\n'
            f'//+------------------------------------------------------------------+\n'
            f'#property copyright "BacktestAI"\n'
            f'#property version   "2.00"\n'
            f'input double InpLotSize = 0.05;\n'
            f'void OnTick() {{ /* v2 edit {j} */ }}\n'
        )
        res_v2_edit = await edit_file(file_name, content=edit_v2_code, username=user)
        assert res_v2_edit["success"] is True
        # Version MUST remain 2!
        assert res_v2_edit["version"] == 2, f"V2 Edit {j} caused accidental version bump!"

    # 7. Final check: exactly 2 versions exist
    final_v_list = await list_strategy_versions(strat_name, username=user)
    assert final_v_list["success"] is True
    assert final_v_list["latest_version"] == 2
    assert len(final_v_list["versions"]) == 2


@pytest.mark.asyncio
async def test_create_folder_lifecycle():
    """Verifies physical directory creation and traversal safety."""
    user = "trader_folder_test"

    # Clean up test directory before test
    import shutil
    from packages.agent.src.tools.workspace import _get_user_dir
    user_dir = _get_user_dir(user)
    if user_dir.exists():
        shutil.rmtree(user_dir)

    # 1. Create a top-level folder
    res1 = await create_folder("ict_gold_scalper", username=user)
    assert res1["success"] is True
    assert res1["folder_name"] == "ict_gold_scalper"
    assert res1["created"] is True
    import os
    assert os.path.isdir(res1["path"])

    # 2. Call again on existing folder (idempotent, created=False)
    res2 = await create_folder("ict_gold_scalper", username=user)
    assert res2["success"] is True
    assert res2["created"] is False

    # 3. Create nested subfolder
    res3 = await create_folder("models/scalpers", username=user)
    assert res3["success"] is True
    assert os.path.isdir(res3["path"])

    # 4. Reject unsafe directory traversal
    res_unsafe = await create_folder("../../unsafe", username=user)
    assert res_unsafe["success"] is False
    assert "Invalid folder component" in res_unsafe["error"]


@pytest.mark.asyncio
async def test_create_file_rejects_versioned_names():
    """Verifies that create_file strictly forbids creating _v2, _v3 versioned files in workspace."""
    res_v2 = await create_file("gold_scalper_v2.mq5", username="test_user")
    assert res_v2["success"] is False
    assert "REJECTED" in res_v2["error"]
    assert "gold_scalper.mq5" in res_v2["error"]

    res_v3 = await create_file("eurusd_trend_v3.py", username="test_user")
    assert res_v3["success"] is False
    assert "REJECTED" in res_v3["error"]
