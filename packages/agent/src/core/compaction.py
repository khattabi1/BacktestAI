"""
QuantSessionDigest: Rolling Conversation Compactor for BacktestAI Agent (DSH Architecture).
Summarizes older turns into a rolling context digest to prevent context window overflow
while preserving critical quantitative hypotheses, metrics, and user preferences.
"""

from __future__ import annotations
import json
import logging
from typing import List, Optional
from .types import Message, Role

logger = logging.getLogger("backtest_ai.agent.compaction")


class QuantSessionDigest:
    """
    Distills long quantitative research conversations into structured digests.
    Ensures long-running research sessions retain memory of tested strategies,
    hyperparameters, and performance metrics.
    """

    @staticmethod
    def should_compact(history: List[Message], threshold: int = 12, max_chars: int = 30000) -> bool:
        """Determines if the message history requires rolling compaction based on turn count or character budget."""
        non_system = [m for m in history if m.role != Role.SYSTEM]
        if len(non_system) >= threshold:
            return True
        total_chars = sum(len(m.content or "") for m in non_system)
        return total_chars > max_chars

    @classmethod
    def distill_messages(cls, messages: List[Message]) -> str:
        """
        Extracts key quantitative milestones, hypotheses, decisions, and tool outputs
        from a list of older messages.
        """
        hypotheses: List[str] = []
        metrics_found: List[str] = []
        user_decisions: List[str] = []

        for msg in messages:
            content = msg.content or ""
            # Extract user prompts / decisions
            if msg.role == Role.USER:
                cleaned = " ".join(content.split())
                if len(cleaned) > 120:
                    cleaned = cleaned[:120] + "..."
                user_decisions.append(f"User requested: {cleaned}")

            # Extract tool outputs for backtests or market data
            elif msg.role == Role.TOOL:
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict):
                        metrics = parsed.get("metrics") if isinstance(parsed.get("metrics"), dict) else {}
                        if "strategy_id" in parsed or "net_profit" in parsed or "sharpe_ratio" in parsed or metrics:
                            s_id = parsed.get("strategy_id") or parsed.get("strategy_name") or "strategy"
                            sharpe = metrics.get("sharpe_ratio") or parsed.get("sharpe_ratio") or "N/A"
                            profit = metrics.get("net_profit_pct") or metrics.get("net_profit") or parsed.get("net_profit_pct") or parsed.get("net_profit") or "N/A"
                            dd = metrics.get("max_drawdown_pct") or parsed.get("max_drawdown_pct") or "N/A"
                            metrics_found.append(
                                f"Backtest '{s_id}': Return {profit}%, Sharpe {sharpe}, MaxDD {dd}%"
                            )
                        elif "best_configuration" in parsed:
                            best = parsed.get("best_configuration", {})
                            s_id = parsed.get("strategy_id", "sweep")
                            sharpe = best.get("sharpe_ratio", "N/A")
                            metrics_found.append(f"Matrix sweep for '{s_id}': Optimal Sharpe {sharpe}")
                except Exception:
                    pass

            # Extract assistant quantitative synthesis
            elif msg.role == Role.ASSISTANT:
                lines = content.splitlines()
                for line in lines:
                    line_clean = line.strip()
                    if line_clean.startswith("- ") or line_clean.startswith("* "):
                        if any(k in line_clean.lower() for k in ["sharpe", "drawdown", "rsi", "sma", "stop loss", "tp", "entry"]):
                            hypotheses.append(line_clean[2:])

        # Assemble compact digest
        digest_parts = ["[QUANT RESEARCH DIGEST - ROLLING CONTEXT ARCHIVE]"]

        if user_decisions:
            digest_parts.append("Past Directives:")
            for d in user_decisions[-4:]:
                digest_parts.append(f"  - {d}")

        if metrics_found:
            digest_parts.append("Quantitative Backtest Milestones:")
            for m in metrics_found[-5:]:
                digest_parts.append(f"  - {m}")

        if hypotheses:
            digest_parts.append("Established Findings & Technical Logic:")
            for h in hypotheses[-4:]:
                digest_parts.append(f"  - {h}")

        if len(digest_parts) == 1:
            digest_parts.append("Prior discussion focused on strategy design, parameter tuning, and risk modeling.")

        return "\n".join(digest_parts)

    @classmethod
    def compact_history(
        cls,
        history: List[Message],
        keep_recent: int = 6,
    ) -> List[Message]:
        """
        Compacts older messages into a rolling digest message.
        Preserves the root system prompt (index 0) and the most recent `keep_recent` messages.
        """
        if not history:
            return []

        # Find initial system prompt
        system_prompt: Optional[Message] = None
        start_idx = 0
        if history[0].role == Role.SYSTEM:
            system_prompt = history[0]
            start_idx = 1

        to_process = history[start_idx:]
        if len(to_process) <= keep_recent:
            return history

        older_messages = to_process[:-keep_recent]
        recent_messages = to_process[-keep_recent:]

        # Distill older messages
        digest_text = cls.distill_messages(older_messages)
        digest_message = Message(
            role=Role.USER,
            content=f"[Prior Conversation Digest & Quantitative Strategy Context]:\n{digest_text}",
        )

        # Sanitize recent messages to prevent oversized payloads from breaking prompt budget
        sanitized_recent: List[Message] = []
        for m in recent_messages:
            m_content = m.content or ""
            max_limit = 6000 if m.role == Role.TOOL else 12000
            if len(m_content) > max_limit:
                half = max_limit // 2
                omitted = len(m_content) - max_limit
                trimmed = m_content[:half] + f"\n\n[... OMITTED {omitted} CHARS FOR CONTEXT SAFETY ...]\n\n" + m_content[-half:]
                sanitized_recent.append(m.model_copy(update={"content": trimmed}))
            else:
                sanitized_recent.append(m)

        new_history: List[Message] = []
        if system_prompt:
            new_history.append(system_prompt)
        new_history.append(digest_message)
        new_history.extend(sanitized_recent)

        logger.info(
            f"[Compaction] Compacted {len(older_messages)} older messages into rolling digest. "
            f"New history size: {len(new_history)}"
        )
        return new_history

