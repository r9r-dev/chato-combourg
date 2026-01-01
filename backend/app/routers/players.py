import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.auth import get_current_user
from app.database import get_db, User, Player, GamePlayer, Game

logger = logging.getLogger(__name__)

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

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str


class PlayerWithStatsResponse(BaseModel):
    """Player response with statistics."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    games_count: int
    wins_count: int
    win_percentage: float
    last_played_at: str | None


@router.get("")
def list_players(
    with_stats: bool = Query(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all players for the current user."""
    players = db.query(Player).filter(Player.user_id == user.id).all()

    if not with_stats:
        return players

    # Get stats for each player
    result = []
    for player in players:
        # Count games
        games_count = (
            db.query(func.count(GamePlayer.id))
            .filter(GamePlayer.player_id == player.id)
            .scalar()
        ) or 0

        # Count wins (rank = 1)
        wins_count = (
            db.query(func.count(GamePlayer.id))
            .filter(GamePlayer.player_id == player.id, GamePlayer.rank == 1)
            .scalar()
        ) or 0

        # Calculate win percentage
        win_percentage = (wins_count / games_count * 100) if games_count > 0 else 0.0

        # Get last played date
        last_game = (
            db.query(Game.played_at)
            .join(GamePlayer, GamePlayer.game_id == Game.id)
            .filter(GamePlayer.player_id == player.id)
            .order_by(Game.played_at.desc())
            .first()
        )

        result.append(
            PlayerWithStatsResponse(
                id=player.id,
                name=player.name,
                color=player.color,
                games_count=games_count,
                wins_count=wins_count,
                win_percentage=round(win_percentage, 1),
                last_played_at=last_game[0].isoformat() if last_game else None,
            )
        )

    return result


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
    logger.info(f"Nouveau joueur: {player.name}")
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

    # Check if player has registered games
    games_count = (
        db.query(func.count(GamePlayer.id))
        .filter(GamePlayer.player_id == player.id)
        .scalar()
    ) or 0

    if games_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de supprimer ce joueur: {games_count} partie(s) enregistrée(s)"
        )

    db.delete(player)
    db.commit()
