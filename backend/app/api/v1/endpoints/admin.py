from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.security import require_admin, get_current_user
from app.models.user import User, UserRole, Wallet
from app.models.kyc import KYCApplication, KYCStatus
from app.models.transaction import Transaction
from app.schemas.user import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total = await db.execute(select(func.count(User.id)))
    pending = await db.execute(
        select(func.count(KYCApplication.id)).where(KYCApplication.status == KYCStatus.PENDING)
    )
    approved = await db.execute(
        select(func.count(KYCApplication.id)).where(KYCApplication.status == KYCStatus.APPROVED)
    )
    rejected = await db.execute(
        select(func.count(KYCApplication.id)).where(KYCApplication.status == KYCStatus.REJECTED)
    )
    active = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    banned = await db.execute(select(func.count(User.id)).where(User.is_active == False))
    verified_users = await db.execute(select(func.count(User.id)).where(User.role == UserRole.USER))

    return {
        "total_users": total.scalar(),
        "active_users": active.scalar(),
        "banned_users": banned.scalar(),
        "verified_users": verified_users.scalar(),
        "pending_kyc": pending.scalar(),
        "approved_kyc": approved.scalar(),
        "rejected_kyc": rejected.scalar(),
    }


@router.get("/users", response_model=list[UserOut])
async def get_all_users(
    moderator: User = Depends(require_admin),
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
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KYCApplication)
        .options(joinedload(KYCApplication.user).joinedload(User.wallets))
        .where(KYCApplication.status == KYCStatus.PENDING)
        .order_by(KYCApplication.submitted_at)
    )
    applications = result.unique().scalars().all()

    out = []
    for app in applications:
        user_data = None
        if app.user:
            primary_wallet = None
            for w in app.user.wallets:
                if w.is_primary:
                    primary_wallet = w
                    break
            if not primary_wallet and app.user.wallets:
                primary_wallet = app.user.wallets[0]

            user_data = {
                "id": app.user.id,
                "uid": app.user.uid,
                "username": app.user.username,
                "email": app.user.email,
                "role": app.user.role.value if hasattr(app.user.role, 'value') else str(app.user.role),
                "is_active": app.user.is_active,
                "email_verified": app.user.email_verified,
            }
            if primary_wallet:
                user_data["wallet_address"] = primary_wallet.address

        out.append({
            "id": app.id,
            "user_id": app.user_id,
            "status": app.status.value if hasattr(app.status, 'value') else str(app.status),
            "full_name": app.full_name,
            "document_type": app.document_type,
            "document_number": app.document_number,
            "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
            "user": user_data,
        })
    return out


@router.post("/kyc/approve/{kyc_id}")
async def approve_kyc(
    kyc_id: int,
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.services.blockchain_service import mint_tokens

    kyc_result = await db.execute(
        select(KYCApplication).where(KYCApplication.id == kyc_id)
    )
    kyc_app = kyc_result.scalar_one_or_none()
    if not kyc_app:
        raise HTTPException(404, "KYC application not found")
    if kyc_app.status != KYCStatus.PENDING:
        raise HTTPException(400, "No pending KYC")

    user_result = await db.execute(
        select(User).options(joinedload(User.wallets)).where(User.id == kyc_app.user_id)
    )
    user = user_result.unique().scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    kyc_app.status = KYCStatus.APPROVED
    kyc_app.reviewed_by = moderator.id
    kyc_app.reviewed_at = datetime.now(timezone.utc)
    user.role = UserRole.USER

    primary_wallet = None
    for w in user.wallets:
        if w.is_primary:
            primary_wallet = w
            break
    if not primary_wallet and user.wallets:
        primary_wallet = user.wallets[0]

    if primary_wallet:
        try:
            await mint_tokens(primary_wallet.address, 100.0)
        except Exception as e:
            print(f"Mint failed: {e}")

    await db.commit()
    return {"status": "approved", "kyc_id": kyc_id, "user_id": user.id}


@router.post("/kyc/reject/{kyc_id}")
async def reject_kyc(
    kyc_id: int,
    reason: str = Query(default="Documents not valid"),
    moderator: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    kyc_result = await db.execute(
        select(KYCApplication).where(KYCApplication.id == kyc_id)
    )
    kyc_app = kyc_result.scalar_one_or_none()
    if not kyc_app:
        raise HTTPException(404, "KYC application not found")
    if kyc_app.status != KYCStatus.PENDING:
        raise HTTPException(400, "No pending KYC")

    kyc_app.status = KYCStatus.REJECTED
    kyc_app.rejection_reason = reason
    kyc_app.reviewed_by = moderator.id
    kyc_app.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    return {"status": "rejected", "kyc_id": kyc_id, "user_id": kyc_app.user_id}


@router.patch("/users/{user_id}")
async def toggle_user(
    user_id: int,
    is_active: bool = Query(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot deactivate yourself")

    user.is_active = is_active
    await db.commit()
    return {"id": user.id, "username": user.username, "is_active": user.is_active}


@router.get("/network/graph")
async def get_network_graph(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Все пользователи с кошельками
    result = await db.execute(
        select(User).options(joinedload(User.wallets))
    )
    users = result.unique().scalars().all()

    nodes = []
    wallet_address_to_user = {}  # address → user info

    for u in users:
        primary = None
        for w in u.wallets:
            if w.is_primary:
                primary = w
                break
        if not primary and u.wallets:
            primary = u.wallets[0]
        if primary:
            role_val = u.role.value if hasattr(u.role, 'value') else str(u.role)
            nodes.append({
                "id": primary.address,
                "user_id": u.id,
                "username": u.username,
                "uid": u.uid,
                "role": role_val,
                "address": primary.address,
            })
            wallet_address_to_user[primary.address] = {
                "id": u.id,
                "username": u.username,
                "role": role_val,
            }

    # Все кошельки для маппинга id → address
    wallet_result = await db.execute(select(Wallet))
    all_wallets = wallet_result.scalars().all()
    wallet_id_to_address = {w.id: w.address for w in all_wallets}

    # Транзакции
    tx_result = await db.execute(select(Transaction))
    transactions = tx_result.scalars().all()

    links = []
    seen = set()
    for tx in transactions:
        from_addr = wallet_id_to_address.get(tx.from_wallet_id) if tx.from_wallet_id else None
        to_addr = wallet_id_to_address.get(tx.to_wallet_id) if tx.to_wallet_id else None
        if from_addr and to_addr and from_addr != to_addr:
            key = tuple(sorted([from_addr, to_addr]))
            if key not in seen:
                seen.add(key)
                links.append({
                    "source": from_addr,
                    "target": to_addr,
                    "amount": str(tx.amount) if tx.amount else "0",
                    "hash": tx.tx_hash or "",
                })

    return {"nodes": nodes, "links": links}
