"""
Integration and Unit Tests for Distributed Redis Session Locks.
Validates mutual exclusion across concurrent requests, TTL expiry, and fallback behavior.
"""

import asyncio
import pytest
from unittest.mock import patch
import redis.exceptions

from apps.api.src.routers.agent import (
    session_distributed_lock,
    SessionBusyError,
    _in_memory_locks,
)
from apps.api.src.job_queue import job_queue


@pytest.mark.asyncio
async def test_distributed_redis_lock_mutual_exclusion():
    """
    Verifies that when a session lock is held, concurrent attempts to acquire
    the lock for the same session fail with SessionBusyError within the acquire_timeout.
    """
    session_id = "test_sess_redis_dist_1"

    # Acquire lock in first scope
    async with session_distributed_lock(session_id, timeout=60.0, acquire_timeout=1.0):
        # Verify second attempt on same session times out
        with pytest.raises(SessionBusyError):
            async with session_distributed_lock(session_id, timeout=60.0, acquire_timeout=0.5):
                pass

    # Verify that once released, subsequent acquisition succeeds immediately
    acquired_second = False
    async with session_distributed_lock(session_id, timeout=60.0, acquire_timeout=1.0):
        acquired_second = True

    assert acquired_second is True


@pytest.mark.asyncio
async def test_distributed_lock_independent_sessions():
    """
    Verifies that locks for two different sessions do NOT block each other.
    """
    sess_1 = "test_sess_dist_a"
    sess_2 = "test_sess_dist_b"

    async with session_distributed_lock(sess_1, timeout=60.0, acquire_timeout=1.0):
        acquired_sess_2 = False
        async with session_distributed_lock(sess_2, timeout=60.0, acquire_timeout=1.0):
            acquired_sess_2 = True
        assert acquired_sess_2 is True


@pytest.mark.asyncio
async def test_distributed_lock_fallback_when_redis_offline():
    """
    Verifies that if Redis is offline or raises a ConnectionRefusedError,
    the lock gracefully falls back to the in-memory asyncio.Lock mechanism.
    """
    session_id = "test_sess_fallback_offline"

    with patch.object(job_queue, "get_pool", side_effect=redis.exceptions.ConnectionError("Redis offline")):
        async with session_distributed_lock(session_id, timeout=60.0, acquire_timeout=1.0):
            # Assert fallback in-memory lock was created and locked
            assert session_id in _in_memory_locks
            assert _in_memory_locks[session_id].locked() is True

            # Attempting another lock on the same session should raise SessionBusyError
            with pytest.raises(SessionBusyError):
                async with session_distributed_lock(session_id, timeout=60.0, acquire_timeout=0.5):
                    pass

        # Verify fallback in-memory lock was released
        assert _in_memory_locks[session_id].locked() is False
