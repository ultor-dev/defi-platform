from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User, UserRole, KYCStatus
from app.schemas.user import KYCSubmitRequest, KYCReviewRequest, UserOut
from app.services.blockchain_service import mint_tokens

# Hardhat аккаунт #0 — деплойер контракта (только для local dev!)
HARDHAT_DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
KYC_REWARD_TOKENS = 100.0  # токенов за прохождение KYC

router = APIRouter(prefix="/kyc", tags=["kyc"])


@router.post("/submit", response_model=UserOut)
async def submit_kyc(
    body: KYCSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.kyc_status == KYCStatus.APPROVED:
        raise HTTPException(400, "KYC already approved")
    if current_user.kyc_status == KYCStatus.PENDING:
        raise HTTPException(400, "KYC already under review")

    current_user.kyc_full_name = body.full_name
    current_user.kyc_document_type = body.document_type
    current_user.kyc_document_number = body.document_number
    current_user.kyc_status = KYCStatus.PENDING
    current_user.kyc_submitted_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/review", response_model=UserOut)
async def review_kyc(
    body: KYCReviewRequest,
    reviewer: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).options(joinedload(User.wallet)).where(User.id == body.user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.kyc_status != KYCStatus.PENDING:
        raise HTTPException(400, "No pending KYC for this user")

    if body.approved:
        user.kyc_status = KYCStatus.APPROVED
        user.role = UserRole.USER

        # Минт приветственных токенов
        if user.wallet:
            try:
                tx_hash = await mint_tokens(
                    user.wallet.address,
                    KYC_REWARD_TOKENS,
                    HARDHAT_DEPLOYER_KEY,
                )
                print(f"Minted {KYC_REWARD_TOKENS} tokens to {user.wallet.address}, tx: {tx_hash}")
            except Exception as e:
                print(f"Mint failed (non-critical): {e}")
    else:
        user.kyc_status = KYCStatus.REJECTED
        user.kyc_rejection_reason = body.rejection_reason

    user.kyc_reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/pending", response_model=list[UserOut])
async def pending_kyc(
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .options(joinedload(User.wallet))
        .where(User.kyc_status == KYCStatus.PENDING)
    )
    return result.scalars().all()
