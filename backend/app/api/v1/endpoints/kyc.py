from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User, UserRole
from app.models.kyc import KYCApplication, KYCStatus
from app.schemas.user import KYCSubmitRequest, KYCReviewRequest, UserOut
from app.services.blockchain_service import mint_tokens

HARDHAT_DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
KYC_REWARD_TOKENS = 100.0

router = APIRouter(prefix="/kyc", tags=["kyc"])


def get_primary_wallet(user):
    if not user.wallets:
        return None
    for w in user.wallets:
        if w.is_primary:
            return w
    return user.wallets[0]


# ── Пользователь: подать заявку ───────────────────────────────
@router.post("/submit")
async def submit_kyc(
    body: KYCSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(KYCApplication).where(
            KYCApplication.user_id == current_user.id,
            KYCApplication.status.in_([KYCStatus.PENDING, KYCStatus.APPROVED])
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "KYC already submitted or approved")

    app = KYCApplication(
        user_id=current_user.id,
        status=KYCStatus.PENDING,
        full_name=body.full_name,
        document_type=body.document_type,
        document_number=body.document_number,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return {"id": app.id, "status": app.status.value, "submitted_at": app.submitted_at}


# ── Пользователь: статус последней заявки ────────────────────
@router.get("/status")
async def kyc_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KYCApplication)
        .where(KYCApplication.user_id == current_user.id)
        .order_by(KYCApplication.submitted_at.desc())
        .limit(1)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "No KYC application found")

    return {
        "id": app.id,
        "status": app.status.value,
        "full_name": app.full_name,
        "document_type": app.document_type,
        "document_number": app.document_number,
        "rejection_reason": app.rejection_reason,
        "submitted_at": app.submitted_at,
        "reviewed_at": app.reviewed_at,
    }


# ── Пользователь: история всех заявок ────────────────────────
@router.get("/my-applications")
async def my_kyc_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KYCApplication)
        .where(KYCApplication.user_id == current_user.id)
        .order_by(KYCApplication.submitted_at.desc())
    )
    apps = result.scalars().all()
    return [
        {
            "id": a.id,
            "status": a.status.value,
            "full_name": a.full_name,
            "document_type": a.document_type,
            "document_number": a.document_number,
            "rejection_reason": a.rejection_reason,
            "submitted_at": a.submitted_at,
            "reviewed_at": a.reviewed_at,
        }
        for a in apps
    ]


# ── Старый эндпоинт review (оставляем для совместимости) ─────
@router.post("/review", response_model=UserOut)
async def review_kyc(
    body: KYCReviewRequest,
    reviewer: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    kyc_result = await db.execute(
        select(KYCApplication).where(
            KYCApplication.user_id == body.user_id,
            KYCApplication.status == KYCStatus.PENDING
        )
    )
    kyc_app = kyc_result.scalar_one_or_none()
    if not kyc_app:
        raise HTTPException(400, "No pending KYC for this user")

    user_result = await db.execute(
        select(User).options(joinedload(User.wallets)).where(User.id == body.user_id)
    )
    user = user_result.unique().scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    if body.approved:
        kyc_app.status = KYCStatus.APPROVED
        user.role = UserRole.USER
        wallet = get_primary_wallet(user)
        if wallet:
            try:
                tx_hash = await mint_tokens(wallet.address, KYC_REWARD_TOKENS, HARDHAT_DEPLOYER_KEY)
                print(f"Minted {KYC_REWARD_TOKENS} to {wallet.address}, tx: {tx_hash}")
            except Exception as e:
                print(f"Mint failed (non-critical): {e}")
    else:
        kyc_app.status = KYCStatus.REJECTED
        kyc_app.rejection_reason = body.rejection_reason

    kyc_app.reviewed_by = reviewer.id
    kyc_app.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return user


# ── Admin: список pending заявок ──────────────────────────────
@router.get("/pending", response_model=list[UserOut])
async def pending_kyc(
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .options(joinedload(User.wallets))
        .join(KYCApplication, KYCApplication.user_id == User.id)
        .where(KYCApplication.status == KYCStatus.PENDING)
    )
    return result.unique().scalars().all()
