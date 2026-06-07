import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db
from app.models.user import User, Wallet, UserRole
from app.models.message import Conversation, ConversationParticipant, Message
from app.models.kyc import KYCStatus

# Используем SQLite в памяти для тестов
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_db():
    """Пересоздаём БД перед каждым тестом."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c


@pytest_asyncio.fixture
async def registered_user(client):
    """Создаёт и возвращает зарегистрированного пользователя."""
    res = await client.post("/api/v1/auth/register", json={
        "email": "user@test.com",
        "username": "testuser",
        "password": "password123",
    })
    assert res.status_code == 201
    return res.json()


@pytest_asyncio.fixture
async def auth_headers(client, registered_user):
    """Возвращает заголовки с JWT токеном."""
    res = await client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "password123",
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def moderator_headers(client):
    """Создаёт модератора и возвращает его токен."""
    # Регистрируем
    await client.post("/api/v1/auth/register", json={
        "email": "mod@test.com",
        "username": "admin",
        "password": "password123",
    })
    # Повышаем роль напрямую через БД
    async with TestSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.username == "admin"))
        mod = result.scalar_one()
        mod.role = UserRole.ADMIN
        mod.kyc_status = KYCStatus.APPROVED
        await db.commit()

    res = await client.post("/api/v1/auth/login", json={
        "email": "mod@test.com",
        "password": "password123",
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
