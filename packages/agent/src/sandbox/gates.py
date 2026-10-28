"""
Sensitive Action Approval Gates for BacktestAI Agent.
Implements the 5-stage lifecycle for sensitive and high-impact actions:
PLAN ➔ PREVIEW/VALIDATE ➔ APPROVE ➔ EXECUTE ➔ VERIFY.
Provides cryptographic checksum verification and an immutable audit trail.
"""

from __future__ import annotations
from enum import Enum
import hashlib
import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field

logger = logging.getLogger("backtest_ai.agent.sandbox.gates")


class RiskTier(str, Enum):
    """Risk severity classification for agent operations."""
    LOW = "low"          # Safe reads, single backtest runs <= 10k bars (Auto-approvable)
    MEDIUM = "medium"    # Code draft creation, parameter edits, small sweeps <= 25 runs
    HIGH = "high"        # Modifying existing strategy, deleting strategy, sweeps > 25 runs
    CRITICAL = "critical"  # Live trade triggers, API credential generation, unsandboxed execution


class ActionStatus(str, Enum):
    """Lifecycle status of a gated action."""
    PLANNED = "planned"
    PREVIEWED = "previewed"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    EXECUTED = "executed"
    VERIFIED = "verified"
    FAILED = "failed"


def _compute_checksum(data: Any) -> str:
    """Computes a deterministic SHA-256 checksum for a payload."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class ActionPlan(BaseModel):
    """Stage 1 (PLAN): Blueprint for a proposed sensitive action."""
    action_id: str = Field(default_factory=lambda: f"act_{uuid.uuid4().hex[:12]}")
    session_id: Optional[str] = None
    action_type: str  # e.g. "delete_strategy", "edit_strategy", "matrix_sweep"
    risk_tier: RiskTier = RiskTier.MEDIUM
    payload: Dict[str, Any]
    payload_checksum: str = ""
    rationale: str
    status: ActionStatus = ActionStatus.PLANNED
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    def model_post_init(self, __context: Any) -> None:
        if not self.payload_checksum:
            self.payload_checksum = _compute_checksum(self.payload)


class ActionPreview(BaseModel):
    """Stage 2 (PREVIEW/VALIDATE): Human-inspectable impact preview and validation report."""
    action_id: str
    summary: str
    diff_preview: Optional[str] = None
    estimated_duration_sec: float = 0.0
    estimated_compute_units: int = 1
    blast_radius: str = "Local workspace"
    is_valid: bool = True
    validation_errors: List[str] = Field(default_factory=list)
    requires_human_approval: bool = True


class AuditRecord(BaseModel):
    """Stage 5 (VERIFY): Immutable cryptographic audit record."""
    audit_id: str = Field(default_factory=lambda: f"aud_{uuid.uuid4().hex[:12]}")
    action_id: str
    session_id: Optional[str] = None
    action_type: str
    risk_tier: RiskTier
    approver_id: Optional[str] = None
    approved_at: Optional[float] = None
    executed_at: Optional[float] = None
    verified_at: Optional[float] = None
    execution_success: bool = False
    verification_passed: bool = False
    execution_duration_sec: float = 0.0
    output_summary: Optional[str] = None
    error_message: Optional[str] = None
    tamper_checksum: str = ""

    def finalize(self) -> None:
        """Computes tamper-evident checksum over the completed audit record."""
        data_to_hash = {
            "audit_id": self.audit_id,
            "action_id": self.action_id,
            "action_type": self.action_type,
            "risk_tier": self.risk_tier.value,
            "approver_id": self.approver_id,
            "execution_success": self.execution_success,
            "verification_passed": self.verification_passed,
            "execution_duration_sec": self.execution_duration_sec,
        }
        self.tamper_checksum = _compute_checksum(data_to_hash)


class ApprovalGateManager:
    """
    Orchestrates the 5-Stage Approval Gate Protocol for BacktestAI.
    Guarantees that sensitive actions cannot execute without valid approval,
    protects against payload mutation (TOCTOU attacks), and verifies post-execution state.
    """

    def __init__(self, storage: Optional[Any] = None, auto_approve_low: bool = True) -> None:
        self.storage = storage
        self.auto_approve_low = auto_approve_low
        self._plans: Dict[str, ActionPlan] = {}
        self._previews: Dict[str, ActionPreview] = {}
        self._audit_trail: List[AuditRecord] = {} if False else []
        self._execution_outputs: Dict[str, Any] = {}

    def plan(
        self,
        action_type: str,
        payload: Dict[str, Any],
        rationale: str,
        risk_tier: Optional[RiskTier] = None,
        session_id: Optional[str] = None,
    ) -> ActionPlan:
        """
        Stage 1: PLAN.
        Creates an ActionPlan with cryptographic payload checksum and initial status.
        """
        # Infer risk tier if not explicitly provided
        effective_tier = risk_tier or self._infer_risk_tier(action_type, payload)

        action_plan = ActionPlan(
            session_id=session_id,
            action_type=action_type,
            risk_tier=effective_tier,
            payload=payload,
            rationale=rationale,
            status=ActionStatus.PLANNED,
        )

        self._plans[action_plan.action_id] = action_plan
        logger.info(
            f"[Gate] Planned action '{action_plan.action_id}' ({action_type}) "
            f"tier={effective_tier.value}"
        )
        return action_plan

    def preview(
        self,
        action_id: str,
        validator: Optional[Callable[[Dict[str, Any]], List[str]]] = None,
    ) -> ActionPreview:
        """
        Stage 2: PREVIEW / VALIDATE.
        Generates impact preview, validates input invariants, and updates status.
        """
        plan = self._get_plan_or_raise(action_id)

        errors: List[str] = []
        if validator:
            try:
                custom_errors = validator(plan.payload)
                if custom_errors:
                    errors.extend(custom_errors)
            except Exception as exc:
                errors.append(f"Validator failure: {str(exc)}")

        # Built-in sanity checks
        if plan.action_type == "matrix_sweep":
            grid = plan.payload.get("param_grid", {})
            total_runs = 1
            for vals in grid.values():
                if isinstance(vals, list):
                    total_runs *= max(1, len(vals))
            if total_runs > 200:
                errors.append(f"Matrix sweep parameter combinations ({total_runs}) exceeds safety limit of 200.")

        is_valid = len(errors) == 0
        requires_approval = (
            plan.risk_tier != RiskTier.LOW or not self.auto_approve_low
        )

        # Generate summary description
        summary = self._generate_preview_summary(plan)
        blast_radius = self._estimate_blast_radius(plan)

        preview = ActionPreview(
            action_id=action_id,
            summary=summary,
            blast_radius=blast_radius,
            estimated_duration_sec=self._estimate_duration(plan),
            estimated_compute_units=self._estimate_compute(plan),
            is_valid=is_valid,
            validation_errors=errors,
            requires_human_approval=requires_approval,
        )

        self._previews[action_id] = preview

        if not is_valid:
            plan.status = ActionStatus.REJECTED
        elif not requires_approval:
            # Low risk and auto-approve enabled
            plan.status = ActionStatus.APPROVED
            plan.updated_at = time.time()
        else:
            plan.status = ActionStatus.AWAITING_APPROVAL
            plan.updated_at = time.time()

        return preview

    def approve(
        self,
        action_id: str,
        approver_id: str,
        approval_token: Optional[str] = None,
    ) -> ActionPlan:
        """
        Stage 3: APPROVE.
        Marks the action as approved for execution by the specified approver.
        """
        plan = self._get_plan_or_raise(action_id)
        if plan.status not in (ActionStatus.AWAITING_APPROVAL, ActionStatus.PREVIEWED):
            raise ValueError(
                f"Cannot approve action '{action_id}' in state '{plan.status.value}'. "
                "Must be awaiting approval."
            )

        preview = self._previews.get(action_id)
        if preview and not preview.is_valid:
            raise ValueError(
                f"Cannot approve invalid action '{action_id}': {preview.validation_errors}"
            )

        plan.status = ActionStatus.APPROVED
        plan.updated_at = time.time()
        logger.info(f"[Gate] Action '{action_id}' APPROVED by '{approver_id}'")
        return plan

    def reject(
        self,
        action_id: str,
        approver_id: str,
        reason: str,
    ) -> ActionPlan:
        """
        Stage 3 (alt): REJECT.
        Rejects the action proposal and records the rejection reason.
        """
        plan = self._get_plan_or_raise(action_id)
        plan.status = ActionStatus.REJECTED
        plan.updated_at = time.time()
        logger.info(f"[Gate] Action '{action_id}' REJECTED by '{approver_id}': {reason}")
        return plan

    async def execute(
        self,
        action_id: str,
        handler: Callable[..., Any],
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """
        Stage 4: EXECUTE.
        Asserts approval state, verifies payload integrity against TOCTOU tampering,
        and invokes the execution handler.
        """
        import inspect

        plan = self._get_plan_or_raise(action_id)
        if plan.status != ActionStatus.APPROVED:
            raise PermissionError(
                f"Action '{action_id}' is not approved (current status: '{plan.status.value}'). "
                "Sensitive actions require explicit approval before execution."
            )

        # TOCTOU Checksum Guard: Verify payload has not been modified after approval
        current_checksum = _compute_checksum(plan.payload)
        if current_checksum != plan.payload_checksum:
            plan.status = ActionStatus.FAILED
            raise ValueError(
                f"Security Violation: Payload checksum mismatch for action '{action_id}'. "
                "The payload was mutated after plan creation."
            )

        plan.status = ActionStatus.EXECUTING
        plan.updated_at = time.time()
        start_time = time.perf_counter()

        try:
            if inspect.iscoroutinefunction(handler):
                result = await handler(*args, **kwargs)
            else:
                result = handler(*args, **kwargs)

            duration = time.perf_counter() - start_time
            plan.status = ActionStatus.EXECUTED
            plan.updated_at = time.time()

            self._execution_outputs[action_id] = {
                "success": True,
                "result": result,
                "duration_sec": duration,
                "error": None,
            }
            return result

        except Exception as exc:
            duration = time.perf_counter() - start_time
            plan.status = ActionStatus.FAILED
            plan.updated_at = time.time()
            self._execution_outputs[action_id] = {
                "success": False,
                "result": None,
                "duration_sec": duration,
                "error": str(exc),
            }
            logger.error(f"[Gate] Execution of '{action_id}' failed: {exc}")
            raise

    def verify(
        self,
        action_id: str,
        verifier: Optional[Callable[[Any], bool]] = None,
        approver_id: Optional[str] = None,
    ) -> AuditRecord:
        """
        Stage 5: VERIFY.
        Validates post-execution integrity and stamps an immutable AuditRecord.
        """
        plan = self._get_plan_or_raise(action_id)
        exec_meta = self._execution_outputs.get(action_id, {})
        exec_success = exec_meta.get("success", False)
        duration = exec_meta.get("duration_sec", 0.0)
        error_msg = exec_meta.get("error")
        result = exec_meta.get("result")

        # Run verification check
        verification_passed = exec_success
        if verifier and exec_success:
            try:
                verification_passed = bool(verifier(result))
            except Exception as exc:
                verification_passed = False
                error_msg = f"Verifier assertion error: {str(exc)}"

        if verification_passed:
            plan.status = ActionStatus.VERIFIED
        else:
            plan.status = ActionStatus.FAILED
        plan.updated_at = time.time()

        # Build output summary
        summary = str(result)[:300] if result is not None else None

        audit = AuditRecord(
            action_id=action_id,
            session_id=plan.session_id,
            action_type=plan.action_type,
            risk_tier=plan.risk_tier,
            approver_id=approver_id or "system_or_user",
            approved_at=plan.updated_at,
            executed_at=time.time() - duration,
            verified_at=time.time(),
            execution_success=exec_success,
            verification_passed=verification_passed,
            execution_duration_sec=round(duration, 4),
            output_summary=summary,
            error_message=error_msg,
        )
        audit.finalize()

        self._audit_trail.append(audit)
        logger.info(
            f"[Gate] Action '{action_id}' VERIFIED={verification_passed} "
            f"audit_id={audit.audit_id} checksum={audit.tamper_checksum[:8]}..."
        )
        return audit

    def get_plan(self, action_id: str) -> Optional[ActionPlan]:
        """Retrieves an action plan by ID."""
        return self._plans.get(action_id)

    def get_preview(self, action_id: str) -> Optional[ActionPreview]:
        """Retrieves an action preview by ID."""
        return self._previews.get(action_id)

    def get_audit_trail(self, session_id: Optional[str] = None) -> List[AuditRecord]:
        """Retrieves the full or session-filtered audit trail."""
        if not session_id:
            return list(self._audit_trail)
        return [r for r in self._audit_trail if r.session_id == session_id]

    # --- Private Helpers ---

    def _get_plan_or_raise(self, action_id: str) -> ActionPlan:
        plan = self._plans.get(action_id)
        if not plan:
            raise KeyError(f"Action plan '{action_id}' not found.")
        return plan

    def _infer_risk_tier(self, action_type: str, payload: Dict[str, Any]) -> RiskTier:
        """Automatically assigns a risk tier based on action semantics."""
        act = action_type.lower()
        if "delete" in act or "destroy" in act:
            return RiskTier.HIGH
        if "live" in act or "deploy" in act or "broker" in act:
            return RiskTier.CRITICAL
        if "matrix_sweep" in act:
            grid = payload.get("param_grid", {})
            total_combos = 1
            for vals in grid.values():
                if isinstance(vals, list):
                    total_combos *= max(1, len(vals))
            return RiskTier.HIGH if total_combos > 25 else RiskTier.MEDIUM
        if "edit" in act or "update" in act or "create" in act:
            return RiskTier.MEDIUM
        return RiskTier.LOW

    def _generate_preview_summary(self, plan: ActionPlan) -> str:
        act = plan.action_type
        if "delete" in act:
            strat_id = plan.payload.get("strategy_id", "unknown")
            return f"Permanent deletion of Strategy '{strat_id}' and all associated versions."
        if "matrix_sweep" in act:
            strat_id = plan.payload.get("strategy_id", "unknown")
            grid = plan.payload.get("param_grid", {})
            combos = 1
            for v in grid.values():
                if isinstance(v, list):
                    combos *= max(1, len(v))
            return f"Parameter matrix sweep on '{strat_id}' across {combos} parameter combinations."
        if "edit" in act:
            strat_id = plan.payload.get("strategy_id", "unknown")
            return f"Strategy modification for '{strat_id}' (new code or parameter schema revision)."
        return f"Execution of gated action '{act}' with rationale: {plan.rationale}"

    def _estimate_blast_radius(self, plan: ActionPlan) -> str:
        if plan.risk_tier == RiskTier.CRITICAL:
            return "Live Trading / External Broker API"
        if plan.risk_tier == RiskTier.HIGH:
            return "Strategy Database & Historical Versions"
        if plan.risk_tier == RiskTier.MEDIUM:
            return "Strategy Draft / Compute Resources"
        return "Local Ephemeral Memory"

    def _estimate_duration(self, plan: ActionPlan) -> float:
        if "matrix_sweep" in plan.action_type:
            grid = plan.payload.get("param_grid", {})
            combos = 1
            for v in grid.values():
                if isinstance(v, list):
                    combos *= max(1, len(v))
            return round(combos * 0.15, 2)
        return 0.5

    def _estimate_compute(self, plan: ActionPlan) -> int:
        if "matrix_sweep" in plan.action_type:
            grid = plan.payload.get("param_grid", {})
            combos = 1
            for v in grid.values():
                if isinstance(v, list):
                    combos *= max(1, len(v))
            return combos
        return 1
