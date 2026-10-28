"""
Trajectory Event Emitter for BacktestAI Agent (DSH Architecture).
Enables real-time SSE / WebSocket streaming of Agent thoughts and actions.
"""

from __future__ import annotations
import asyncio
from typing import AsyncGenerator, Optional
from .types import TrajectoryEvent, EventType


class TrajectoryEventEmitter:
    """
    Publish/Subscribe event emitter for agent session events.
    Supports asynchronous SSE/WebSocket subscribers and history recording.
    """

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._subscribers: list[asyncio.Queue[Optional[TrajectoryEvent]]] = []
        self._history: list[TrajectoryEvent] = []

    def emit(self, event: TrajectoryEvent) -> None:
        """
        Emits an event to all active subscriber queues and records history.
        """
        self._history.append(event)
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def close(self) -> None:
        """
        Sends None to all subscriber queues to signal stream end.
        """
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

    async def subscribe(self) -> AsyncGenerator[TrajectoryEvent, None]:
        """
        Subscribes to real-time events.
        Yields TrajectoryEvent items until closed.
        """
        queue: asyncio.Queue[Optional[TrajectoryEvent]] = asyncio.Queue(maxsize=1000)
        self._subscribers.append(queue)
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield event
        finally:
            if queue in self._subscribers:
                self._subscribers.remove(queue)

    @property
    def history(self) -> list[TrajectoryEvent]:
        return list(self._history)

