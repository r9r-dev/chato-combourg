"""Game management endpoints."""

import csv
import io
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db, User, Game, GamePlayer
from app.queries import get_game_or_404
from app.services.game_service import (
    create_game_with_players,
    build_game_response,
    GamePlayerData,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/games", tags=["games"])


# =============================================================================
# Pydantic Models
# =============================================================================


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
    source: str = "scan"  # 'scan', 'legacy', 'application'

    @field_validator("players")
    @classmethod
    def validate_players(cls, v):
        if len(v) < 2 or len(v) > 5:
            raise ValueError("A game must have between 2 and 5 players")
        return v

    @field_validator("source")
    @classmethod
    def validate_source(cls, v):
        allowed = {"scan", "legacy", "application"}
        if v not in allowed:
            raise ValueError(f"source must be one of: {', '.join(allowed)}")
        return v


class GamePlayerResponse(BaseModel):
    """Player data in a game response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    player_id: int
    player_name: str
    player_color: str
    position: int
    keys: int
    coins: int
    cards: list[str]
    card_scores: list[int] | None = None
    score: int
    rank: int | None
    is_legacy: bool = False


class GameResponse(BaseModel):
    """Game response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    played_at: datetime
    notes: str | None
    source: str = "scan"  # 'scan', 'legacy', 'application'
    players: list[GamePlayerResponse]


class GamePlayerSummary(BaseModel):
    """Player summary for game list view."""

    player_name: str
    player_color: str
    score: int
    rank: int | None


class GameListItem(BaseModel):
    """Simplified game for list view."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    played_at: datetime
    notes: str | None
    source: str = "scan"  # 'scan', 'legacy', 'application'
    player_count: int
    winner_name: str | None
    winner_score: int | None
    is_legacy: bool = False
    players: list[GamePlayerSummary] = []


class ManualGamePlayerCreate(BaseModel):
    """Player data for manual game creation (simplified)."""

    player_id: int
    score: int


class ManualGameCreate(BaseModel):
    """Request to create a manual game (scores only, no cards)."""

    players: list[ManualGamePlayerCreate]  # 2-5 players
    notes: str | None = None
    played_at: datetime | None = None

    @field_validator("players")
    @classmethod
    def validate_players(cls, v):
        if len(v) < 2 or len(v) > 5:
            raise ValueError("A game must have between 2 and 5 players")
        return v


class LegacyPlayerCreate(BaseModel):
    """Player data for legacy game creation (with card scores)."""

    player_id: int
    keys: int = 0
    card_scores: list[int]  # 9 individual card scores

    @field_validator("card_scores")
    @classmethod
    def validate_card_scores(cls, v):
        if len(v) != 9:
            raise ValueError("card_scores must contain exactly 9 scores")
        return v


class LegacyGameCreate(BaseModel):
    """Request to create a legacy game (card scores only, no card identification)."""

    players: list[LegacyPlayerCreate]  # 2-5 players
    notes: str | None = None
    played_at: datetime | None = None

    @field_validator("players")
    @classmethod
    def validate_players(cls, v):
        if len(v) < 2 or len(v) > 5:
            raise ValueError("A game must have between 2 and 5 players")
        return v


# =============================================================================
# Endpoints
# =============================================================================


@router.get("", response_model=list[GameListItem])
def list_games(
    limit: int = 20,
    offset: int = 0,
    player_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List games for the current user (most recent first).

    Optionally filter by player_id to show only games where that player participated.
    """
    query = db.query(Game).filter(Game.user_id == user.id)

    # Filter by player if specified
    if player_id is not None:
        query = query.join(GamePlayer).filter(GamePlayer.player_id == player_id)

    games = query.order_by(Game.played_at.desc()).offset(offset).limit(limit).all()

    result = []
    for game in games:
        winner = None
        players_summary = []

        # Sort by rank for display
        sorted_players = sorted(game.game_players, key=lambda gp: (gp.rank or 999, gp.position))

        for gp in sorted_players:
            if gp.rank == 1:
                winner = gp

            players_summary.append(
                GamePlayerSummary(
                    player_name=gp.player.name,
                    player_color=gp.player.color,
                    score=gp.score,
                    rank=gp.rank,
                )
            )

        # Check if any player is legacy (game is legacy if any player is)
        is_legacy = any(gp.is_legacy for gp in game.game_players)

        result.append(
            GameListItem(
                id=game.id,
                played_at=game.played_at,
                notes=game.notes,
                source=game.source or "scan",
                player_count=len(game.game_players),
                winner_name=winner.player.name if winner else None,
                winner_score=winner.score if winner else None,
                is_legacy=is_legacy,
                players=players_summary,
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
    players_data: list[GamePlayerData] = [
        {
            "player_id": p.player_id,
            "keys": p.keys,
            "coins": p.coins,
            "cards": p.cards,
            "score": p.score,
        }
        for p in data.players
    ]

    game, game_players, player_lookup = create_game_with_players(
        db=db,
        user=user,
        players_data=players_data,
        played_at=data.played_at,
        notes=data.notes,
        use_coins_tiebreaker=True,
        source=data.source,
    )

    return GameResponse(**build_game_response(game, game_players, player_lookup))


@router.get("/export")
def export_games(
    format: str = Query("json", pattern="^(json|csv)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export all games for the current user."""
    games = (
        db.query(Game)
        .filter(Game.user_id == user.id)
        .order_by(Game.played_at.desc())
        .all()
    )

    # Build export data
    export_data = []
    for game in games:
        game_data = {
            "id": game.id,
            "played_at": game.played_at.isoformat(),
            "notes": game.notes,
            "players": [],
        }
        for gp in game.game_players:
            game_data["players"].append({
                "player_name": gp.player.name,
                "position": gp.position,
                "keys": gp.keys,
                "coins": gp.coins,
                "cards": gp.cards,
                "score": gp.score,
                "rank": gp.rank,
            })
        export_data.append(game_data)

    if format == "json":
        content = json.dumps(export_data, indent=2, ensure_ascii=False)
        return StreamingResponse(
            io.StringIO(content),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=games.json"},
        )
    else:
        # CSV format - flatten players into separate rows
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "game_id", "played_at", "notes",
            "player_name", "position", "keys", "coins", "score", "rank", "cards"
        ])
        for game_data in export_data:
            for player in game_data["players"]:
                writer.writerow([
                    game_data["id"],
                    game_data["played_at"],
                    game_data["notes"] or "",
                    player["player_name"],
                    player["position"],
                    player["keys"],
                    player["coins"],
                    player["score"],
                    player["rank"],
                    ";".join(player["cards"]) if player["cards"] else "",
                ])
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=games.csv"},
        )


@router.post("/manual", response_model=GameResponse, status_code=201)
def create_manual_game(
    data: ManualGameCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a manual game (scores only, no cards/keys/coins)."""
    players_data: list[GamePlayerData] = [
        {
            "player_id": p.player_id,
            "keys": 0,
            "coins": 0,
            "cards": [],
            "score": p.score,
        }
        for p in data.players
    ]

    game, game_players, player_lookup = create_game_with_players(
        db=db,
        user=user,
        players_data=players_data,
        played_at=data.played_at,
        notes=data.notes,
        use_coins_tiebreaker=False,  # Pas de tiebreaker pour les parties manuelles
    )

    return GameResponse(**build_game_response(game, game_players, player_lookup))


@router.get("/{game_id}", response_model=GameResponse)
def get_game(
    game_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific game with all player boards."""
    game = get_game_or_404(db, game_id, user.id)

    # Build player lookup from game players
    player_lookup = {gp.player_id: gp.player for gp in game.game_players}

    return GameResponse(**build_game_response(game, list(game.game_players), player_lookup))


@router.delete("/{game_id}", status_code=204)
def delete_game(
    game_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a game."""
    game = get_game_or_404(db, game_id, user.id)
    db.delete(game)
    db.commit()


@router.post("/legacy", response_model=GameResponse, status_code=201)
def create_legacy_game(
    data: LegacyGameCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a legacy game with card scores only (no card identification).

    Legacy games store individual card scores and keys, but no card IDs.
    They are flagged as is_legacy=True and excluded from card-based statistics.
    """
    players_data: list[GamePlayerData] = [
        {
            "player_id": p.player_id,
            "keys": p.keys,
            "coins": 0,
            "cards": [],
            "card_scores": p.card_scores,
            "score": sum(p.card_scores) + p.keys,
            "is_legacy": True,
        }
        for p in data.players
    ]

    game, game_players, player_lookup = create_game_with_players(
        db=db,
        user=user,
        players_data=players_data,
        played_at=data.played_at,
        notes=data.notes,
        use_coins_tiebreaker=False,  # Pas de tiebreaker pour les parties legacy
        source="legacy",
    )

    return GameResponse(**build_game_response(game, game_players, player_lookup))
