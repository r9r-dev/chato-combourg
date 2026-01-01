"""Game service for business logic related to games.

Ce module contient la logique métier pour la gestion des parties :
- Calcul des rangs
- Création de parties avec joueurs
"""

import logging
from datetime import datetime
from typing import TypedDict

from sqlalchemy.orm import Session

from app.database import Game, GamePlayer, Player, User
from app.queries import validate_players_ownership

logger = logging.getLogger(__name__)


class PlayerScore(TypedDict):
    """Structure pour le score d'un joueur."""
    player_id: int
    score: int
    coins: int  # Pour le tiebreaker


def compute_ranks(
    scores: list[PlayerScore],
    use_coins_tiebreaker: bool = True
) -> list[int]:
    """
    Calcule les rangs basés sur les scores (plus haut = rang 1).

    Args:
        scores: Liste de PlayerScore avec player_id, score, et coins
        use_coins_tiebreaker: Si True, utilise les pièces restantes pour départager

    Returns:
        list[int]: Liste des rangs dans l'ordre des scores d'entrée.
                   Les joueurs à égalité partagent le même rang.

    Example:
        >>> scores = [
        ...     {"player_id": 1, "score": 100, "coins": 5},
        ...     {"player_id": 2, "score": 100, "coins": 3},
        ...     {"player_id": 3, "score": 80, "coins": 0},
        ... ]
        >>> compute_ranks(scores)
        [1, 2, 3]  # Joueur 1 gagne avec plus de pièces
        >>> compute_ranks(scores, use_coins_tiebreaker=False)
        [1, 1, 2]  # Joueurs 1 et 2 à égalité
    """
    if not scores:
        return []

    # Trier par score (desc), puis par coins (desc) si tiebreaker activé
    if use_coins_tiebreaker:
        sorted_indices = sorted(
            range(len(scores)),
            key=lambda i: (scores[i]["score"], scores[i]["coins"]),
            reverse=True
        )
    else:
        sorted_indices = sorted(
            range(len(scores)),
            key=lambda i: scores[i]["score"],
            reverse=True
        )

    ranks = [0] * len(scores)
    current_rank = 1

    for i, idx in enumerate(sorted_indices):
        if i == 0:
            ranks[idx] = current_rank
        else:
            prev_idx = sorted_indices[i - 1]

            # Vérifier l'égalité
            if use_coins_tiebreaker:
                is_tie = (
                    scores[idx]["score"] == scores[prev_idx]["score"] and
                    scores[idx]["coins"] == scores[prev_idx]["coins"]
                )
            else:
                is_tie = scores[idx]["score"] == scores[prev_idx]["score"]

            if is_tie:
                ranks[idx] = ranks[prev_idx]
            else:
                current_rank = i + 1
                ranks[idx] = current_rank

    return ranks


class GamePlayerData(TypedDict, total=False):
    """Données d'un joueur pour créer une partie."""
    player_id: int
    keys: int
    coins: int
    cards: list[str]
    card_scores: list[int] | None
    score: int
    is_legacy: bool


def create_game_with_players(
    db: Session,
    user: User,
    players_data: list[GamePlayerData],
    played_at: datetime | None = None,
    notes: str | None = None,
    use_coins_tiebreaker: bool = True,
) -> tuple[Game, list[GamePlayer], dict[int, Player]]:
    """
    Crée une partie avec les données des joueurs.

    Args:
        db: Session de base de données
        user: Utilisateur propriétaire de la partie
        players_data: Liste des données de joueurs
        played_at: Date de la partie (défaut: maintenant)
        notes: Notes optionnelles sur la partie
        use_coins_tiebreaker: Utiliser les pièces pour départager les égalités

    Returns:
        tuple: (Game créée, liste des GamePlayer, dict player_id -> Player)

    Raises:
        InvalidPlayerOwnershipError: Si des joueurs sont invalides
    """
    # Valider que tous les joueurs appartiennent à l'utilisateur
    player_ids = [p["player_id"] for p in players_data]
    player_lookup = validate_players_ownership(db, player_ids, user.id)

    # Calculer les rangs
    scores: list[PlayerScore] = [
        {
            "player_id": p["player_id"],
            "score": p.get("score", 0),
            "coins": p.get("coins", 0),
        }
        for p in players_data
    ]
    ranks = compute_ranks(scores, use_coins_tiebreaker)

    # Créer la partie
    game = Game(
        user_id=user.id,
        played_at=played_at or datetime.utcnow(),
        notes=notes,
    )
    db.add(game)
    db.flush()  # Obtenir game.id

    # Créer les GamePlayer
    game_players = []
    for position, (player_data, rank) in enumerate(zip(players_data, ranks), start=1):
        gp = GamePlayer(
            game_id=game.id,
            player_id=player_data["player_id"],
            position=position,
            keys=player_data.get("keys", 0),
            coins=player_data.get("coins", 0),
            cards=player_data.get("cards", []),
            card_scores=player_data.get("card_scores"),
            score=player_data.get("score", 0),
            rank=rank,
            is_legacy=player_data.get("is_legacy", False),
        )
        db.add(gp)
        game_players.append(gp)

    db.commit()
    db.refresh(game)

    # Logger la création
    winner = next((gp for gp in game_players if ranks[game_players.index(gp)] == 1), None)
    winner_name = player_lookup[winner.player_id].name if winner else "?"
    player_names = [player_lookup[gp.player_id].name for gp in game_players]
    logger.info(f"Partie: {', '.join(player_names)} -> {winner_name} gagne ({winner.score if winner else 0} pts)")

    return game, game_players, player_lookup


def build_game_response(
    game: Game,
    game_players: list[GamePlayer],
    player_lookup: dict[int, Player],
) -> dict:
    """
    Construit la réponse JSON pour une partie.

    Args:
        game: La partie
        game_players: Liste des GamePlayer
        player_lookup: Mapping player_id -> Player

    Returns:
        dict: Données formatées pour GameResponse
    """
    return {
        "id": game.id,
        "played_at": game.played_at,
        "notes": game.notes,
        "players": [
            {
                "id": gp.id,
                "player_id": gp.player_id,
                "player_name": player_lookup[gp.player_id].name,
                "player_color": player_lookup[gp.player_id].color,
                "position": gp.position,
                "keys": gp.keys,
                "coins": gp.coins,
                "cards": gp.cards,
                "card_scores": gp.card_scores,
                "score": gp.score,
                "rank": gp.rank,
                "is_legacy": gp.is_legacy or False,
            }
            for gp in game_players
        ],
    }
