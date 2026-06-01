from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.user import User


async def get_user_with_relations(user_id: int, db: AsyncSession) -> User | None:
    """Загружает юзера со всеми relations одним запросом."""
    result = await db.execute(
        select(User)
        .options(joinedload(User.wallets), joinedload(User.profile))
        .where(User.id == user_id)
    )
    return result.unique().scalar_one_or_none()
