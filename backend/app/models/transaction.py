import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum, Text, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base


class TransactionType(str, enum.Enum):
    TRANSFER = "TRANSFER"
    MINT = "MINT"
    BURN = "BURN"


class TransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    from_wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=True)
    to_wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=True)
    tx_hash = Column(String(66), unique=True, nullable=True)
    amount = Column(Numeric(36, 18), nullable=False)
    token_symbol = Column(String(16), default="DPT")
    status = Column(SAEnum(TransactionStatus, name="txstatus"), default=TransactionStatus.PENDING)
    tx_type = Column(SAEnum(TransactionType, name="txtype"), default=TransactionType.TRANSFER)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    from_wallet = relationship("Wallet", foreign_keys=[from_wallet_id], back_populates="sent_transactions")
    to_wallet = relationship("Wallet", foreign_keys=[to_wallet_id], back_populates="received_transactions")
