from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db, User, Player, Game, GamePlayer

router = APIRouter(prefix="/api/games", tags=["games"])


class GamePlayerCreate(BaseModel):
    """Player data for game creation."""

    player_id: int
    keys: int = 0
    coins: int = 0
    cards: list[str]  # 9 card IDs
    score: int = 0

    @field_validator("cards")
    @classmethod
    def validate_cards(cls, v):
        if len(v) != 9:
            raise ValueError("cards must contain exactly 9 card IDs")
        return v


class GameCreate(BaseModel):
    """Request to create a new game."""

    players: list[GamePlayerCreate]  # 2-5 players
    notes: str | None = None
    played_at: datetime | None = None

    @field_validator("players")
    @classmethod
    def validate_players(cls, v):
        if len(v) < 2 or len(v) > 5:
            raise ValueError("A game must have between 2 and 5 players")
        return v


class GamePlayerResponse(BaseModel):
    """Player data in a game response."""

    id: int
    player_id: int
    player_name: str
    player_color: str
    position: int
    keys: int
    coins: int
    cards: list[str]
    score: int
    rank: int | None

    class Config:
        from_attributes = True


class GameResponse(BaseModel):
    """Game response."""

    id: int
    played_at: datetime
    notes: str | None
    players: list[GamePlayerResponse]

    class Config:
        from_attributes = True


class GameListItem(BaseModel):
    """Simplified game for list view."""

    id: int
    played_at: datetime
    notes: str | None
    player_count: int
    winner_name: str | None
    winner_score: int | None

    class Config:
        from_attributes = True


def compute_ranks(players: list[GamePlayerCreate]) -> list[int]:
    """Compute ranks based on scores (highest score = rank 1)."""
    sorted_indices = sorted(
        range(len(players)), key=lambda i: players[i].score, reverse=True
    )
    ranks = [0] * len(players)
    for rank, idx in enumerate(sorted_indices, start=1):
        ranks[idx] = rank
    return ranks


@router.get("", response_model=list[GameListItem])
def list_games(
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List games for the current user (most recent first)."""
    games = (
        db.query(Game)
        .filter(Game.user_id == user.id)
        .order_by(Game.played_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for game in games:
        winner = None
        for gp in game.game_players:
            if gp.rank == 1:
                winner = gp
                break

        result.append(
            GameListItem(
                id=game.id,
                played_at=game.played_at,
                notes=game.notes,
                player_count=len(game.game_players),
                winner_name=winner.player.name if winner else None,
                winner_score=winner.score if winner else None,
            )
        )

    return result


@router.post("", response_model=GameResponse, status_code=201)
def create_game(
    data: GameCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new game with player boards."""
    # Validate all players belong to the user
    player_ids = [p.player_id for p in data.players]
    players = (
        db.query(Player)
        .filter(Player.id.in_(player_ids), Player.user_id == user.id)
        .all()
    )
    if len(players) != len(player_ids):
        raise HTTPException(status_code=400, detail="Invalid player IDs")

    # Create player lookup for response
    player_lookup = {p.id: p for p in players}

    # Compute ranks
    ranks = compute_ranks(data.players)

    # Create game
    game = Game(
        user_id=user.id,
        played_at=data.played_at or datetime.utcnow(),
        notes=data.notes,
    )
    db.add(game)
    db.flush()  # Get game.id

    # Create game players
    game_players = []
    for position, (player_data, rank) in enumerate(zip(data.players, ranks), start=1):
        gp = GamePlayer(
            game_id=game.id,
            player_id=player_data.player_id,
            position=position,
            keys=player_data.keys,
            coins=player_data.coins,
            cards=player_data.cards,
            score=player_data.score,
            rank=rank,
        )
        db.add(gp)
        game_players.append(gp)

    db.commit()
    db.refresh(game)

    # Build response
    return GameResponse(
        id=game.id,
        played_at=game.played_at,
        notes=game.notes,
        players=[
            GamePlayerResponse(
                id=gp.id,
                player_id=gp.player_id,
                player_name=player_lookup[gp.player_id].name,
                player_color=player_lookup[gp.player_id].color,
                position=gp.position,
                keys=gp.keys,
                coins=gp.coins,
                cards=gp.cards,
                score=gp.score,
                rank=gp.rank,
            )
            for gp in game_players
        ],
    )


@router.get("/{game_id}", response_model=GameResponse)
def get_game(
    game_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific game with all player boards."""
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.user_id == user.id)
        .first()
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    return GameResponse(
        id=game.id,
        played_at=game.played_at,
        notes=game.notes,
        players=[
            GamePlayerResponse(
                id=gp.id,
                player_id=gp.player_id,
                player_name=gp.player.name,
                player_color=gp.player.color,
                position=gp.position,
                keys=gp.keys,
                coins=gp.coins,
                cards=gp.cards,
                score=gp.score,
                rank=gp.rank,
            )
            for gp in game.game_players
        ],
    )


@router.delete("/{game_id}", status_code=204)
def delete_game(
    game_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a game."""
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.user_id == user.id)
        .first()
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    db.delete(game)
    db.commit()
