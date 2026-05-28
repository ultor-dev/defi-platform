from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_verified
from app.models.user import User, Wallet
from app.schemas.user import WalletOut
from app.services.wallet_service import decrypt_private_key
from app.services.blockchain_service import (
    get_eth_balance, get_token_balance, transfer_tokens
)

router = APIRouter(prefix="/wallet", tags=["wallet"])


class TransferRequest(BaseModel):
    to_address: str
    amount: float


@router.get("/me", response_model=WalletOut)
async def my_wallet(current_user: User = Depends(get_current_user)):
    if not current_user.wallet:
        raise HTTPException(404, "Wallet not found")
    return current_user.wallet


@router.get("/balance")
async def my_balance(current_user: User = Depends(require_verified)):
    wallet = current_user.wallet
    if not wallet:
        raise HTTPException(404, "Wallet not found")

    eth_balance = await get_eth_balance(wallet.address)
    token_balance = await get_token_balance(wallet.address)

    return {
        "address": wallet.address,
        "eth": eth_balance,
        "token": token_balance,
    }


@router.post("/transfer")
async def transfer(
    body: TransferRequest,
    current_user: User = Depends(require_verified),
):
    """Transfer токенов другому пользователю по адресу."""
    wallet = current_user.wallet
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    try:
        private_key = decrypt_private_key(wallet.encrypted_private_key)
        tx_hash = await transfer_tokens(private_key, body.to_address, body.amount)
        return {"tx_hash": tx_hash, "status": "success"}
    except Exception as e:
        raise HTTPException(400, f"Transfer failed: {str(e)}")


@router.get("/export-key")
async def export_private_key(current_user: User = Depends(require_verified)):
    """
    Экспорт приватного ключа — пользователь забирает self-custody.
    В production показывать только после подтверждения паролем!
    """
    wallet = current_user.wallet
    if not wallet:
        raise HTTPException(404, "Wallet not found")

    private_key = decrypt_private_key(wallet.encrypted_private_key)
    return {
        "address": wallet.address,
        "private_key": private_key,
        "warning": "Store this key safely. Never share it with anyone including this platform.",
    }
