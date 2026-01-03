"""
Game Engine - Python port of frontend/src/services/play/gameEngine.ts

Handles:
- Game initialization
- Action validation and execution
- Turn management
- End game detection
"""

from __future__ import annotations

import math
import random
import uuid
from typing import Literal

from .cards import CardDatabase
from .models import (
    ActionType,
    CardCategory,
    CentralBoard,
    GameAction,
    GameState,
    PlacedCard,
    Player,
    TurnPhase,
)

# =============================================================================
# Constants
# =============================================================================

INITIAL_GOLD = 15
INITIAL_KEYS = 2
FLIPPED_VILLAGE_ID = "089"
FLIPPED_CASTLE_ID = "090"

# Adjacency map for 3x3 grid (orthogonal only)
ADJACENCY_MAP: dict[int, list[int]] = {
    0: [1, 3],
    1: [0, 2, 4],
    2: [1, 5],
    3: [0, 4, 6],
    4: [1, 3, 5, 7],
    5: [2, 4, 8],
    6: [3, 7],
    7: [4, 6, 8],
    8: [5, 7],
}

ShiftDirection = Literal["left", "right", "up", "down"]


# =============================================================================
# Game Engine
# =============================================================================


class GameEngine:
    """Main game engine for Chateau Combo."""

    def __init__(self, seed: int | None = None):
        """Initialize engine with optional random seed."""
        self.cards = CardDatabase()
        self.rng = random.Random(seed)

    def create_game(
        self,
        player_configs: list[dict],
        seed: int | None = None,
    ) -> GameState:
        """Create a new game.

        Args:
            player_configs: List of player configurations with keys:
                - name: str
                - color: str
                - is_ai: bool (default False)
                - ai_level: str (optional, for AI players)
            seed: Random seed for reproducibility
        """
        if seed is not None:
            self.rng = random.Random(seed)

        game_id = str(uuid.uuid4())

        # Create players
        players: list[Player] = []
        for i, config in enumerate(player_configs):
            player_id = f"ai-{config.get('ai_level', 'extreme')}-{i}" if config.get("is_ai") else f"human-{i}"
            players.append(
                Player(
                    id=player_id,
                    name=config["name"],
                    color=config["color"],
                    is_ai=config.get("is_ai", False),
                    ai_level=config.get("ai_level"),
                    gold=INITIAL_GOLD,
                    keys=INITIAL_KEYS,
                )
            )

        # Create central board
        board = self._create_central_board()

        # Choose first player randomly
        first_player_index = self.rng.randint(0, len(players) - 1)

        return GameState(
            game_id=game_id,
            phase="playing",
            players=players,
            current_player_index=first_player_index,
            turn_number=1,
            turn_phase=TurnPhase.PRE_ACTION,
            board=board,
        )

    def _create_central_board(self) -> CentralBoard:
        """Create and shuffle the central board."""
        castle_cards = self.cards.get_castle_cards()
        village_cards = self.cards.get_village_cards()

        self.rng.shuffle(castle_cards)
        self.rng.shuffle(village_cards)

        return CentralBoard(
            castle_cards=castle_cards[:3],
            village_cards=village_cards[:3],
            messenger_location="village",
            castle_deck=castle_cards[3:],
            village_deck=village_cards[3:],
        )

    # =========================================================================
    # Action Validation
    # =========================================================================

    def validate_action(self, state: GameState, action: GameAction) -> tuple[bool, str]:
        """Validate an action.

        Returns:
            Tuple of (is_valid, reason)
        """
        player = next((p for p in state.players if p.id == action.player_id), None)
        if not player:
            return False, "Player not found"

        if state.players[state.current_player_index].id != action.player_id:
            return False, "Not your turn"

        match action.type:
            case ActionType.USE_KEY_ON_LOCK:
                return self._validate_use_key_on_lock(state, player, action)
            case ActionType.SPEND_KEY:
                return self._validate_spend_key(state, player, action)
            case ActionType.BUY_CARD | ActionType.BUY_CARD_FLIPPED:
                return self._validate_buy_card(state, player, action)
            case ActionType.PLACE_CARD:
                return self._validate_place_card(state, player, action)
            case ActionType.CHOOSE_EFFECT:
                return self._validate_choose_effect(state)
            case ActionType.END_TURN:
                return self._validate_end_turn(state)
            case _:
                return False, "Unknown action"

    def _validate_use_key_on_lock(
        self, state: GameState, player: Player, action: GameAction
    ) -> tuple[bool, str]:
        if state.turn_phase not in (TurnPhase.PRE_ACTION, TurnPhase.POST_ACTION):
            return False, "Cannot use lock now"
        if state.lock_used_this_turn:
            return False, "Already used a lock this turn"
        if action.lock_position is None:
            return False, "Lock position not specified"
        # Check if player has a key on this lock (simplified - would need lockedCards tracking)
        return True, ""

    def _validate_spend_key(
        self, state: GameState, player: Player, action: GameAction
    ) -> tuple[bool, str]:
        if state.turn_phase != TurnPhase.PRE_ACTION:
            return False, "Can only spend key before buying"
        if state.key_used_this_turn:
            return False, "Already used a key this turn"
        if player.keys < 1:
            return False, "No keys available"
        if not action.target_location:
            return False, "Target location not specified"
        return True, ""

    def _validate_buy_card(
        self, state: GameState, player: Player, action: GameAction
    ) -> tuple[bool, str]:
        if state.turn_phase not in (TurnPhase.PRE_ACTION, TurnPhase.BUY):
            return False, "Cannot buy now"
        if not action.card_id:
            return False, "Card not specified"

        # Check card is available
        available = (
            state.board.castle_cards
            if state.board.messenger_location == "castle"
            else state.board.village_cards
        )
        if action.card_id not in available:
            return False, "Card not available"

        # Check cost (unless flipped)
        if action.type == ActionType.BUY_CARD:
            card = self.cards.get(action.card_id)
            cost = get_effective_cost(
                card.value,
                card.category,
                player.reduction_castle,
                player.reduction_village,
            )
            if player.gold < cost:
                return False, f"Not enough gold ({player.gold}/{cost})"

        return True, ""

    def _validate_place_card(
        self, state: GameState, player: Player, action: GameAction
    ) -> tuple[bool, str]:
        if state.turn_phase != TurnPhase.PLACE:
            return False, "Cannot place card now"
        if not state.purchased_card:
            return False, "No card to place"
        if action.position is None or not (0 <= action.position <= 8):
            return False, "Invalid position"

        # Check shift if requested
        if action.shift_direction:
            if not can_shift_board(player.board, action.shift_direction):
                return False, "Cannot shift in this direction"
            shifted_board = shift_board(player.board, action.shift_direction)
            if shifted_board[action.position] is not None:
                return False, "Position occupied after shift"
            valid_positions = get_valid_placements(shifted_board)
        else:
            valid_positions = get_valid_placements(player.board)

        if action.position not in valid_positions:
            return False, "Invalid placement position"

        return True, ""

    def _validate_choose_effect(self, state: GameState) -> tuple[bool, str]:
        if state.turn_phase != TurnPhase.EFFECT:
            return False, "No effect choice to make"
        return True, ""

    def _validate_end_turn(self, state: GameState) -> tuple[bool, str]:
        if state.turn_phase not in (TurnPhase.POST_ACTION, TurnPhase.END):
            return False, "Must complete mandatory actions first"
        return True, ""

    # =========================================================================
    # Action Execution
    # =========================================================================

    def execute_action(self, state: GameState, action: GameAction) -> GameState:
        """Execute a validated action and return new state."""
        is_valid, reason = self.validate_action(state, action)
        if not is_valid:
            raise ValueError(f"Invalid action: {reason}")

        new_state = state.copy()
        new_state.action_history.append(action)

        match action.type:
            case ActionType.USE_KEY_ON_LOCK:
                return self._execute_use_key_on_lock(new_state, action)
            case ActionType.SPEND_KEY:
                return self._execute_spend_key(new_state, action)
            case ActionType.BUY_CARD:
                return self._execute_buy_card(new_state, action, flipped=False)
            case ActionType.BUY_CARD_FLIPPED:
                return self._execute_buy_card(new_state, action, flipped=True)
            case ActionType.PLACE_CARD:
                return self._execute_place_card(new_state, action)
            case ActionType.CHOOSE_EFFECT:
                return self._execute_choose_effect(new_state, action)
            case ActionType.END_TURN:
                return self._execute_end_turn(new_state)

        return new_state

    def _execute_use_key_on_lock(
        self, state: GameState, action: GameAction
    ) -> GameState:
        # Mark lock as used
        state.lock_used_this_turn = True
        # Effect would be applied by effect executor
        return state

    def _execute_spend_key(self, state: GameState, action: GameAction) -> GameState:
        player = state.current_player
        player.keys -= 1

        if action.target_location and action.target_location != state.board.messenger_location:
            # Move messenger
            state.board.messenger_location = action.target_location
        else:
            # Refresh current location
            state.board = self._refresh_location(state.board, state.board.messenger_location)

        state.key_used_this_turn = True
        return state

    def _execute_buy_card(
        self, state: GameState, action: GameAction, flipped: bool
    ) -> GameState:
        player = state.current_player
        card_id = action.card_id
        card = self.cards.get(card_id)

        cost = 0
        if not flipped:
            cost = get_effective_cost(
                card.value,
                card.category,
                player.reduction_castle,
                player.reduction_village,
            )
            player.gold -= cost

        # Remove card from central board
        if state.board.messenger_location == "castle":
            state.board.castle_cards = [c for c in state.board.castle_cards if c != card_id]
        else:
            state.board.village_cards = [c for c in state.board.village_cards if c != card_id]

        # Determine card to place (flipped = 089 or 090)
        purchased_card = card_id
        if flipped:
            purchased_card = FLIPPED_VILLAGE_ID if card.category == CardCategory.VILLAGE else FLIPPED_CASTLE_ID

        state.purchased_card = purchased_card
        state.purchased_card_cost = cost
        state.turn_phase = TurnPhase.PLACE

        return state

    def _execute_place_card(self, state: GameState, action: GameAction) -> GameState:
        player = state.current_player
        card_id = state.purchased_card
        card = self.cards.get(card_id)
        position = action.position

        # Apply shift if requested
        if action.shift_direction:
            player.board = shift_board(player.board, action.shift_direction)

        # Place the card
        placed_card = PlacedCard(
            card_id=card_id,
            position=position,
            has_key_on_lock=card.has_lock,
            is_flipped=card_id in (FLIPPED_VILLAGE_ID, FLIPPED_CASTLE_ID),
        )
        player.board[position] = placed_card

        state.purchased_card = None
        state.turn_phase = TurnPhase.EFFECT

        return state

    def _execute_choose_effect(
        self, state: GameState, action: GameAction
    ) -> GameState:
        # Effect would be applied by effect executor
        state.turn_phase = TurnPhase.POST_ACTION
        return state

    def _execute_end_turn(self, state: GameState) -> GameState:
        # Refill locations
        state.board = refill_locations(state.board)

        # Check for messenger movement (card with has_messenger)
        player = state.current_player
        for placed in player.board:
            if placed and not placed.is_flipped:
                card = self.cards.get(placed.card_id)
                if card.has_messenger:
                    state.board.messenger_location = (
                        "village" if state.board.messenger_location == "castle" else "castle"
                    )
                    break

        # Move to next player
        next_player = (state.current_player_index + 1) % len(state.players)
        if next_player <= state.current_player_index:
            state.turn_number += 1

        # Check game end
        game_ended = all(
            sum(1 for c in p.board if c is not None) == 9
            for p in state.players
        )

        if game_ended:
            state.phase = "ended"
            state.turn_phase = TurnPhase.END
        else:
            state.current_player_index = next_player
            state.turn_phase = TurnPhase.PRE_ACTION
            state.key_used_this_turn = False
            state.lock_used_this_turn = False
            state.action_history = []

        return state

    def _refresh_location(
        self, board: CentralBoard, location: Literal["castle", "village"]
    ) -> CentralBoard:
        """Refresh a location by discarding and drawing new cards."""
        new_board = board.copy()

        if location == "castle":
            new_board.castle_discard.extend(new_board.castle_cards)
            new_board.castle_cards = []

            if len(new_board.castle_deck) < 3:
                self.rng.shuffle(new_board.castle_discard)
                new_board.castle_deck.extend(new_board.castle_discard)
                new_board.castle_discard = []

            new_board.castle_cards = new_board.castle_deck[:3]
            new_board.castle_deck = new_board.castle_deck[3:]
        else:
            new_board.village_discard.extend(new_board.village_cards)
            new_board.village_cards = []

            if len(new_board.village_deck) < 3:
                self.rng.shuffle(new_board.village_discard)
                new_board.village_deck.extend(new_board.village_discard)
                new_board.village_discard = []

            new_board.village_cards = new_board.village_deck[:3]
            new_board.village_deck = new_board.village_deck[3:]

        return new_board

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def get_available_cards(self, state: GameState) -> list[str]:
        """Get cards available for purchase."""
        if state.board.messenger_location == "castle":
            return state.board.castle_cards
        return state.board.village_cards

    def get_valid_actions(self, state: GameState) -> list[GameAction]:
        """Get all valid actions for current state."""
        actions: list[GameAction] = []
        player = state.current_player

        match state.turn_phase:
            case TurnPhase.PRE_ACTION:
                # Can spend key
                if player.keys > 0 and not state.key_used_this_turn:
                    for loc in ["castle", "village"]:
                        actions.append(
                            GameAction(
                                type=ActionType.SPEND_KEY,
                                player_id=player.id,
                                target_location=loc,
                            )
                        )

                # Can buy card
                available_cards = self.get_available_cards(state)
                for card_id in available_cards:
                    card = self.cards.get(card_id)
                    cost = get_effective_cost(
                        card.value,
                        card.category,
                        player.reduction_castle,
                        player.reduction_village,
                    )
                    if player.gold >= cost:
                        actions.append(
                            GameAction(
                                type=ActionType.BUY_CARD,
                                player_id=player.id,
                                card_id=card_id,
                            )
                        )
                    # Always can buy flipped
                    actions.append(
                        GameAction(
                            type=ActionType.BUY_CARD_FLIPPED,
                            player_id=player.id,
                            card_id=card_id,
                        )
                    )

            case TurnPhase.BUY:
                # Same as pre_action but no key option
                available_cards = self.get_available_cards(state)
                for card_id in available_cards:
                    card = self.cards.get(card_id)
                    cost = get_effective_cost(
                        card.value,
                        card.category,
                        player.reduction_castle,
                        player.reduction_village,
                    )
                    if player.gold >= cost:
                        actions.append(
                            GameAction(
                                type=ActionType.BUY_CARD,
                                player_id=player.id,
                                card_id=card_id,
                            )
                        )
                    actions.append(
                        GameAction(
                            type=ActionType.BUY_CARD_FLIPPED,
                            player_id=player.id,
                            card_id=card_id,
                        )
                    )

            case TurnPhase.PLACE:
                valid_positions = get_valid_placements(player.board)
                for pos in valid_positions:
                    actions.append(
                        GameAction(
                            type=ActionType.PLACE_CARD,
                            player_id=player.id,
                            position=pos,
                        )
                    )

                # Add shift options
                for direction in ["left", "right", "up", "down"]:
                    if can_shift_board(player.board, direction):
                        shifted = shift_board(player.board, direction)
                        for pos in get_valid_placements(shifted):
                            actions.append(
                                GameAction(
                                    type=ActionType.PLACE_CARD,
                                    player_id=player.id,
                                    position=pos,
                                    shift_direction=direction,
                                )
                            )

            case TurnPhase.EFFECT:
                # Simplified - would need pending_effect handling
                actions.append(
                    GameAction(
                        type=ActionType.CHOOSE_EFFECT,
                        player_id=player.id,
                        choice_index=0,
                    )
                )

            case TurnPhase.POST_ACTION | TurnPhase.END:
                actions.append(
                    GameAction(type=ActionType.END_TURN, player_id=player.id)
                )

        return actions

    def is_game_ended(self, state: GameState) -> bool:
        """Check if game has ended."""
        return state.phase == "ended"

    def get_player_card_count(self, player: Player) -> int:
        """Count placed cards for a player."""
        return sum(1 for c in player.board if c is not None)


