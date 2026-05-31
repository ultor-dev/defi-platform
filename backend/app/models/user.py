import enum
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    Enum as SAEnum, Text, ForeignKey, Date
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    USER = "USER"
    ADMIN = "ADMIN"


def generate_uid() -> str:
    chars = string.ascii_lowercase + string.digits
    return '@' + ''.join(secrets.choice(chars) for _ in range(8))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(16), unique=True, index=True, nullable=False, default=generate_uid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(64), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    email_verified = Column(Boolean, default=False)
    role = Column(SAEnum(UserRole, name="userrole", create_type=False), default=UserRole.UNVERIFIED, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="user", uselist=False)
    wallets = relationship("Wallet", back_populates="user")
    kyc_applications = relationship("KYCApplication", foreign_keys="KYCApplication.user_id", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(512), nullable=True)
    country = Column(String(64), nullable=True)
    phone = Column(String(32), nullable=True)
    telegram = Column(String(64), nullable=True)
    birth_date = Column(Date, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="profile")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    address = Column(String(42), unique=True, nullable=False)
    label = Column(String(64), default="Main wallet")
    encrypted_private_key = Column(Text, nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="wallets")
    sent_transactions = relationship("Transaction", foreign_keys="Transaction.from_wallet_id", back_populates="from_wallet")
    received_transactions = relationship("Transaction", foreign_keys="Transaction.to_wallet_id", back_populates="to_wallet")
