import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.security import hash_password, get_current_user
from app.models.user import User
from app.models.token import UserToken, TokenType
from app.services.email_service import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth-email"])


# ── Schemas ───────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    token: str


# ── Helpers ───────────────────────────────────────────────────
def make_token() -> str:
    return secrets.token_urlsafe(32)


async def get_valid_token(token: str, token_type: TokenType, db: AsyncSession) -> UserToken:
    result = await db.execute(
        select(UserToken).where(
            UserToken.token == token,
            UserToken.token_type == token_type,
            UserToken.used == False,
        )
    )
    ut = result.scalar_one_or_none()
    if not ut:
        raise HTTPException(400, "Invalid or expired token")
    if ut.expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expired")
    return ut


# ── Email verification ────────────────────────────────────────
@router.post("/send-verification")
async def send_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.email_verified:
        raise HTTPException(400, "Email already verified")

    # Инвалидируем старые токены
    result = await db.execute(
        select(UserToken).where(
            UserToken.user_id == current_user.id,
            UserToken.token_type == TokenType.EMAIL_VERIFICATION,
            UserToken.used == False,
        )
    )
    for old in result.scalars().all():
        old.used = True

    token = make_token()
    ut = UserToken(
        user_id=current_user.id,
        token=token,
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(ut)
    await db.commit()

    await send_verification_email(current_user.email, current_user.username, token)
    return {"message": "Verification email sent"}


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    ut = await get_valid_token(body.token, TokenType.EMAIL_VERIFICATION, db)

    result = await db.execute(select(User).where(User.id == ut.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    user.email_verified = True
    ut.used = True
    await db.commit()
    return {"message": "Email verified successfully"}


# ── Password reset ────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Всегда возвращаем 200 — не раскрываем существование email
    if not user:
        return {"message": "If this email exists, a reset link has been sent"}

    # Инвалидируем старые токены
    result = await db.execute(
        select(UserToken).where(
            UserToken.user_id == user.id,
            UserToken.token_type == TokenType.PASSWORD_RESET,
            UserToken.used == False,
        )
    )
    for old in result.scalars().all():
        old.used = True

    token = make_token()
    ut = UserToken(
        user_id=user.id,
        token=token,
        token_type=TokenType.PASSWORD_RESET,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(ut)
    await db.commit()

    await send_password_reset_email(user.email, user.username, token)
    return {"message": "If this email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    ut = await get_valid_token(body.token, TokenType.PASSWORD_RESET, db)

    result = await db.execute(select(User).where(User.id == ut.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    user.hashed_password = hash_password(body.new_password)
    ut.used = True
    await db.commit()
    return {"message": "Password reset successfully"}
