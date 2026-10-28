# BacktestAI Agent Engine

Autonomous Quant Agent Core Engine for BacktestAI.

Features:
- Multi-turn Interleaved CoT Reasoning Loop (`<think>...</think>`)
- Append-only Trajectory Event Stream (`TrajectoryEventEmitter`)
- Typed Tool Registry (FastMCP MT5, Workspace, Analytical, Research)
- Human-in-the-Loop Interaction (`ask_user` pause & resume state machine)
- 4-Stage Sandbox Approval Gate (`plan` -> `preview` -> `approve` -> `execute`)
- Pluggable LLM Adapter (Meta Model Mesh: `muse-spark-1.3` + `muse-wonder`, with Gemini & OpenRouter fallbacks)
