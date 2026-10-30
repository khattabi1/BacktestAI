"""
Integration Tests for Multi-Modal File Upload & Async Agent Turn Execution.
Verifies file upload boundaries, MIME filtering, file retrieval, and background turn dispatch.
"""

import io
import pytest
from fastapi.testclient import TestClient

from apps.api.src.main import app

@pytest.fixture
def client():
    return TestClient(app)


def test_upload_python_strategy_file(client):
    """Verifies uploading a Python strategy file succeeds with metadata."""
    code_content = b"class CustomStrategy:\n    def on_bar(self, bar):\n        pass\n"
    file_obj = io.BytesIO(code_content)

    response = client.post(
        "/api/v1/agent/upload",
        files={"file": ("custom_strategy.py", file_obj, "text/x-python")},
    )
    assert response.status_code == 201
    data = response.json()
    assert "file_id" in data
    assert data["filename"] == "custom_strategy.py"
    assert data["size_bytes"] == len(code_content)
    assert data["url"].startswith("/api/v1/agent/files/")

    # Test retrieving file
    file_id = data["file_id"]
    get_resp = client.get(f"/api/v1/agent/files/{file_id}")
    assert get_resp.status_code == 200
    assert get_resp.content == code_content


def test_upload_unsupported_file_extension(client):
    """Verifies that unauthorized file extensions (.exe, .sh) are rejected with 400."""
    bad_content = b"MZ\x90\x00Binary"
    file_obj = io.BytesIO(bad_content)

    response = client.post(
        "/api/v1/agent/upload",
        files={"file": ("malicious.exe", file_obj, "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "not supported" in response.json()["detail"]


def test_upload_image_chart_asset(client):
    """Verifies uploading an image asset (PNG chart) returns valid URL."""
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    file_obj = io.BytesIO(fake_png)

    response = client.post(
        "/api/v1/agent/upload",
        files={"file": ("chart_breakout.png", file_obj, "image/png")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "chart_breakout.png"
    assert data["size_bytes"] == len(fake_png)


def test_async_turn_dispatch(client):
    """Verifies dispatching an async agent turn enqueues to Redis and returns 202."""
    # First create session
    sess_resp = client.post("/api/v1/agent/sessions", json={"title": "Async Test Session"})
    assert sess_resp.status_code == 201
    session_id = sess_resp.json()["session_id"]

    # Dispatch turn async
    turn_resp = client.post(
        f"/api/v1/agent/sessions/{session_id}/turn/async",
        json={"prompt": "Research Bollinger Band volatility regimes."},
    )
    assert turn_resp.status_code == 202
    data = turn_resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert data["session_id"] == session_id
