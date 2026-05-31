import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class KYCStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class KYCApplication(Base):
    __tablename__ = "kyc_applications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(KYCStatus, name="kycstatus"), default=KYCStatus.PENDING)
    full_name = Column(String(255), nullable=False)
    document_type = Column(String(64), nullable=False)
    document_number = Column(String(128), nullable=False)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="kyc_applications")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
