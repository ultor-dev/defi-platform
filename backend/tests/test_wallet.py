import pytest
from httpx import AsyncClient


async def test_wallet_created_on_register(client: AsyncClient, registered_user):
    assert registered_user["wallet"] is not None
    assert registered_user["wallet"]["address"].startswith("0x")
    assert len(registered_user["wallet"]["address"]) == 42


async def test_get_my_wallet(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/wallet/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["address"].startswith("0x")


async def test_balance_requires_kyc(client: AsyncClient, auth_headers):
    """Unverified user не может видеть баланс."""
    res = await client.get("/api/v1/wallet/balance", headers=auth_headers)
    assert res.status_code == 403


async def test_export_key_requires_kyc(client: AsyncClient, auth_headers):
    """Unverified user не может экспортировать ключ."""
    res = await client.get("/api/v1/wallet/export-key", headers=auth_headers)
    assert res.status_code == 403


async def test_wallet_address_unique(client: AsyncClient):
    """Каждый пользователь получает уникальный адрес."""
    res1 = await client.post("/api/v1/auth/register", json={
        "email": "a@test.com", "username": "user_a", "password": "password123"
    })
    res2 = await client.post("/api/v1/auth/register", json={
        "email": "b@test.com", "username": "user_b", "password": "password123"
    })
    addr1 = res1.json()["wallet"]["address"]
    addr2 = res2.json()["wallet"]["address"]
    assert addr1 != addr2
