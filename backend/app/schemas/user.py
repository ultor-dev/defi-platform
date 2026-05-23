from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.models.user import UserRole, KYCStatus


# ── Auth ──────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── KYC ───────────────────────────────────────────────────────────
class KYCSubmitRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    document_type: str = Field(pattern="^(passport|id_card|drivers_license)$")
    document_number: str = Field(min_length=4, max_length=128)


class KYCReviewRequest(BaseModel):
    user_id: int
    approved: bool
    rejection_reason: Optional[str] = None


# ── User ──────────────────────────────────────────────────────────
class WalletOut(BaseModel):
    address: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    role: UserRole
    kyc_status: KYCStatus
    wallet: Optional[WalletOut] = None
    created_at: datetime

    model_config = {"from_attributes": True}
