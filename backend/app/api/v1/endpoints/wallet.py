from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_verified
from app.models.user import User, Wallet
from app.schemas.user import WalletOut
from app.services.wallet_service import generate_wallet, decrypt_private_key
from app.services.blockchain_service import get_eth_balance, get_token_balance, transfer_tokens
from app.utils.wallet import get_primary_wallet

router = APIRouter(prefix="/wallet", tags=["wallet"])


# ── Схемы ─────────────────────────────────────────────────────
class CreateWalletRequest(BaseModel):
    label: str = "New wallet"


class TransferRequest(BaseModel):
    to_address: str
    amount: float
    wallet_id: Optional[int] = None  # если None — берём primary


# ── Хелпер — получить кошелёк по id или primary ──────────────
async def resolve_wallet(
    user: User,
    wallet_id: Optional[int],
    db: AsyncSession,
) -> Wallet:
    if wallet_id:
        result = await db.execute(
            select(Wallet).where(
                Wallet.id == wallet_id,
                Wallet.user_id == user.id,
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(404, "Wallet not found or doesn't belong to you")
        return wallet

    wallet = get_primary_wallet(user)
    if not wallet:
        raise HTTPException(404, "No wallet found")
    return wallet


# ── Все кошельки юзера ────────────────────────────────────────
@router.get("/all", response_model=list[WalletOut])
async def all_wallets(current_user: User = Depends(get_current_user)):
    return current_user.wallets


# ── Primary кошелёк ───────────────────────────────────────────
@router.get("/me", response_model=WalletOut)
async def my_wallet(current_user: User = Depends(get_current_user)):
    wallet = get_primary_wallet(current_user)
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    return wallet


# ── Создать новый кошелёк ─────────────────────────────────────
@router.post("/create", response_model=WalletOut, status_code=201)
async def create_wallet(
    body: CreateWalletRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Wallet).where(Wallet.user_id == current_user.id)
    )
    existing = result.scalars().all()
    if len(existing) >= 5:
        raise HTTPException(400, "Maximum 5 wallets per user")

    wallet_data = generate_wallet()
    wallet = Wallet(
        user_id=current_user.id,
        address=wallet_data["address"],
        encrypted_private_key=wallet_data["encrypted_private_key"],
        label=body.label,
        is_primary=False,
    )
    db.add(wallet)
    await db.commit()
    await db.refresh(wallet)
    return wallet


# ── Сделать кошелёк primary ───────────────────────────────────
@router.patch("/{wallet_id}/primary", response_model=list[WalletOut])
async def set_primary(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Проверяем что кошелёк принадлежит юзеру
    result = await db.execute(
        select(Wallet).where(
            Wallet.user_id == current_user.id
        )
    )
    wallets = result.scalars().all()

    target = next((w for w in wallets if w.id == wallet_id), None)
    if not target:
        raise HTTPException(404, "Wallet not found")

    # Снимаем primary со всех, ставим на нужный
    for w in wallets:
        w.is_primary = (w.id == wallet_id)

    await db.commit()
    return wallets


# ── Переименовать кошелёк ─────────────────────────────────────
@router.patch("/{wallet_id}/label", response_model=WalletOut)
async def rename_wallet(
    wallet_id: int,
    label: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Wallet).where(
            Wallet.id == wallet_id,
            Wallet.user_id == current_user.id,
        )
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(404, "Wallet not found")

    wallet.label = label[:64]
    await db.commit()
    await db.refresh(wallet)
    return wallet


# ── Баланс конкретного кошелька ───────────────────────────────
@router.get("/balance")
async def wallet_balance(
    wallet_id: Optional[int] = None,
    current_user: User = Depends(require_verified),
    db: AsyncSession = Depends(get_db),
):
    wallet = await resolve_wallet(current_user, wallet_id, db)
    return {
        "wallet_id": wallet.id,
        "address": wallet.address,
        "label": wallet.label,
        "is_primary": wallet.is_primary,
        "eth": await get_eth_balance(wallet.address),
        "token": await get_token_balance(wallet.address),
    }


# ── Балансы всех кошельков ────────────────────────────────────
@router.get("/balances")
async def all_balances(current_user: User = Depends(require_verified)):
    result = []
    for w in current_user.wallets:
        result.append({
            "wallet_id": w.id,
            "address": w.address,
            "label": w.label,
            "is_primary": w.is_primary,
            "eth": await get_eth_balance(w.address),
            "token": await get_token_balance(w.address),
        })
    return result


# ── Transfer токенов ──────────────────────────────────────────
@router.post("/transfer")
async def transfer(
    body: TransferRequest,
    current_user: User = Depends(require_verified),
    db: AsyncSession = Depends(get_db),
):
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    wallet = await resolve_wallet(current_user, body.wallet_id, db)

    try:
        private_key = decrypt_private_key(wallet.encrypted_private_key)
        tx_hash = await transfer_tokens(private_key, body.to_address, body.amount)
        return {
            "tx_hash": tx_hash,
            "status": "success",
            "from_address": wallet.address,
            "to_address": body.to_address,
            "amount": body.amount,
        }
    except Exception as e:
        raise HTTPException(400, f"Transfer failed: {str(e)}")


# ── Экспорт приватного ключа ──────────────────────────────────
@router.get("/export-key")
async def export_private_key(
    wallet_id: Optional[int] = None,
    current_user: User = Depends(require_verified),
    db: AsyncSession = Depends(get_db),
):
    wallet = await resolve_wallet(current_user, wallet_id, db)
    private_key = decrypt_private_key(wallet.encrypted_private_key)
    return {
        "wallet_id": wallet.id,
        "address": wallet.address,
        "label": wallet.label,
        "private_key": private_key,
        "warning": "Store this key safely. Never share it with anyone.",
    }
