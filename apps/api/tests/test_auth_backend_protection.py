import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app
from apps.api.src.db.jwt_auth import create_access_token

@pytest.fixture
def client():
    # Pass x-require-auth to force authentication check even in test runs
    c = TestClient(app)
    c.headers.update({"x-require-auth": "true"})
    return c

@pytest.fixture
def valid_token():
    return create_access_token({
        "sub": "user_quant_01",
        "email": "quant@backtestai.io",
        "role": "user",
        "tier": "pro"
    })

def test_unauthenticated_protected_endpoints_rejected(client):
    """Verify that unauthenticated access to protected API endpoints returns 401."""
    protected_paths = [
        "/api/v1/strategies",
        "/api/v1/backtests",
        "/api/v1/admin/users",
        "/api/v1/workspace/files",
        "/api/v1/journal",
    ]
    for path in protected_paths:
        res = client.get(path)
        assert res.status_code == 401, f"Expected 401 for unauthenticated {path}, got {res.status_code}"
        data = res.json()
        assert "Institutional authentication required" in data.get("detail", "")
        assert data.get("code") == "AUTH_REQUIRED"

def test_public_endpoints_allowed_without_token(client):
    """Verify that health check, root, and auth routes are publicly accessible."""
    res_health = client.get("/health")
    assert res_health.status_code == 200

    res_root = client.get("/")
    assert res_root.status_code == 200

def test_authenticated_access_with_bearer_token(client, valid_token):
    """Verify that requests with a valid Bearer token succeed."""
    headers = {"Authorization": f"Bearer {valid_token}", "x-require-auth": "true"}
    res = client.get("/api/v1/strategies", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_authenticated_access_with_auth_token_cookie(client, valid_token):
    """Verify that requests with a valid auth_token cookie succeed."""
    client.cookies.set("auth_token", valid_token)
    res = client.get("/api/v1/strategies")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_invalid_token_rejected(client):
    """Verify that invalid/tampered cryptographic tokens are rejected."""
    headers = {"Authorization": "Bearer invalid_garbage_token.xxx.yyy", "x-require-auth": "true"}
    res = client.get("/api/v1/strategies", headers=headers)
    assert res.status_code == 401
    assert "Session token has expired or cryptographic signature is invalid" in res.json().get("detail", "")

