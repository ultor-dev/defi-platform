import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    Enum as SAEnum, Text, ForeignKey
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    USER = "USER"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"


class KYCStatus(str, enum.Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(64), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    role = Column(SAEnum(UserRole, name="userrole", create_type=False), default=UserRole.UNVERIFIED, nullable=False)
    is_active = Column(Boolean, default=True)

    kyc_status = Column(SAEnum(KYCStatus, name="kycstatus", create_type=False), default=KYCStatus.NONE)
    kyc_full_name = Column(String(255), nullable=True)
    kyc_document_type = Column(String(64), nullable=True)
    kyc_document_number = Column(String(128), nullable=True)
    kyc_submitted_at = Column(DateTime(timezone=True), nullable=True)
    kyc_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    kyc_rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    wallet = relationship("Wallet", back_populates="user", uselist=False)
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    address = Column(String(42), unique=True, nullable=False)
    encrypted_private_key = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="wallet")
