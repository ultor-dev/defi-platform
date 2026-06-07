import pytest
from httpx import AsyncClient


async def test_register_success(client: AsyncClient):
    res = await client.post("/api/v1/auth/register", json={
        "email": "new@test.com",
        "username": "newuser",
        "password": "password123",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "new@test.com"
    assert data["username"] == "newuser"
    assert data["role"] == "UNVERIFIED"

async def test_register_duplicate_email(client: AsyncClient, registered_user):
    res = await client.post("/api/v1/auth/register", json={
        "email": "user@test.com",
        "username": "other",
        "password": "password123",
    })
    assert res.status_code == 400
    assert "already taken" in res.json()["detail"]


async def test_register_duplicate_username(client: AsyncClient, registered_user):
    res = await client.post("/api/v1/auth/register", json={
        "email": "other@test.com",
        "username": "testuser",
        "password": "password123",
    })
    assert res.status_code == 400


async def test_login_success(client: AsyncClient, registered_user):
    res = await client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "password123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient, registered_user):
    res = await client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "wrongpassword",
    })
    assert res.status_code == 401


async def test_login_wrong_email(client: AsyncClient):
    res = await client.post("/api/v1/auth/login", json={
        "email": "nobody@test.com",
        "password": "password123",
    })
    assert res.status_code == 401


async def test_me_authenticated(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "user@test.com"


async def test_me_unauthenticated(client: AsyncClient):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 403


async def test_refresh_token(client: AsyncClient, registered_user):
    login = await client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "password123",
    })
    refresh_token = login.json()["refresh_token"]

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert res.status_code == 200
    assert "access_token" in res.json()


async def test_refresh_with_access_token_fails(client: AsyncClient, registered_user):
    login = await client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "password123",
    })
    access_token = login.json()["access_token"]

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert res.status_code == 401
