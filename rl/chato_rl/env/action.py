"""Action space definition for RL.

Hierarchical action space:
1. High-level: buy_action (which card to buy)
2. Mid-level: place_action (where to place)
3. Low-level: effect_action (optional choices)

Uses MaskablePPO for invalid action masking.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from gymnasium import spaces

from ..game import ActionType, CardDatabase, GameAction, GameState, TurnPhase
from ..game.engine import (
    GameEngine,
    can_shift_board,
    get_effective_cost,
    get_valid_placements,
    shift_board,
)


@dataclass
class ActionSpace:
    """Simple discrete action space for single-step decisions."""

    # Action dimensions
    NUM_BUY_ACTIONS = 6  # 3 cards x 2 (normal or flipped) per location
    NUM_PLACE_ACTIONS = 9 + 4 * 9  # 9 direct + 4 shifts x 9 positions
    NUM_KEY_ACTIONS = 3  # no_key, move_messenger, refresh
    NUM_EFFECT_CHOICES = 4  # max effect options

    def __init__(self):
        self.cards = CardDatabase()

    def get_action_space(self) -> spaces.MultiDiscrete:
        """Define action space as MultiDiscrete for hierarchical decisions.

        Actions:
        - [0]: Key action (0=skip, 1=move_to_castle, 2=move_to_village/refresh)
        - [1]: Buy action (0-2=castle cards, 3-5=village cards) + flipped flag
        - [2]: Flipped flag (0=normal, 1=flipped)
        - [3]: Place position (0-8)
        - [4]: Shift direction (0=none, 1=left, 2=right, 3=up, 4=down)
        """
        return spaces.MultiDiscrete([
            3,   # key action
            6,   # buy card index
            2,   # flipped flag
            9,   # place position
            5,   # shift direction
        ])

    def decode_action(
        self, action: np.ndarray, state: GameState
    ) -> list[GameAction]:
        """Decode action array into game actions.

        Returns list of actions to execute in sequence.
        """
        key_action, buy_idx, is_flipped, place_pos, shift_dir = action
        player = state.current_player
        actions: list[GameAction] = []

        # Key action (only in pre_action phase)
        if key_action > 0 and state.turn_phase == TurnPhase.PRE_ACTION:
            if player.keys > 0 and not state.key_used_this_turn:
                if key_action == 1:
                    target = "castle"
                else:
                    target = "village"
                actions.append(
                    GameAction(
                        type=ActionType.SPEND_KEY,
                        player_id=player.id,
                        target_location=target,
                    )
                )

        # Buy action
        if state.turn_phase in (TurnPhase.PRE_ACTION, TurnPhase.BUY):
            # Determine which cards are available
            if state.board.messenger_location == "castle":
                available = state.board.castle_cards
            else:
                available = state.board.village_cards

            if 0 <= buy_idx < len(available):
                card_id = available[buy_idx]
                action_type = ActionType.BUY_CARD_FLIPPED if is_flipped else ActionType.BUY_CARD

                # Validate affordability
                if action_type == ActionType.BUY_CARD:
                    card = self.cards.get(card_id)
                    cost = get_effective_cost(
                        card.value,
                        card.category,
                        player.reduction_castle,
                        player.reduction_village,
                    )
                    if player.gold < cost:
                        action_type = ActionType.BUY_CARD_FLIPPED

                actions.append(
                    GameAction(
                        type=action_type,
                        player_id=player.id,
                        card_id=card_id,
                    )
                )

        # Place action
        if state.turn_phase == TurnPhase.PLACE or (actions and actions[-1].type in (ActionType.BUY_CARD, ActionType.BUY_CARD_FLIPPED)):
            shift_direction: Literal["left", "right", "up", "down"] | None = None
            if shift_dir == 1:
                shift_direction = "left"
            elif shift_dir == 2:
                shift_direction = "right"
            elif shift_dir == 3:
                shift_direction = "up"
            elif shift_dir == 4:
                shift_direction = "down"

            actions.append(
                GameAction(
                    type=ActionType.PLACE_CARD,
                    player_id=player.id,
                    position=int(place_pos),
                    shift_direction=shift_direction,
                )
            )

        # Effect action (simplified - auto-choose first option)
        if state.turn_phase == TurnPhase.EFFECT:
            actions.append(
                GameAction(
                    type=ActionType.CHOOSE_EFFECT,
                    player_id=player.id,
                    choice_index=0,
                )
            )

        # End turn
        actions.append(
            GameAction(
                type=ActionType.END_TURN,
                player_id=player.id,
            )
        )

        return actions

    def get_action_mask(self, state: GameState) -> np.ndarray:
        """Get mask of valid actions for current state.

        Returns array of shape (5,) with arrays of valid indices for each dimension.
        For MaskablePPO, we need a flat boolean mask.
        """
        player = state.current_player

        # Initialize all masks
        key_mask = np.zeros(3, dtype=np.int8)
        buy_mask = np.zeros(6, dtype=np.int8)
        flip_mask = np.ones(2, dtype=np.int8)  # Always valid
        place_mask = np.zeros(9, dtype=np.int8)
        shift_mask = np.zeros(5, dtype=np.int8)

        # Key actions
        key_mask[0] = 1  # Can always skip
        if player.keys > 0 and not state.key_used_this_turn and state.turn_phase == TurnPhase.PRE_ACTION:
            key_mask[1] = 1  # move to castle
            key_mask[2] = 1  # move to village / refresh

        # Buy actions
        if state.turn_phase in (TurnPhase.PRE_ACTION, TurnPhase.BUY):
            if state.board.messenger_location == "castle":
                available = state.board.castle_cards
            else:
                available = state.board.village_cards

            for i, card_id in enumerate(available[:3]):
                buy_mask[i] = 1
                # Check affordability for normal buy
                card = self.cards.get(card_id)
                cost = get_effective_cost(
                    card.value,
                    card.category,
                    player.reduction_castle,
                    player.reduction_village,
                )
                if player.gold < cost:
                    flip_mask[0] = 0  # Can't buy normal if too expensive

        # Place actions
        valid_positions = get_valid_placements(player.board)
        for pos in valid_positions:
            place_mask[pos] = 1

        # Shift actions
        shift_mask[0] = 1  # No shift always valid
        if can_shift_board(player.board, "left"):
            shift_mask[1] = 1
        if can_shift_board(player.board, "right"):
            shift_mask[2] = 1
        if can_shift_board(player.board, "up"):
            shift_mask[3] = 1
        if can_shift_board(player.board, "down"):
            shift_mask[4] = 1

        return np.concatenate([key_mask, buy_mask, flip_mask, place_mask, shift_mask])

    def get_flat_mask_size(self) -> int:
        """Get total size of flattened action mask."""
        return 3 + 6 + 2 + 9 + 5  # 25 total


class HierarchicalActionSpace:
    """Hierarchical action space for separate policies.

    For HRL (Hierarchical RL):
    - Buy policy: selects card to buy
    - Place policy: selects position
    - Effect policy: handles interactive effects
    """

    def __init__(self):
        self.cards = CardDatabase()

    def get_buy_action_space(self) -> spaces.Discrete:
        """Action space for buying: 6 cards x 2 buy types = 12 actions."""
        return spaces.Discrete(12)

    def get_place_action_space(self) -> spaces.Discrete:
        """Action space for placing: 9 positions x 5 shift options = 45 actions."""
        return spaces.Discrete(45)

    def get_effect_action_space(self) -> spaces.Discrete:
        """Action space for effects: max 4 choices."""
        return spaces.Discrete(4)

    def get_buy_mask(self, state: GameState) -> np.ndarray:
        """Get mask for buy actions."""
        player = state.current_player
        mask = np.zeros(12, dtype=np.int8)

        if state.board.messenger_location == "castle":
            available = state.board.castle_cards
        else:
            available = state.board.village_cards

        for i, card_id in enumerate(available[:3]):
            card = self.cards.get(card_id)
            cost = get_effective_cost(
                card.value,
                card.category,
                player.reduction_castle,
                player.reduction_village,
            )

            # Normal buy
            if player.gold >= cost:
                mask[i * 2] = 1

            # Flipped buy (always valid)
            mask[i * 2 + 1] = 1

        return mask

    def get_place_mask(self, state: GameState) -> np.ndarray:
        """Get mask for place actions."""
        player = state.current_player
        mask = np.zeros(45, dtype=np.int8)

        # Direct placements (no shift)
        for pos in get_valid_placements(player.board):
            mask[pos] = 1

        # With shifts
        for shift_idx, shift_dir in enumerate(["left", "right", "up", "down"]):
            if can_shift_board(player.board, shift_dir):
                shifted = shift_board(player.board, shift_dir)
                for pos in get_valid_placements(shifted):
                    action_idx = 9 + shift_idx * 9 + pos
                    mask[action_idx] = 1

        return mask

    def decode_buy_action(self, action: int, state: GameState) -> GameAction:
        """Decode buy action index to GameAction."""
        player = state.current_player

        if state.board.messenger_location == "castle":
            available = state.board.castle_cards
        else:
            available = state.board.village_cards

        card_idx = action // 2
        is_flipped = action % 2 == 1

        if card_idx < len(available):
            card_id = available[card_idx]
            return GameAction(
                type=ActionType.BUY_CARD_FLIPPED if is_flipped else ActionType.BUY_CARD,
                player_id=player.id,
                card_id=card_id,
            )

        # Fallback: first available card flipped
        return GameAction(
            type=ActionType.BUY_CARD_FLIPPED,
            player_id=player.id,
            card_id=available[0] if available else "001",
        )

    def decode_place_action(self, action: int, state: GameState) -> GameAction:
        """Decode place action index to GameAction."""
        player = state.current_player

        if action < 9:
            # Direct placement
            return GameAction(
                type=ActionType.PLACE_CARD,
                player_id=player.id,
                position=action,
            )

        # With shift
        shift_idx = (action - 9) // 9
        position = (action - 9) % 9
        shift_dirs: list[Literal["left", "right", "up", "down"]] = ["left", "right", "up", "down"]

        return GameAction(
            type=ActionType.PLACE_CARD,
            player_id=player.id,
            position=position,
            shift_direction=shift_dirs[shift_idx],
        )
