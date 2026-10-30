import uuid
import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app
from apps.api.src.db import init_database

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_database()

@pytest.fixture
def client():
    return TestClient(app)

def test_login_seeded_user_success(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "quant@backtestai.io", "password": "quant2026"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    # Verify JWT format: 3 dot-separated base64 segments
    assert len(data["token"].split(".")) == 3
    assert data["token_type"] == "bearer"
    assert "expires_at" in data
    assert data["user"]["email"] == "quant@backtestai.io"
    assert data["user"]["role"] == "user"

def test_login_seeded_user_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "quant@backtestai.io", "password": "wrong_password_999"}
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]

def test_signup_new_user_and_jwt_flow(client):
    unique_email = f"researcher_{uuid.uuid4().hex[:8]}@fund.com"
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": unique_email,
            "password": "SecurePassword2026!",
            "full_name": "Dr. Alexander Cross",
            "tier": "pro"
        }
    )
    assert response.status_code == 200
    data = response.json()
    token = data["token"]
    assert len(token.split(".")) == 3
    assert data["user"]["email"] == unique_email
    assert data["user"]["full_name"] == "Dr. Alexander Cross"

    # Verify duplicate signup rejected
    dup_res = client.post(
        "/api/v1/auth/signup",
        json={
            "email": unique_email,
            "password": "SecurePassword2026!",
            "full_name": "Dr. Alexander Cross"
        }
    )
    assert dup_res.status_code == 400

    # Verify /me endpoint with Bearer JWT
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["email"] == unique_email
    assert me_data["default_workspace"]["name"] == "Personal Lab"

    # Verify /workspaces endpoint
    ws_res = client.get("/api/v1/auth/workspaces", headers=headers)
    assert ws_res.status_code == 200
    workspaces = ws_res.json()
    assert len(workspaces) >= 1
    assert workspaces[0]["slug"] == "personal-lab"

    # Verify logout
    logout_res = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 200

def test_google_oauth_login_and_auto_provisioning(client):
    google_email = f"g_trader_{uuid.uuid4().hex[:6]}@gmail.com"
    response = client.post(
        "/api/v1/auth/google",
        json={
            "email": google_email,
            "name": "Institutional Google Trader",
            "credential": "simulated_google_oauth_id_token"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert len(data["token"].split(".")) == 3
    assert data["user"]["email"] == google_email
    assert data["user"]["full_name"] == "Institutional Google Trader"

    # Test access to /me using Google JWT
    headers = {"Authorization": f"Bearer {data['token']}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == google_email

def test_unauthenticated_me_rejected(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

def test_forgot_password_simulation(client):
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "quant@backtestai.io"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "dispatched"
