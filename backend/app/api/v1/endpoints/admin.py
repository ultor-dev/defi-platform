from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.security import require_moderator, require_admin, get_current_user
from app.models.user import User, UserRole, KYCStatus
from app.schemas.user import KYCReviewRequest, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(
    moderator: User = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    """Общая статистика платформы."""
    total = await db.execute(select(func.count(User.id)))
    pending = await db.execute(select(func.count(User.id)).where(User.kyc_status == KYCStatus.PENDING))
    verified = await db.execute(select(func.count(User.id)).where(User.kyc_status == KYCStatus.APPROVED))
    unverified = await db.execute(select(func.count(User.id)).where(User.kyc_status == KYCStatus.NONE))

    return {
        "total_users": total.scalar(),
        "kyc_pending": pending.scalar(),
        "kyc_verified": verified.scalar(),
        "kyc_unverified": unverified.scalar(),
    }


@router.get("/users", response_model=list[UserOut])
async def get_all_users(
    moderator: User = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).options(joinedload(User.wallet)).order_by(User.created_at.desc())
    )
    return result.scalars().all()


@router.get("/kyc/pending", response_model=list[UserOut])
async def get_pending_kyc(
    moderator: User = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .options(joinedload(User.wallet))
        .where(User.kyc_status == KYCStatus.PENDING)
        .order_by(User.kyc_submitted_at)
    )
    return result.scalars().all()


@router.post("/kyc/approve/{user_id}", response_model=UserOut)
async def approve_kyc(
    user_id: int,
    moderator: User = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    from app.services.blockchain_service import mint_tokens
    HARDHAT_DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

    result = await db.execute(
        select(User).options(joinedload(User.wallet)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.kyc_status != KYCStatus.PENDING:
        raise HTTPException(400, "No pending KYC")

    user.kyc_status = KYCStatus.APPROVED
    user.role = UserRole.USER

    if user.wallet:
        try:
            await mint_tokens(user.wallet.address, 100.0, HARDHAT_DEPLOYER_KEY)
        except Exception as e:
            print(f"Mint failed: {e}")

    from datetime import datetime, timezone
    user.kyc_reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/kyc/reject/{user_id}", response_model=UserOut)
async def reject_kyc(
    user_id: int,
    reason: str = "Documents not valid",
    moderator: User = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    result = await db.execute(
        select(User).options(joinedload(User.wallet)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.kyc_status != KYCStatus.PENDING:
        raise HTTPException(400, "No pending KYC")

    user.kyc_status = KYCStatus.REJECTED
    user.kyc_rejection_reason = reason
    user.kyc_reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}/role")
async def change_role(
    user_id: int,
    role: UserRole,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Только admin может менять роли."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot change your own role")

    user.role = role
    await db.commit()
    return {"id": user.id, "username": user.username, "role": user.role}


@router.patch("/users/{user_id}/toggle-active")
async def toggle_active(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Заблокировать / разблокировать пользователя."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot deactivate yourself")

    user.is_active = not user.is_active
    await db.commit()
    return {"id": user.id, "username": user.username, "is_active": user.is_active}
