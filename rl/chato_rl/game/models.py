"""Game state models - mirrors frontend/src/types/play.ts."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


class ShieldColor(str, Enum):
    """Shield colors matching the game."""

    RED = "red"
    BLUE = "blue"
    GREEN = "green"
    YELLOW = "yellow"
    PURPLE = "purple"
    PINK = "pink"
    ORANGE = "orange"
    BLACK = "black"
    WHITE = "white"


class CardCategory(str, Enum):
    """Card categories."""

    CASTLE = "castle"
    VILLAGE = "village"


class TurnPhase(str, Enum):
    """Turn phases in order."""

    PRE_ACTION = "pre_action"
    BUY = "buy"
    PLACE = "place"
    EFFECT = "effect"
    POST_ACTION = "post_action"
    END = "end"


class ActionType(str, Enum):
    """All possible action types."""

    USE_KEY_ON_LOCK = "use_key_on_lock"
    SPEND_KEY = "spend_key"
    BUY_CARD = "buy_card"
    BUY_CARD_FLIPPED = "buy_card_flipped"
    PLACE_CARD = "place_card"
    APPLY_EFFECT = "apply_effect"
    CHOOSE_EFFECT = "choose_effect"
    END_TURN = "end_turn"


@dataclass(frozen=True)
class Shield:
    """Shield on a card."""

    count: int
    color: ShieldColor


@dataclass
class Card:
    """Static card data from card_attributes.json."""

    id: str  # "001" to "092"
    value: int  # Cost 0-8
    shields: list[Shield] = field(default_factory=list)
    category: CardCategory | None = None
    has_messenger: bool = False
    has_price_reduction: bool = False
    has_lock: bool = False
    has_coin_purse: bool = False
    max_coins: int = 0


@dataclass
class PlacedCard:
    """A card placed on the player's board."""

    card_id: str
    position: int  # 0-8 on 3x3 grid
    coins_on_card: int = 0
    has_key_on_lock: bool = False
    is_flipped: bool = False


@dataclass
class Player:
    """Player state during a game."""

    id: str
    name: str
    color: str
    is_ai: bool = False
    ai_level: Literal["easy", "normal", "hard", "extreme"] | None = None

    # Resources
    gold: int = 15
    keys: int = 2

    # Permanent modifiers
    reduction_castle: int = 0
    reduction_village: int = 0

    # Board state (9 positions, None = empty)
    board: list[PlacedCard | None] = field(default_factory=lambda: [None] * 9)

    def copy(self) -> Player:
        """Create a deep copy of this player."""
        return Player(
            id=self.id,
            name=self.name,
            color=self.color,
            is_ai=self.is_ai,
            ai_level=self.ai_level,
            gold=self.gold,
            keys=self.keys,
            reduction_castle=self.reduction_castle,
            reduction_village=self.reduction_village,
            board=[
                PlacedCard(
                    card_id=c.card_id,
                    position=c.position,
                    coins_on_card=c.coins_on_card,
                    has_key_on_lock=c.has_key_on_lock,
                    is_flipped=c.is_flipped,
                )
                if c
                else None
                for c in self.board
            ],
        )


@dataclass
class CentralBoard:
    """Central board state with available cards."""

    castle_cards: list[str] = field(default_factory=list)  # 3 visible cards
    village_cards: list[str] = field(default_factory=list)  # 3 visible cards
    messenger_location: Literal["castle", "village"] = "castle"

    castle_deck: list[str] = field(default_factory=list)
    village_deck: list[str] = field(default_factory=list)
    castle_discard: list[str] = field(default_factory=list)
    village_discard: list[str] = field(default_factory=list)

    def copy(self) -> CentralBoard:
        """Create a deep copy."""
        return CentralBoard(
            castle_cards=self.castle_cards.copy(),
            village_cards=self.village_cards.copy(),
            messenger_location=self.messenger_location,
            castle_deck=self.castle_deck.copy(),
            village_deck=self.village_deck.copy(),
            castle_discard=self.castle_discard.copy(),
            village_discard=self.village_discard.copy(),
        )


@dataclass
class GameAction:
    """An action to perform in the game."""

    type: ActionType
    player_id: str

    # Optional parameters depending on action type
    card_id: str | None = None
    position: int | None = None
    target_location: Literal["castle", "village"] | None = None
    choice_index: int | None = None
    lock_position: int | None = None
    shift_direction: Literal["left", "right", "up", "down"] | None = None


@dataclass
class PendingEffect:
    """An effect waiting for player input."""

    effect_type: str
    options: list[dict] = field(default_factory=list)


@dataclass
class GameState:
    """Complete game state at any moment."""

    game_id: str
    phase: Literal["setup", "playing", "ended"] = "setup"

    # Players
    players: list[Player] = field(default_factory=list)
    current_player_index: int = 0

    # Turn management
    turn_number: int = 1  # 1-9
    turn_phase: TurnPhase = TurnPhase.PRE_ACTION
    key_used_this_turn: bool = False
    lock_used_this_turn: bool = False

    # Current purchase
    purchased_card: str | None = None
    purchased_card_cost: int = 0

    # Central board
    board: CentralBoard = field(default_factory=CentralBoard)

    # Pending effects requiring player input
    pending_effect: PendingEffect | None = None

    # History
    action_history: list[GameAction] = field(default_factory=list)

    @property
    def current_player(self) -> Player:
        """Get the current player."""
        return self.players[self.current_player_index]

    def copy(self) -> GameState:
        """Create a deep copy of the game state."""
        return GameState(
            game_id=self.game_id,
            phase=self.phase,
            players=[p.copy() for p in self.players],
            current_player_index=self.current_player_index,
            turn_number=self.turn_number,
            turn_phase=self.turn_phase,
            key_used_this_turn=self.key_used_this_turn,
            lock_used_this_turn=self.lock_used_this_turn,
            purchased_card=self.purchased_card,
            purchased_card_cost=self.purchased_card_cost,
            board=self.board.copy(),
            pending_effect=self.pending_effect,
            action_history=self.action_history.copy(),
        )
