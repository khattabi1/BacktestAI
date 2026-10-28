"""
Unit tests for packages/agent/src/core/events.py
Verifies pub/sub streaming, async generator queueing, history recording, and close signaling.
"""

import asyncio
import pytest
from packages.agent.src.core.events import TrajectoryEventEmitter
from packages.agent.src.core.types import TrajectoryEvent, EventType


@pytest.mark.asyncio
async def test_event_emitter_pub_sub():
    emitter = TrajectoryEventEmitter(session_id="test_sess_events")
    assert emitter.session_id == "test_sess_events"
    assert len(emitter.history) == 0

    received_events = []

    async def subscriber_task():
        async for event in emitter.subscribe():
            received_events.append(event)

    task = asyncio.create_task(subscriber_task())
    await asyncio.sleep(0.01)

    evt1 = TrajectoryEvent(
        step_index=1,
        event_type=EventType.SESSION_STARTED,
        payload={"started": True},
        session_id="test_sess_events",
    )
    evt2 = TrajectoryEvent(
        step_index=2,
        event_type=EventType.THOUGHT_CHUNK,
        payload={"delta": "Analyzing market conditions..."},
        session_id="test_sess_events",
    )

    emitter.emit(evt1)
    emitter.emit(evt2)
    emitter.close()

    await asyncio.wait_for(task, timeout=2.0)

    assert len(received_events) == 2
    assert received_events[0].event_type == EventType.SESSION_STARTED
    assert received_events[1].payload["delta"] == "Analyzing market conditions..."
    assert len(emitter.history) == 2


@pytest.mark.asyncio
async def test_event_emitter_multiple_subscribers():
    emitter = TrajectoryEventEmitter(session_id="multi_sub")
    sub1_events = []
    sub2_events = []

    async def sub1():
        async for e in emitter.subscribe():
            sub1_events.append(e)

    async def sub2():
        async for e in emitter.subscribe():
            sub2_events.append(e)

    t1 = asyncio.create_task(sub1())
    t2 = asyncio.create_task(sub2())
    await asyncio.sleep(0.01)

    evt = TrajectoryEvent(
        step_index=1,
        event_type=EventType.STATE_CHANGED,
        payload={"new_state": "THINKING"},
        session_id="multi_sub",
    )
    emitter.emit(evt)
    emitter.close()

    await asyncio.wait_for(asyncio.gather(t1, t2), timeout=2.0)

    assert len(sub1_events) == 1
    assert len(sub2_events) == 1
    assert sub1_events[0].payload["new_state"] == "THINKING"

