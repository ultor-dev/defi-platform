from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.kyc import KYCApplication, KYCStatus
from app.schemas.user import KYCSubmitRequest

router = APIRouter(prefix="/kyc", tags=["kyc"])


@router.post("/submit", status_code=201)
async def submit_kyc(
    body: KYCSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(KYCApplication).where(
            KYCApplication.user_id == current_user.id,
            KYCApplication.status.in_([KYCStatus.PENDING, KYCStatus.APPROVED])
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "KYC already submitted or approved")

    app = KYCApplication(
        user_id=current_user.id,
        full_name=body.full_name,
        document_type=body.document_type,
        document_number=body.document_number,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return {
        "id": app.id,
        "status": app.status,
        "submitted_at": app.submitted_at,
    }


@router.get("/status")
async def kyc_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KYCApplication)
        .where(KYCApplication.user_id == current_user.id)
        .order_by(KYCApplication.submitted_at.desc())
        .limit(1)
    )
    app = result.scalar_one_or_none()
    if not app:
        return {"status": "none"}
    return {
        "id": app.id,
        "status": app.status,
        "full_name": app.full_name,
        "document_type": app.document_type,
        "document_number": app.document_number,
        "rejection_reason": app.rejection_reason,
        "submitted_at": app.submitted_at,
        "reviewed_at": app.reviewed_at,
    }


@router.get("/history")
async def kyc_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KYCApplication)
        .where(KYCApplication.user_id == current_user.id)
        .order_by(KYCApplication.submitted_at.desc())
    )
    apps = result.scalars().all()
    return [
        {
            "id": a.id,
            "status": a.status,
            "full_name": a.full_name,
            "document_type": a.document_type,
            "document_number": a.document_number,
            "rejection_reason": a.rejection_reason,
            "submitted_at": a.submitted_at,
            "reviewed_at": a.reviewed_at,
        }
        for a in apps
    ]