# =============================================================================
# Helper Functions (stateless)
# =============================================================================


def get_effective_cost(
    card_value: int,
    card_category: CardCategory | None,
    reduction_castle: int,
    reduction_village: int,
) -> int:
    """Calculate effective cost with reductions."""
    reduction = 0
    if card_category == CardCategory.CASTLE:
        reduction = reduction_castle
    elif card_category == CardCategory.VILLAGE:
        reduction = reduction_village
    return max(0, card_value - reduction)


def get_valid_placements(board: list[PlacedCard | None]) -> list[int]:
    """Get valid positions for card placement."""
    occupied = [i for i, c in enumerate(board) if c is not None]

    if not occupied:
        # First card: anywhere
        return list(range(9))

    # Adjacent positions to existing cards
    adjacent: set[int] = set()
    for pos in occupied:
        for adj in ADJACENCY_MAP[pos]:
            if board[adj] is None:
                adjacent.add(adj)

    # Filter positions that maintain valid 3x3 grid
    return [pos for pos in adjacent if can_form_valid_grid(occupied + [pos])]


def can_form_valid_grid(positions: list[int]) -> bool:
    """Check if positions can form a valid 3x3 grid."""
    if not positions:
        return True
    if len(positions) > 9:
        return False

    rows = set(p // 3 for p in positions)
    cols = set(p % 3 for p in positions)

    if len(rows) > 3 or len(cols) > 3:
        return False

    if len(positions) == 9:
        return len(rows) == 3 and len(cols) == 3

    return True


def can_shift_board(board: list[PlacedCard | None], direction: ShiftDirection) -> bool:
    """Check if board can be shifted in a direction."""
    has_cards = any(c is not None for c in board)
    if not has_cards:
        return False

    match direction:
        case "left":
            return board[0] is None and board[3] is None and board[6] is None
        case "right":
            return board[2] is None and board[5] is None and board[8] is None
        case "up":
            return board[0] is None and board[1] is None and board[2] is None
        case "down":
            return board[6] is None and board[7] is None and board[8] is None

    return False


def shift_board(
    board: list[PlacedCard | None], direction: ShiftDirection
) -> list[PlacedCard | None]:
    """Shift the board in a direction."""
    if not can_shift_board(board, direction):
        return board

    new_board: list[PlacedCard | None] = [None] * 9

    for i, card in enumerate(board):
        if card is None:
            continue

        match direction:
            case "left":
                new_pos = i - 1
            case "right":
                new_pos = i + 1
            case "up":
                new_pos = i - 3
            case "down":
                new_pos = i + 3

        if 0 <= new_pos < 9:
            new_card = PlacedCard(
                card_id=card.card_id,
                position=new_pos,
                coins_on_card=card.coins_on_card,
                has_key_on_lock=card.has_key_on_lock,
                is_flipped=card.is_flipped,
            )
            new_board[new_pos] = new_card

    return new_board


def refill_locations(board: CentralBoard) -> CentralBoard:
    """Refill castle and village to 3 cards each."""
    new_board = board.copy()

    # Refill castle
    while len(new_board.castle_cards) < 3 and new_board.castle_deck:
        new_board.castle_cards.append(new_board.castle_deck.pop(0))

    if len(new_board.castle_cards) < 3 and new_board.castle_discard:
        random.shuffle(new_board.castle_discard)
        new_board.castle_deck = new_board.castle_discard
        new_board.castle_discard = []
        while len(new_board.castle_cards) < 3 and new_board.castle_deck:
            new_board.castle_cards.append(new_board.castle_deck.pop(0))

    # Refill village
    while len(new_board.village_cards) < 3 and new_board.village_deck:
        new_board.village_cards.append(new_board.village_deck.pop(0))

    if len(new_board.village_cards) < 3 and new_board.village_discard:
        random.shuffle(new_board.village_discard)
        new_board.village_deck = new_board.village_discard
        new_board.village_discard = []
        while len(new_board.village_cards) < 3 and new_board.village_deck:
            new_board.village_cards.append(new_board.village_deck.pop(0))

    return new_board
