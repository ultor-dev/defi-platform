from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user, require_verified
from app.models.user import User, Wallet
from app.schemas.user import WalletOut

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("/me", response_model=WalletOut)
async def my_wallet(current_user: User = Depends(get_current_user)):
    if not current_user.wallet:
        raise HTTPException(404, "Wallet not found")
    return current_user.wallet


@router.get("/balance")
async def my_balance(
    current_user: User = Depends(require_verified),
    db: AsyncSession = Depends(get_db),
):
    """Баланс ETH и токенов. Работает только для KYC-верифицированных."""
    from app.services.blockchain_service import get_eth_balance, get_token_balance

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
