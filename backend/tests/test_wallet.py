import pytest
from httpx import AsyncClient

async def test_wallet_created_on_register(client: AsyncClient, registered_user, auth_headers):
    # Теперь auth_headers есть в аргументах и не будет NameError
    res = await client.get("/api/v1/wallet/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["address"] is not None

async def test_wallet_address_unique(client: AsyncClient):
    """Каждый пользователь получает уникальный адрес."""
    # Регистрируем первого юзера и логинимся для получения токена
    await client.post("/api/v1/auth/register", json={
        "email": "a@test.com", "username": "user_a", "password": "password123"
    })
    login_a = await client.post("/api/v1/auth/login", json={
        "email": "a@test.com", "password": "password123"
    })
    token_a = login_a.json()["access_token"]
    
    # Регистрируем второго юзера и логинимся
    await client.post("/api/v1/auth/register", json={
        "email": "b@test.com", "username": "user_b", "password": "password123"
    })
    login_b = await client.post("/api/v1/auth/login", json={
        "email": "b@test.com", "password": "password123"
    })
    token_b = login_b.json()["access_token"]

    # Запрашиваем кошельки через эндпоинты
    res1 = await client.get("/api/v1/wallet/me", headers={"Authorization": f"Bearer {token_a}"})
    res2 = await client.get("/api/v1/wallet/me", headers={"Authorization": f"Bearer {token_b}"})
    
    addr1 = res1.json()["address"]
    addr2 = res2.json()["address"]
    
    assert addr1 != addr2
