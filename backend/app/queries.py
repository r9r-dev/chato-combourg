"""Database query helpers with error handling.

Ce module fournit des fonctions utilitaires pour récupérer des entités
de la base de données avec gestion automatique des erreurs 404.
"""

from sqlalchemy.orm import Session

from app.database import Player, Game, GamePlayer
from app.exceptions import (
    PlayerNotFoundError,
    GameNotFoundError,
    InvalidPlayerOwnershipError,
)


def get_player_or_404(db: Session, player_id: int, user_id: str) -> Player:
    """
    Récupère un joueur appartenant à l'utilisateur ou lève une 404.

    Args:
        db: Session de base de données
        player_id: ID du joueur
        user_id: ID de l'utilisateur propriétaire

    Returns:
        Player: Le joueur trouvé

    Raises:
        PlayerNotFoundError: Si le joueur n'existe pas ou n'appartient pas à l'utilisateur
    """
    player = (
        db.query(Player)
        .filter(Player.id == player_id, Player.user_id == user_id)
        .first()
    )
    if not player:
        raise PlayerNotFoundError()
    return player


def get_game_or_404(db: Session, game_id: int, user_id: str) -> Game:
    """
    Récupère une partie appartenant à l'utilisateur ou lève une 404.

    Args:
        db: Session de base de données
        game_id: ID de la partie
        user_id: ID de l'utilisateur propriétaire

    Returns:
        Game: La partie trouvée

    Raises:
        GameNotFoundError: Si la partie n'existe pas ou n'appartient pas à l'utilisateur
    """
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.user_id == user_id)
        .first()
    )
    if not game:
        raise GameNotFoundError()
    return game


def validate_players_ownership(
    db: Session,
    player_ids: list[int],
    user_id: str
) -> dict[int, Player]:
    """
    Valide que tous les joueurs appartiennent à l'utilisateur.

    Args:
        db: Session de base de données
        player_ids: Liste des IDs de joueurs à valider
        user_id: ID de l'utilisateur propriétaire

    Returns:
        dict[int, Player]: Mapping player_id -> Player

    Raises:
        InvalidPlayerOwnershipError: Si certains joueurs sont invalides
    """
    players = (
        db.query(Player)
        .filter(Player.id.in_(player_ids), Player.user_id == user_id)
        .all()
    )

    if len(players) != len(player_ids):
        found_ids = {p.id for p in players}
        invalid_ids = [pid for pid in player_ids if pid not in found_ids]
        raise InvalidPlayerOwnershipError(invalid_ids)

    return {p.id: p for p in players}


def count_player_games(db: Session, player_id: int) -> int:
    """
    Compte le nombre de parties auxquelles un joueur a participé.

    Args:
        db: Session de base de données
        player_id: ID du joueur

    Returns:
        int: Nombre de parties
    """
    from sqlalchemy import func
    return (
        db.query(func.count(GamePlayer.id))
        .filter(GamePlayer.player_id == player_id)
        .scalar()
    ) or 0
