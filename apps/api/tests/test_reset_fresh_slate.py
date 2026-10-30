import pytest
from pathlib import Path
from scripts.clean_data import (
    clean_database_tables,
    clean_user_strategies as clean_user_code_and_files,
    clean_uploads,
    clean_mt5_artifacts as clean_mt5_generated_binaries_and_reports,
)

def test_dry_run_does_not_crash():
    stats = clean_database_tables(dry_run=True)
    assert isinstance(stats, dict)
    assert "strategies" in stats
    assert "agent_messages" in stats

    user_files = clean_user_code_and_files(dry_run=True)
    assert user_files >= 0

    uploads = clean_uploads(dry_run=True)
    assert uploads >= 0

    binaries = clean_mt5_generated_binaries_and_reports(dry_run=True)
    assert binaries >= 0
