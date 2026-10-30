import asyncio
import json
import pytest
from packages.agent.src.core.types import EventType, TrajectoryEvent, utc_now_iso


async def pump_events_with_keepalive(
    generator,
    keepalive_interval: float = 0.1,
):
    queue = asyncio.Queue()
    DONE_SENTINEL = object()

    async def producer():
        try:
            async for item in generator:
                await queue.put(item)
        except Exception as exc:
            await queue.put(exc)
        finally:
            await queue.put(DONE_SENTINEL)

    producer_task = asyncio.create_task(producer())

    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=keepalive_interval)
                if item is DONE_SENTINEL:
                    break
                if isinstance(item, Exception):
                    raise item

                event = item
                payload_str = json.dumps({
                    "event_type": event.event_type.value,
                    "step_index": event.step_index,
                    "payload": event.payload,
                    "timestamp": event.timestamp_utc,
                })
                yield f"data: {payload_str}\n\n"
                await asyncio.sleep(0.002)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        if not producer_task.done():
            producer_task.cancel()
            try:
                await producer_task
            except (asyncio.CancelledError, Exception):
                pass


@pytest.mark.asyncio
async def test_pump_events_normal_flow():
    async def sample_gen():
        yield TrajectoryEvent(
            session_id="test_sess",
            step_index=1,
            event_type=EventType.THOUGHT_CHUNK,
            payload={"delta": "hello"},
            timestamp_utc=utc_now_iso(),
        )
        yield TrajectoryEvent(
            session_id="test_sess",
            step_index=2,
            event_type=EventType.AGENT_DONE,
            payload={"turns": 1},
            timestamp_utc=utc_now_iso(),
        )

    results = []
    async for line in pump_events_with_keepalive(sample_gen(), keepalive_interval=0.5):
        results.append(line)

    assert len(results) == 2
    assert "data: " in results[0]
    assert "hello" in results[0]
    assert "AGENT_DONE" in results[1]


@pytest.mark.asyncio
async def test_pump_events_survives_long_delay_with_keepalive():
    async def slow_gen():
        yield TrajectoryEvent(
            session_id="test_sess",
            step_index=1,
            event_type=EventType.MESSAGE_CHUNK,
            payload={"delta": "start"},
            timestamp_utc=utc_now_iso(),
        )
        # Simulate long MT5 backtest or reasoning taking 0.35s with 0.1s keepalive
        await asyncio.sleep(0.35)
        yield TrajectoryEvent(
            session_id="test_sess",
            step_index=2,
            event_type=EventType.MESSAGE_CHUNK,
            payload={"delta": "end"},
            timestamp_utc=utc_now_iso(),
        )

    results = []
    async for line in pump_events_with_keepalive(slow_gen(), keepalive_interval=0.1):
        results.append(line)

    # Should contain start, at least two keepalives, and end
    assert any(": keepalive\n\n" in r for r in results)
    assert any("start" in r for r in results)
    assert any("end" in r for r in results)
    # Crucially, slow_gen was NOT killed or cancelled, and "end" was received!
    assert "end" in results[-1]
