from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db, User, Setting

router = APIRouter(prefix="/api", tags=["users"])


class UserResponse(BaseModel):
    """User profile response."""

    id: str
    email: str | None
    name: str | None

    class Config:
        from_attributes = True


class SettingsResponse(BaseModel):
    """User settings response (key-value pairs)."""

    settings: dict[str, str]


class SettingsUpdate(BaseModel):
    """Request to update settings."""

    settings: dict[str, str | None]  # None value = delete key


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    user: User = Depends(get_current_user),
):
    """Get current user profile."""
    return user


@router.get("/settings", response_model=SettingsResponse)
def get_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all user settings."""
    settings = db.query(Setting).filter(Setting.user_id == user.id).all()
    return SettingsResponse(
        settings={s.key: s.value for s in settings if s.value is not None}
    )


@router.put("/settings", response_model=SettingsResponse)
def update_settings(
    data: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user settings. Set value to null to delete a key."""
    for key, value in data.settings.items():
        existing = (
            db.query(Setting)
            .filter(Setting.user_id == user.id, Setting.key == key)
            .first()
        )

        if value is None:
            # Delete setting
            if existing:
                db.delete(existing)
        elif existing:
            # Update existing
            existing.value = value
        else:
            # Create new
            setting = Setting(user_id=user.id, key=key, value=value)
            db.add(setting)

    db.commit()

    # Return updated settings
    settings = db.query(Setting).filter(Setting.user_id == user.id).all()
    return SettingsResponse(
        settings={s.key: s.value for s in settings if s.value is not None}
    )
