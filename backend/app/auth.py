import logging
from dataclasses import dataclass
from fastapi import Request, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, User
from app.exceptions import MissingAuthHeaderError

logger = logging.getLogger(__name__)


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
        raise MissingAuthHeaderError()

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
        logger.info(f"Nouvel utilisateur: {user_info.email or user_info.id}")
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


def get_current_user_info_optional(request: Request) -> CurrentUser | None:
    """
    Extract user information from Pangolin headers or dev mode.
    Returns None if not authenticated (no error raised).
    """
    if settings.dev_mode:
        return CurrentUser(
            id=settings.dev_user_id,
            email=settings.dev_user_email,
            name=settings.dev_user_name,
        )

    user_id = request.headers.get("Remote-User")
    if not user_id:
        return None

    return CurrentUser(
        id=user_id,
        email=request.headers.get("Remote-Email"),
        name=request.headers.get("Remote-Name"),
    )


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    """
    Get the current user if authenticated, None otherwise.
    Does not create the user if they don't exist.
    """
    user_info = get_current_user_info_optional(request)
    if user_info is None:
        return None

    return db.query(User).filter(User.id == user_info.id).first()
