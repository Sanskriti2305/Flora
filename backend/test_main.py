from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "Flora API is running"

def test_signup_and_login():
    signup = client.post("/auth/signup", json={
        "display_name": "TestUser",
        "email": "flora_test_unique@test.com",
        "password": "Test@1234"
    })
    assert signup.status_code == 200
    assert "token" in signup.json()

    login = client.post("/auth/login", json={
        "email": "flora_test_unique@test.com",
        "password": "Test@1234"
    })
    assert login.status_code == 200
    assert "token" in login.json()

def test_login_wrong_password():
    response = client.post("/auth/login", json={
        "email": "flora_test_unique@test.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

def test_protected_route_requires_auth():
    response = client.get("/profile")
    assert response.status_code == 401

def test_preview_swap_requires_auth():
    response = client.post("/preview-swap", json={"text": "drove 10km"})
    assert response.status_code == 401