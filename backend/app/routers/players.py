from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db, User, Player

router = APIRouter(prefix="/api/players", tags=["players"])


class PlayerCreate(BaseModel):
    """Request to create a new player."""

    name: str


class PlayerUpdate(BaseModel):
    """Request to update a player."""

    name: str | None = None
    color: str | None = None


class PlayerResponse(BaseModel):
    """Player response."""

    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[PlayerResponse])
def list_players(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all players for the current user."""
    return db.query(Player).filter(Player.user_id == user.id).all()


@router.post("", response_model=PlayerResponse, status_code=201)
def create_player(
    data: PlayerCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new player."""
    # Count existing players for color assignment
    existing_count = db.query(Player).filter(Player.user_id == user.id).count()

    player = Player(
        user_id=user.id,
        name=data.name,
        color=Player.get_next_color(existing_count),
    )
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(
    player_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific player."""
    player = (
        db.query(Player)
        .filter(Player.id == player_id, Player.user_id == user.id)
        .first()
    )
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(
    player_id: int,
    data: PlayerUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a player."""
    player = (
        db.query(Player)
        .filter(Player.id == player_id, Player.user_id == user.id)
        .first()
    )
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if data.name is not None:
        player.name = data.name
    if data.color is not None:
        player.color = data.color

    db.commit()
    db.refresh(player)
    return player


@router.delete("/{player_id}", status_code=204)
def delete_player(
    player_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a player."""
    player = (
        db.query(Player)
        .filter(Player.id == player_id, Player.user_id == user.id)
        .first()
    )
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    db.delete(player)
    db.commit()
