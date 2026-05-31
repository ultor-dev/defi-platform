from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date
from app.models.user import UserRole
from app.models.kyc import KYCStatus


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


class KYCSubmitRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    document_type: str = Field(pattern="^(passport|id_card|drivers_license)$")
    document_number: str = Field(min_length=4, max_length=128)


class KYCReviewRequest(BaseModel):
    user_id: int
    approved: bool
    rejection_reason: Optional[str] = None


class WalletOut(BaseModel):
    id: int
    address: str
    label: str
    is_primary: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ProfileOut(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    birth_date: Optional[date] = None
    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    bio: Optional[str] = Field(None, max_length=1000)
    avatar_url: Optional[str] = Field(None, max_length=512)
    country: Optional[str] = Field(None, max_length=64)
    phone: Optional[str] = Field(None, max_length=32)
    telegram: Optional[str] = Field(None, max_length=64)
    birth_date: Optional[date] = None


class KYCApplicationOut(BaseModel):
    id: int
    status: KYCStatus
    full_name: str
    document_type: str
    document_number: str
    rejection_reason: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    uid: str
    email: str
    username: str
    role: UserRole
    email_verified: bool
    is_active: bool
    wallets: List[WalletOut] = []
    profile: Optional[ProfileOut] = None
    created_at: datetime
    model_config = {"from_attributes": True}
