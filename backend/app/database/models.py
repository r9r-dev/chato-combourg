from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.connection import Base

# Couleurs automatiques pour les joueurs
PLAYER_COLORS = [
    "#E53935",  # Rouge
    "#1E88E5",  # Bleu
    "#43A047",  # Vert
    "#FB8C00",  # Orange
    "#8E24AA",  # Violet
    "#00ACC1",  # Cyan
    "#FFB300",  # Jaune
    "#6D4C41",  # Marron
    "#EC407A",  # Rose
    "#5C6BC0",  # Indigo
]


class User(Base):
    """User account (from Pangolin SSO)."""

    __tablename__ = "users"

    id = Column(String, primary_key=True)  # Remote-User from Pangolin
    email = Column(String, nullable=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    players = relationship("Player", back_populates="user", cascade="all, delete-orphan")
    games = relationship("Game", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("Setting", back_populates="user", cascade="all, delete-orphan")


class Player(Base):
    """Player profile (reusable across games)."""

    __tablename__ = "players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)  # Hex color
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="players")
    game_players = relationship("GamePlayer", back_populates="player")

    @classmethod
    def get_next_color(cls, existing_count: int) -> str:
        """Get the next color in the palette based on existing players count."""
        return PLAYER_COLORS[existing_count % len(PLAYER_COLORS)]


class Game(Base):
    """A game session."""

    __tablename__ = "games"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    played_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="games")
    game_players = relationship(
        "GamePlayer",
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="GamePlayer.position",
    )


class GamePlayer(Base):
    """A player's board in a specific game."""

    __tablename__ = "game_players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    position = Column(Integer, nullable=False)  # Order in the game (1-5)
    keys = Column(Integer, default=0)
    coins = Column(Integer, default=0)
    cards = Column(JSON, nullable=False)  # Array of 9 card IDs
    score = Column(Integer, default=0)
    rank = Column(Integer, nullable=True)  # Ranking in the game (1 = winner)

    # Relationships
    game = relationship("Game", back_populates="game_players")
    player = relationship("Player", back_populates="game_players")


class Setting(Base):
    """User settings (key-value pairs)."""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    key = Column(String, nullable=False)
    value = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="settings")

    class Meta:
        unique_together = ("user_id", "key")
