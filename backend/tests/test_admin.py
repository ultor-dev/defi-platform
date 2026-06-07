import pytest
from httpx import AsyncClient


async def test_stats_accessible_to_moderator(client: AsyncClient, moderator_headers):
    res = await client.get("/api/v1/admin/stats", headers=moderator_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "pending_kyc" in data
    assert "approved_kyc" in data


async def test_stats_not_accessible_to_user(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/admin/stats", headers=auth_headers)
    assert res.status_code == 403


async def test_get_all_users(client: AsyncClient, moderator_headers, registered_user):
    res = await client.get("/api/v1/admin/users", headers=moderator_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


async def test_approve_nonexistent_user(client: AsyncClient, moderator_headers):
    res = await client.post("/api/v1/admin/kyc/approve/9999", headers=moderator_headers)
    assert res.status_code == 404


async def test_approve_user_without_pending_kyc(client: AsyncClient, moderator_headers, registered_user):
    user_id = registered_user["id"]
    res = await client.post(f"/api/v1/admin/kyc/approve/{user_id}", headers=moderator_headers)
    assert res.status_code == 404
    assert "KYC application not found" in res.json()["detail"]
