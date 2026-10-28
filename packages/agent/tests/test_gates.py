"""
Unit tests for Sensitive Action Approval Gates (T3.3.2).
Verifies the 5-stage lifecycle:
PLAN ➔ PREVIEW/VALIDATE ➔ APPROVE ➔ EXECUTE ➔ VERIFY.
"""

import pytest
from packages.agent.src.sandbox.gates import (
    ApprovalGateManager,
    RiskTier,
    ActionStatus,
    ActionPlan,
    ActionPreview,
    AuditRecord,
)


@pytest.mark.asyncio
async def test_gate_full_lifecycle_success():
    """Verifies complete 5-stage lifecycle for an approved sensitive action."""
    manager = ApprovalGateManager()

    # Stage 1: PLAN
    plan = manager.plan(
        action_type="matrix_sweep",
        payload={
            "strategy_id": "strat_alpha_01",
            "param_grid": {"fast_period": [5, 10, 15], "slow_period": [20, 30]},
        },
        rationale="Optimize fast and slow periods on BTCUSDT 1h timeframe.",
        risk_tier=RiskTier.HIGH,
        session_id="sess_quant_100",
    )
    assert plan.status == ActionStatus.PLANNED
    assert plan.risk_tier == RiskTier.HIGH
    assert len(plan.payload_checksum) == 64  # SHA-256

    # Stage 2: PREVIEW / VALIDATE
    preview = manager.preview(plan.action_id)
    assert preview.action_id == plan.action_id
    assert preview.is_valid is True
    assert preview.requires_human_approval is True
    assert preview.estimated_compute_units == 6  # 3 * 2 combinations
    assert "strat_alpha_01" in preview.summary
    assert plan.status == ActionStatus.AWAITING_APPROVAL

    # Stage 3: APPROVE
    approved_plan = manager.approve(
        action_id=plan.action_id,
        approver_id="trader_usr_99",
        approval_token="sig_grant_valid",
    )
    assert approved_plan.status == ActionStatus.APPROVED

    # Stage 4: EXECUTE
    async def mock_matrix_runner(strategy_id: str, param_grid: dict):
        return {
            "strategy_id": strategy_id,
            "total_runs": 6,
            "top_sharpe": 2.15,
            "best_params": {"fast_period": 10, "slow_period": 20},
        }

    exec_result = await manager.execute(
        action_id=plan.action_id,
        handler=mock_matrix_runner,
        **plan.payload,
    )
    assert exec_result["total_runs"] == 6
    assert exec_result["top_sharpe"] == 2.15
    assert plan.status == ActionStatus.EXECUTED

    # Stage 5: VERIFY
    audit = manager.verify(
        action_id=plan.action_id,
        verifier=lambda res: res["total_runs"] == 6 and res["top_sharpe"] > 2.0,
        approver_id="trader_usr_99",
    )
    assert audit.execution_success is True
    assert audit.verification_passed is True
    assert audit.action_type == "matrix_sweep"
    assert len(audit.tamper_checksum) == 64
    assert plan.status == ActionStatus.VERIFIED

    # Check audit trail queries
    trail = manager.get_audit_trail(session_id="sess_quant_100")
    assert len(trail) == 1
    assert trail[0].action_id == plan.action_id


@pytest.mark.asyncio
async def test_gate_reject_prevents_execution():
    """Verifies that rejecting an action prevents execution."""
    manager = ApprovalGateManager()

    plan = manager.plan(
        action_type="delete_strategy",
        payload={"strategy_id": "strat_deprecated_02"},
        rationale="Purge old decommissioned strategy.",
    )
    manager.preview(plan.action_id)
    assert plan.status == ActionStatus.AWAITING_APPROVAL

    manager.reject(
        action_id=plan.action_id,
        approver_id="risk_officer",
        reason="Strategy is still referenced in archived reports.",
    )
    assert plan.status == ActionStatus.REJECTED

    # Attempting to execute must fail
    async def mock_delete():
        return True

    with pytest.raises(PermissionError) as exc_info:
        await manager.execute(plan.action_id, mock_delete)
    assert "not approved" in str(exc_info.value)


@pytest.mark.asyncio
async def test_gate_detects_payload_tampering():
    """Verifies TOCTOU defense: altering payload after plan approval raises security error."""
    manager = ApprovalGateManager()

    plan = manager.plan(
        action_type="edit_strategy",
        payload={"strategy_id": "strat_safe", "code": "def on_bar(): pass"},
        rationale="Safe parameter update.",
        risk_tier=RiskTier.MEDIUM,
    )
    manager.preview(plan.action_id)
    manager.approve(plan.action_id, approver_id="user_admin")
    assert plan.status == ActionStatus.APPROVED

    # Simulate malicious manipulation of the payload dictionary
    plan.payload["code"] = "malicious_injection()"

    with pytest.raises(ValueError) as exc_info:
        await manager.execute(plan.action_id, lambda: None)
    assert "Security Violation: Payload checksum mismatch" in str(exc_info.value)
    assert plan.status == ActionStatus.FAILED


@pytest.mark.asyncio
async def test_gate_low_risk_auto_approve():
    """Verifies that LOW risk actions can be automatically approved upon preview."""
    manager = ApprovalGateManager(auto_approve_low=True)

    plan = manager.plan(
        action_type="read_market_profile",
        payload={"symbol": "BTCUSDT"},
        rationale="Read-only query.",
        risk_tier=RiskTier.LOW,
    )
    preview = manager.preview(plan.action_id)
    assert preview.requires_human_approval is False
    assert plan.status == ActionStatus.APPROVED

    # Can execute immediately without manual approval step
    res = await manager.execute(plan.action_id, lambda: {"status": "ok"})
    assert res == {"status": "ok"}


def test_gate_matrix_sweep_bounds_validation():
    """Verifies preview rejects matrix sweeps exceeding combinations limit."""
    manager = ApprovalGateManager()

    plan = manager.plan(
        action_type="matrix_sweep",
        payload={
            "strategy_id": "heavy_strat",
            # 10 * 10 * 10 = 1000 combinations (exceeds limit of 200)
            "param_grid": {
                "p1": list(range(10)),
                "p2": list(range(10)),
                "p3": list(range(10)),
            },
        },
        rationale="Overly massive parameter search.",
    )
    preview = manager.preview(plan.action_id)
    assert preview.is_valid is False
    assert any("exceeds safety limit" in err for err in preview.validation_errors)
    assert plan.status == ActionStatus.REJECTED
