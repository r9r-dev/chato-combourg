import logging
from collections import defaultdict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.auth import get_current_user
from app.database import get_db, User, Player, Game, GamePlayer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statistics", tags=["statistics"])


class CardStatistic(BaseModel):
    """Statistics for a single card."""

    card_id: str
    play_count: int
    avg_score_impact: float
    win_rate: float


class PlayerCardStatistic(BaseModel):
    """Favorite cards for a player."""

    player_id: int
    player_name: str
    player_color: str
    favorite_cards: list[str]


class StatisticsResponse(BaseModel):
    """Complete statistics response."""

    total_games: int
    most_played_cards: list[CardStatistic]
    least_played_cards: list[CardStatistic]
    win_correlated_cards: list[CardStatistic]
    loss_correlated_cards: list[CardStatistic]
    player_favorites: list[PlayerCardStatistic]


@router.get("", response_model=StatisticsResponse)
def get_statistics(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get statistics for the current user's games."""
    # Get all games for the user
    games = db.query(Game).filter(Game.user_id == user.id).all()
    total_games = len(games)

    if total_games == 0:
        return StatisticsResponse(
            total_games=0,
            most_played_cards=[],
            least_played_cards=[],
            win_correlated_cards=[],
            loss_correlated_cards=[],
            player_favorites=[],
        )

    # Get all game_players with their cards
    game_players = (
        db.query(GamePlayer)
        .join(Game)
        .filter(Game.user_id == user.id)
        .all()
    )

    # Count card plays and win/loss correlation
    card_stats: dict[str, dict] = defaultdict(
        lambda: {"play_count": 0, "wins": 0, "losses": 0, "total_score": 0}
    )

    # Player favorite cards tracking
    player_card_counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for gp in game_players:
        if not gp.cards:
            continue

        is_winner = gp.rank == 1
        is_loser = gp.rank == len([p for p in gp.game.game_players])

        for card_id in gp.cards:
            if not card_id:
                continue
            card_stats[card_id]["play_count"] += 1
            if is_winner:
                card_stats[card_id]["wins"] += 1
            if is_loser:
                card_stats[card_id]["losses"] += 1
            card_stats[card_id]["total_score"] += gp.score

            # Track player's card usage
            player_card_counts[gp.player_id][card_id] += 1

    # Build card statistics list
    card_stat_list = []
    for card_id, stats in card_stats.items():
        play_count = stats["play_count"]
        if play_count == 0:
            continue

        avg_score = stats["total_score"] / play_count
        win_rate = (stats["wins"] / play_count) * 100 if play_count > 0 else 0

        card_stat_list.append(
            CardStatistic(
                card_id=card_id,
                play_count=play_count,
                avg_score_impact=round(avg_score, 1),
                win_rate=round(win_rate, 1),
            )
        )

    # Sort for different rankings
    most_played = sorted(card_stat_list, key=lambda x: x.play_count, reverse=True)[:10]
    least_played = sorted(card_stat_list, key=lambda x: x.play_count)[:10]
    win_correlated = sorted(card_stat_list, key=lambda x: x.win_rate, reverse=True)[:10]
    loss_correlated = sorted(card_stat_list, key=lambda x: x.win_rate)[:10]

    # Build player favorites
    players = db.query(Player).filter(Player.user_id == user.id).all()
    player_lookup = {p.id: p for p in players}

    player_favorites = []
    for player_id, card_counts in player_card_counts.items():
        if player_id not in player_lookup:
            continue

        player = player_lookup[player_id]
        # Get top 3 most played cards for this player
        sorted_cards = sorted(card_counts.items(), key=lambda x: x[1], reverse=True)
        top_cards = [card_id for card_id, count in sorted_cards[:3]]

        player_favorites.append(
            PlayerCardStatistic(
                player_id=player_id,
                player_name=player.name,
                player_color=player.color,
                favorite_cards=top_cards,
            )
        )

    return StatisticsResponse(
        total_games=total_games,
        most_played_cards=most_played,
        least_played_cards=least_played,
        win_correlated_cards=win_correlated,
        loss_correlated_cards=loss_correlated,
        player_favorites=player_favorites,
    )
