from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Profile
from app.schemas.user import ProfileUpdateRequest, ProfileOut

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.profile:
        return current_user.profile
    # Создаём если нет
    profile = Profile(user_id=current_user.id)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.patch("", response_model=ProfileOut)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)
        await db.flush()
    
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user.profile, key, value)
    
    await db.commit()
    await db.refresh(current_user.profile)
    return current_user.profile
