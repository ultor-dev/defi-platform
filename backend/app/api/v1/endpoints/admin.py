from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import require_admin, get_current_user
from app.models.user import User, UserRole, Wallet
from app.models.kyc import KYCApplication, KYCStatus
from app.models.transaction import Transaction
from app.models.notification import Notification, NotificationType
from app.schemas.user import UserOut
from app.utils.wallet import get_primary_wallet

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(User.id)))).scalar()
    active = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar()
    banned = (await db.execute(select(func.count(User.id)).where(User.is_active == False))).scalar()
    verified = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.USER))).scalar()
    pending = (await db.execute(select(func.count(KYCApplication.id)).where(KYCApplication.status == KYCStatus.PENDING))).scalar()
    approved = (await db.execute(select(func.count(KYCApplication.id)).where(KYCApplication.status == KYCStatus.APPROVED))).scalar()
    rejected = (await db.execute(select(func.count(KYCApplication.id)).where(KYCApplication.status == KYCStatus.REJECTED))).scalar()

    return {
        "total_users": total,
        "active_users": active,
        "banned_users": banned,
        "verified_users": verified,
        "pending_kyc": pending,
        "approved_kyc": approved,
        "rejected_kyc": rejected,
    }


@router.get("/users", response_model=list[UserOut])
async def get_all_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .options(joinedload(User.wallets), joinedload(User.profile))
        .order_by(User.created_at.desc())
    )
    return result.unique().scalars().all()


@router.get("/kyc/pending")
async def get_pending_kyc(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KYCApplication)
        .options(joinedload(KYCApplication.user).joinedload(User.wallets))
        .where(KYCApplication.status == KYCStatus.PENDING)
        .order_by(KYCApplication.submitted_at)
    )
    applications = result.unique().scalars().all()

    return [
        {
            "id": app.id,
            "user_id": app.user_id,
            "status": app.status,
            "full_name": app.full_name,
            "document_type": app.document_type,
            "document_number": app.document_number,
            "submitted_at": app.submitted_at,
            "user": {
                "id": app.user.id,
                "uid": app.user.uid,
                "username": app.user.username,
                "email": app.user.email,
                "role": app.user.role,
                "is_active": app.user.is_active,
                "email_verified": app.user.email_verified,
                "wallet_address": (get_primary_wallet(app.user).address
                                   if get_primary_wallet(app.user) else None),
            } if app.user else None,
        }
        for app in applications
    ]


@router.post("/kyc/approve/{kyc_id}")
async def approve_kyc(
    kyc_id: int,
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.services.blockchain_service import mint_tokens

    kyc_app = (await db.execute(
        select(KYCApplication).where(KYCApplication.id == kyc_id)
    )).scalar_one_or_none()

    if not kyc_app:
        raise HTTPException(404, "KYC application not found")
    if kyc_app.status != KYCStatus.PENDING:
        raise HTTPException(400, "KYC is not pending")

    user = (await db.execute(
        select(User).options(joinedload(User.wallets)).where(User.id == kyc_app.user_id)
    )).unique().scalar_one_or_none()

    if not user:
        raise HTTPException(404, "User not found")

    kyc_app.status = KYCStatus.APPROVED
    kyc_app.reviewed_by = moderator.id
    kyc_app.reviewed_at = datetime.now(timezone.utc)
    if user.role == UserRole.UNVERIFIED:
        user.role = UserRole.USER

    wallet = get_primary_wallet(user)
    if wallet:
        try:
            await mint_tokens(
                wallet.address,
                settings.KYC_REWARD_TOKENS,
                settings.HARDHAT_DEPLOYER_KEY,
            )
        except Exception as e:
            print(f"Mint failed (non-critical): {e}")

    from app.models.notification import Notification, NotificationType
    db.add(Notification(
        user_id=user.id,
        type=NotificationType.KYC_APPROVED,
        title="KYC Approved ✅",
        body="Your identity has been verified. You can now use all platform features.",
    ))

    await db.commit()
    return {"status": "approved", "kyc_id": kyc_id, "user_id": user.id}


@router.post("/kyc/reject/{kyc_id}")
async def reject_kyc(
    kyc_id: int,
    reason: str = Query(default="Documents not valid"),
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    kyc_app = (await db.execute(
        select(KYCApplication).where(KYCApplication.id == kyc_id)
    )).scalar_one_or_none()

    if not kyc_app:
        raise HTTPException(404, "KYC application not found")
    if kyc_app.status != KYCStatus.PENDING:
        raise HTTPException(400, "KYC is not pending")

    kyc_app.status = KYCStatus.REJECTED
    kyc_app.rejection_reason = reason
    kyc_app.reviewed_by = moderator.id
    kyc_app.reviewed_at = datetime.now(timezone.utc)

    from app.models.notification import Notification, NotificationType
    db.add(Notification(
        user_id=kyc_app.user_id,
        type=NotificationType.KYC_REJECTED,
        title="KYC Rejected ❌",
        body=f"Your KYC was rejected: {reason}",
    ))

    await db.commit()
    return {"status": "rejected", "kyc_id": kyc_id}


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot deactivate yourself")

    user.is_active = not user.is_active
    await db.commit()
    return {"id": user.id, "username": user.username, "is_active": user.is_active}


@router.patch("/users/{user_id}/role")
async def change_role(
    user_id: int,
    role: UserRole,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot change your own role")

    user.role = role
    await db.commit()
    return {"id": user.id, "username": user.username, "role": user.role}


@router.get("/network/graph")
async def get_network_graph(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    users = (await db.execute(
        select(User).options(joinedload(User.wallets))
    )).unique().scalars().all()

    all_wallets = (await db.execute(select(Wallet))).scalars().all()
    wallet_id_to_address = {w.id: w.address for w in all_wallets}

    transactions = (await db.execute(select(Transaction))).scalars().all()

    nodes = []
    for u in users:
        wallet = get_primary_wallet(u)
        if wallet:
            nodes.append({
                "id": wallet.address,
                "user_id": u.id,
                "username": u.username,
                "uid": u.uid,
                "role": u.role,
                "address": wallet.address,
            })

    links = []
    seen = set()
    for tx in transactions:
        from_addr = wallet_id_to_address.get(tx.from_wallet_id)
        to_addr = wallet_id_to_address.get(tx.to_wallet_id)
        if from_addr and to_addr and from_addr != to_addr:
            key = tuple(sorted([from_addr, to_addr]))
            if key not in seen:
                seen.add(key)
                links.append({
                    "source": from_addr,
                    "target": to_addr,
                    "amount": str(tx.amount) if tx.amount else "0",
                    "tx_hash": tx.tx_hash or "",
                })

    return {"nodes": nodes, "links": links}
