from dataclasses import dataclass
from fastapi import Request, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, User


@dataclass
class CurrentUser:
    """Current authenticated user information."""

    id: str
    email: str | None
    name: str | None


def get_current_user_info(request: Request) -> CurrentUser:
    """
    Extract user information from Pangolin headers or dev mode.

    Pangolin forwards these headers when using SSO:
    - Remote-User: Unique user ID
    - Remote-Email: User's email
    - Remote-Name: User's full name
    """
    if settings.dev_mode:
        return CurrentUser(
            id=settings.dev_user_id,
            email=settings.dev_user_email,
            name=settings.dev_user_name,
        )

    user_id = request.headers.get("Remote-User")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Missing Remote-User header.",
        )

    return CurrentUser(
        id=user_id,
        email=request.headers.get("Remote-Email"),
        name=request.headers.get("Remote-Name"),
    )


def get_current_user(
    user_info: CurrentUser = Depends(get_current_user_info),
    db: Session = Depends(get_db),
) -> User:
    """
    Get or create the current user in the database.

    This dependency ensures the user exists in our database
    and updates their info if changed.
    """
    user = db.query(User).filter(User.id == user_info.id).first()

    if user is None:
        user = User(
            id=user_info.id,
            email=user_info.email,
            name=user_info.name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update user info if changed
        updated = False
        if user_info.email and user.email != user_info.email:
            user.email = user_info.email
            updated = True
        if user_info.name and user.name != user_info.name:
            user.name = user_info.name
            updated = True
        if updated:
            db.commit()
            db.refresh(user)

    return user
