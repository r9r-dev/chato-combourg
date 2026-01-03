"""Observation space encoding for RL.

Encodes game state into a format suitable for neural networks:
- Card embeddings (learnable or one-hot)
- Board state as grid
- Resources as normalized values
- Available actions mask
"""

from __future__ import annotations

import numpy as np
from gymnasium import spaces

from ..game import CardDatabase, GameState, PlacedCard


class ObservationEncoder:
    """Encodes game state for the RL agent."""

    # Dimensions
    NUM_CARDS = 92  # Cards 001-092
    BOARD_SIZE = 9  # 3x3 grid
    MAX_GOLD = 50  # Normalized max
    MAX_KEYS = 10  # Normalized max
    NUM_SHIELD_COLORS = 5  # red, blue, green, yellow, purple

    def __init__(self, num_players: int = 2):
        self.num_players = num_players
        self.cards = CardDatabase()

        # Pre-compute card features
        self._card_features = self._build_card_features()

    def _build_card_features(self) -> np.ndarray:
        """Build static feature vectors for all cards.

        Features per card (dim=15):
        - value (normalized 0-1)
        - category: [is_castle, is_village, is_neutral]
        - shields: 5 colors x 2 (count normalized, has_shield)
        - has_messenger, has_lock, has_coin_purse, has_price_reduction
        """
        features = np.zeros((self.NUM_CARDS + 1, 15), dtype=np.float32)  # +1 for empty

        for i, card_id in enumerate(self.cards.all_card_ids()):
            card = self.cards.get(card_id)
            idx = int(card_id)  # "001" -> 1

            # Value (normalized)
            features[idx, 0] = card.value / 8.0

            # Category one-hot
            if card.category:
                if card.category.value == "castle":
                    features[idx, 1] = 1.0
                elif card.category.value == "village":
                    features[idx, 2] = 1.0
            else:
                features[idx, 3] = 1.0  # neutral

            # Shields (5 colors)
            color_map = {"red": 0, "blue": 1, "green": 2, "yellow": 3, "purple": 4}
            for shield in card.shields:
                color_idx = color_map.get(shield.color.value, 0)
                features[idx, 4 + color_idx * 2] = shield.count / 3.0  # normalized count
                features[idx, 4 + color_idx * 2 + 1] = 1.0  # has this color

            # Special properties
            features[idx, 14] = float(card.has_messenger)

        return features

    def get_observation_space(self) -> spaces.Dict:
        """Define the observation space."""
        return spaces.Dict(
            {
                # Current player's board: 9 positions x card features
                "player_board": spaces.Box(
                    low=0,
                    high=1,
                    shape=(self.BOARD_SIZE, self._card_features.shape[1] + 2),  # +2 for coins, lock
                    dtype=np.float32,
                ),
                # Other players' boards
                "opponent_boards": spaces.Box(
                    low=0,
                    high=1,
                    shape=(self.num_players - 1, self.BOARD_SIZE, self._card_features.shape[1] + 2),
                    dtype=np.float32,
                ),
                # Current player resources
                "resources": spaces.Box(
                    low=0,
                    high=1,
                    shape=(4,),  # gold, keys, reduction_castle, reduction_village
                    dtype=np.float32,
                ),
                # Available cards (6 total: 3 castle + 3 village, with messenger location)
                "available_cards": spaces.Box(
                    low=0,
                    high=1,
                    shape=(6, self._card_features.shape[1] + 1),  # +1 for is_accessible
                    dtype=np.float32,
                ),
                # Game progress
                "game_info": spaces.Box(
                    low=0,
                    high=1,
                    shape=(3,),  # turn_number/9, cards_placed/9, messenger_at_castle
                    dtype=np.float32,
                ),
            }
        )

    def encode(self, state: GameState, player_index: int) -> dict[str, np.ndarray]:
        """Encode game state from a player's perspective."""
        player = state.players[player_index]

        # Encode player's board
        player_board = self._encode_board(player.board)

        # Encode opponent boards
        opponent_boards = []
        for i, p in enumerate(state.players):
            if i != player_index:
                opponent_boards.append(self._encode_board(p.board))

        # Pad if fewer opponents
        while len(opponent_boards) < self.num_players - 1:
            opponent_boards.append(np.zeros_like(player_board))

        # Encode resources
        resources = np.array(
            [
                min(player.gold / self.MAX_GOLD, 1.0),
                min(player.keys / self.MAX_KEYS, 1.0),
                min(player.reduction_castle / 5.0, 1.0),
                min(player.reduction_village / 5.0, 1.0),
            ],
            dtype=np.float32,
        )

        # Encode available cards
        available_cards = self._encode_available_cards(state)

        # Encode game info
        cards_placed = sum(1 for c in player.board if c is not None)
        game_info = np.array(
            [
                state.turn_number / 9.0,
                cards_placed / 9.0,
                1.0 if state.board.messenger_location == "castle" else 0.0,
            ],
            dtype=np.float32,
        )

        return {
            "player_board": player_board,
            "opponent_boards": np.array(opponent_boards, dtype=np.float32),
            "resources": resources,
            "available_cards": available_cards,
            "game_info": game_info,
        }

    def _encode_board(self, board: list[PlacedCard | None]) -> np.ndarray:
        """Encode a player's 3x3 board."""
        feature_dim = self._card_features.shape[1] + 2  # +2 for coins, lock state
        encoded = np.zeros((self.BOARD_SIZE, feature_dim), dtype=np.float32)

        for i, placed in enumerate(board):
            if placed is not None:
                card_idx = int(placed.card_id)
                encoded[i, : self._card_features.shape[1]] = self._card_features[card_idx]
                encoded[i, -2] = placed.coins_on_card / 10.0  # normalized coins
                encoded[i, -1] = float(placed.has_key_on_lock)

        return encoded

    def _encode_available_cards(self, state: GameState) -> np.ndarray:
        """Encode the 6 available cards (3 castle + 3 village)."""
        feature_dim = self._card_features.shape[1] + 1  # +1 for accessibility
        encoded = np.zeros((6, feature_dim), dtype=np.float32)

        # Castle cards (positions 0-2)
        for i, card_id in enumerate(state.board.castle_cards[:3]):
            card_idx = int(card_id)
            encoded[i, : self._card_features.shape[1]] = self._card_features[card_idx]
            encoded[i, -1] = 1.0 if state.board.messenger_location == "castle" else 0.0

        # Village cards (positions 3-5)
        for i, card_id in enumerate(state.board.village_cards[:3]):
            card_idx = int(card_id)
            encoded[i + 3, : self._card_features.shape[1]] = self._card_features[card_idx]
            encoded[i + 3, -1] = 1.0 if state.board.messenger_location == "village" else 0.0

        return encoded

    def get_flat_observation_size(self) -> int:
        """Get total size when observation is flattened."""
        obs_space = self.get_observation_space()
        total = 0
        for key, space in obs_space.spaces.items():
            total += np.prod(space.shape)
        return int(total)

    def flatten(self, obs: dict[str, np.ndarray]) -> np.ndarray:
        """Flatten observation dict to 1D array."""
        return np.concatenate(
            [
                obs["player_board"].flatten(),
                obs["opponent_boards"].flatten(),
                obs["resources"],
                obs["available_cards"].flatten(),
                obs["game_info"],
            ]
        )
