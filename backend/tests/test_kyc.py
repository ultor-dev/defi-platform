import pytest
from httpx import AsyncClient
from sqlalchemy import select
from tests.conftest import TestSessionLocal
from app.models.user import User, UserRole
from app.models.kyc import KYCStatus

async def test_submit_kyc(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/kyc/submit", headers=auth_headers, json={
        "full_name": "John Doe",
        "document_type": "passport",
        "document_number": "AB123456",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "PENDING"


async def test_submit_kyc_twice_fails(client: AsyncClient, auth_headers):
    await client.post("/api/v1/kyc/submit", headers=auth_headers, json={
        "full_name": "John Doe",
        "document_type": "passport",
        "document_number": "AB123456",
    })
    res = await client.post("/api/v1/kyc/submit", headers=auth_headers, json={
        "full_name": "John Doe",
        "document_type": "passport",
        "document_number": "AB123456",
    })
    assert res.status_code == 400
    assert "KYC already submitted or approved" in res.json()["detail"]


async def test_moderator_can_see_pending(client: AsyncClient, auth_headers, moderator_headers):
    await client.post("/api/v1/kyc/submit", headers=auth_headers, json={
        "full_name": "John Doe",
        "document_type": "passport",
        "document_number": "AB123456",
    })
    res = await client.get("/api/v1/admin/kyc/pending", headers=moderator_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1


async def test_unverified_cannot_see_pending(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/admin/kyc/pending", headers=auth_headers)
    assert res.status_code == 403


async def test_approve_kyc(client: AsyncClient, auth_headers, moderator_headers):
    # Получаем ID пользователя
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]

    # Подаём KYC
    await client.post("/api/v1/kyc/submit", headers=auth_headers, json={
        "full_name": "John Doe",
        "document_type": "passport",
        "document_number": "AB123456",
    })

    # Одобряем (минт не будет работать без блокчейна — это нормально)
    res = await client.post(f"/api/v1/admin/kyc/approve/{user_id}", headers=moderator_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"


async def test_reject_kyc(client: AsyncClient, auth_headers, moderator_headers):
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]

    await client.post("/api/v1/kyc/submit", headers=auth_headers, json={
        "full_name": "John Doe",
        "document_type": "passport",
        "document_number": "AB123456",
    })

    res = await client.post(
        f"/api/v1/admin/kyc/reject/{user_id}?reason=Invalid document",
        headers=moderator_headers
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
