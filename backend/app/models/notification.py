import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base


class NotificationType(str, enum.Enum):
    KYC_APPROVED = "KYC_APPROVED"
    KYC_REJECTED = "KYC_REJECTED"
    TRANSFER_RECEIVED = "TRANSFER_RECEIVED"
    TRANSFER_SENT = "TRANSFER_SENT"
    SYSTEM = "SYSTEM"
    NEW_MESSAGE = "NEW_MESSAGE"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(SAEnum(NotificationType, name="notiftype"), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    action_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")
