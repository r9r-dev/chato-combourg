"""
Gymnasium Environment for Chateau Combo.

Supports:
- Multi-agent gameplay (2-5 players)
- Self-play training
- Action masking via MaskablePPO
"""

from __future__ import annotations

from typing import Any, SupportsFloat

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from ..game import ActionType, CardDatabase, GameAction, GameState, TurnPhase
from ..game.engine import GameEngine
from .action import HierarchicalActionSpace
from .observation import ObservationEncoder


class ChatoEnv(gym.Env):
    """Gymnasium environment for Chateau Combo.

    This environment supports training a single agent against opponents.
    For self-play, opponents can be previous versions of the trained agent.
    """

    metadata = {"render_modes": ["human", "ansi"], "render_fps": 1}

    def __init__(
        self,
        num_players: int = 2,
        opponent_policy: Any | None = None,
        render_mode: str | None = None,
        seed: int | None = None,
    ):
        """Initialize environment.

        Args:
            num_players: Number of players (2-5)
            opponent_policy: Policy for opponent(s), or None for random
            render_mode: "human" or "ansi" for text output
            seed: Random seed for reproducibility
        """
        super().__init__()

        assert 2 <= num_players <= 5, "Must have 2-5 players"

        self.num_players = num_players
        self.opponent_policy = opponent_policy
        self.render_mode = render_mode

        # Game components
        self.engine = GameEngine(seed=seed)
        self.cards = CardDatabase()
        self.obs_encoder = ObservationEncoder(num_players=num_players)
        self.action_space_handler = HierarchicalActionSpace()

        # Agent is always player 0
        self.agent_player_index = 0

        # Action space: hierarchical
        # For MaskablePPO, we use a single Discrete space
        # Actions encode: (buy_card_idx * 2 + is_flipped) * 45 + place_action
        # This gives us 12 * 45 = 540 possible actions per turn
        self.action_space = spaces.Discrete(12 * 45)

        # Observation space
        self.observation_space = spaces.Dict(
            {
                **self.obs_encoder.get_observation_space().spaces,
                "action_mask": spaces.Box(
                    low=0, high=1, shape=(12 * 45,), dtype=np.int8
                ),
            }
        )

        # State
        self.state: GameState | None = None
        self._np_random: np.random.Generator | None = None

    def reset(
        self,
        seed: int | None = None,
        options: dict | None = None,
    ) -> tuple[dict[str, np.ndarray], dict[str, Any]]:
        """Reset environment to initial state."""
        super().reset(seed=seed)

        if seed is not None:
            self.engine = GameEngine(seed=seed)

        # Create player configs
        player_configs = [
            {"name": "Agent", "color": "#FFD700", "is_ai": False}
        ]
        for i in range(1, self.num_players):
            player_configs.append(
                {"name": f"Opponent {i}", "color": f"#{i * 30:02x}80{(255 - i * 30):02x}", "is_ai": True, "ai_level": "extreme"}
            )

        self.state = self.engine.create_game(player_configs, seed=seed)

        # If not agent's turn, play opponents until it is
        self._play_opponents_until_agent_turn()

        obs = self._get_observation()
        info = self._get_info()

        return obs, info

    def step(
        self, action: int
    ) -> tuple[dict[str, np.ndarray], SupportsFloat, bool, bool, dict[str, Any]]:
        """Execute action and return new state.

        Args:
            action: Combined action index (buy_action * 45 + place_action)

        Returns:
            observation, reward, terminated, truncated, info
        """
        if self.state is None:
            raise RuntimeError("Environment not initialized. Call reset() first.")

        # Decode action
        buy_action = action // 45
        place_action = action % 45

        # Execute buy action
        if self.state.turn_phase in (TurnPhase.PRE_ACTION, TurnPhase.BUY):
            game_action = self.action_space_handler.decode_buy_action(
                buy_action, self.state
            )
            try:
                self.state = self.engine.execute_action(self.state, game_action)
            except ValueError:
                # Invalid action - give penalty and skip
                pass

        # Execute place action
        if self.state.turn_phase == TurnPhase.PLACE:
            game_action = self.action_space_handler.decode_place_action(
                place_action, self.state
            )
            try:
                self.state = self.engine.execute_action(self.state, game_action)
            except ValueError:
                # Invalid action - try first valid position
                valid_actions = self.engine.get_valid_actions(self.state)
                place_actions = [a for a in valid_actions if a.type == ActionType.PLACE_CARD]
                if place_actions:
                    self.state = self.engine.execute_action(self.state, place_actions[0])

        # Handle effect phase (auto-select for now)
        if self.state.turn_phase == TurnPhase.EFFECT:
            effect_action = GameAction(
                type=ActionType.CHOOSE_EFFECT,
                player_id=self.state.current_player.id,
                choice_index=0,
            )
            try:
                self.state = self.engine.execute_action(self.state, effect_action)
            except ValueError:
                pass

        # End turn
        if self.state.turn_phase in (TurnPhase.POST_ACTION, TurnPhase.END):
            end_action = GameAction(
                type=ActionType.END_TURN,
                player_id=self.state.current_player.id,
            )
            try:
                self.state = self.engine.execute_action(self.state, end_action)
            except ValueError:
                pass

        # Play opponents until agent's turn again (or game ends)
        self._play_opponents_until_agent_turn()

        # Calculate reward
        reward = self._calculate_reward()

        # Check termination
        terminated = self.engine.is_game_ended(self.state)
        truncated = False

        obs = self._get_observation()
        info = self._get_info()

        if terminated:
            info["final_scores"] = self._get_final_scores()
            info["agent_rank"] = self._get_agent_rank()

        return obs, reward, terminated, truncated, info

    def _play_opponents_until_agent_turn(self) -> None:
        """Play opponent turns until it's the agent's turn."""
        if self.state is None:
            return

        max_iterations = 100  # Prevent infinite loops
        iterations = 0

        while (
            self.state.current_player_index != self.agent_player_index
            and not self.engine.is_game_ended(self.state)
            and iterations < max_iterations
        ):
            iterations += 1
            self._play_opponent_turn()

    def _play_opponent_turn(self) -> None:
        """Play a single opponent turn."""
        if self.state is None:
            return

        # Use opponent policy if available, otherwise random
        if self.opponent_policy is not None:
            # Get opponent observation
            obs = self.obs_encoder.encode(self.state, self.state.current_player_index)
            action_mask = self._get_action_mask()

            # Get action from policy (stochastic for training diversity)
            action, _ = self.opponent_policy.predict(
                obs,
                deterministic=False,
                action_masks=action_mask,
            )
        else:
            # Random valid action
            action = self._sample_random_action()

        # Decode and execute action
        buy_action = action // 45
        place_action = action % 45

        # Buy
        if self.state.turn_phase in (TurnPhase.PRE_ACTION, TurnPhase.BUY):
            game_action = self.action_space_handler.decode_buy_action(
                buy_action, self.state
            )
            try:
                self.state = self.engine.execute_action(self.state, game_action)
            except ValueError:
                # Fallback to first valid action
                valid_actions = self.engine.get_valid_actions(self.state)
                buy_actions = [a for a in valid_actions if a.type in (ActionType.BUY_CARD, ActionType.BUY_CARD_FLIPPED)]
                if buy_actions:
                    self.state = self.engine.execute_action(self.state, buy_actions[0])

        # Place
        if self.state.turn_phase == TurnPhase.PLACE:
            game_action = self.action_space_handler.decode_place_action(
                place_action, self.state
            )
            try:
                self.state = self.engine.execute_action(self.state, game_action)
            except ValueError:
                valid_actions = self.engine.get_valid_actions(self.state)
                place_actions = [a for a in valid_actions if a.type == ActionType.PLACE_CARD]
                if place_actions:
                    self.state = self.engine.execute_action(self.state, place_actions[0])

        # Effect
        if self.state.turn_phase == TurnPhase.EFFECT:
            effect_action = GameAction(
                type=ActionType.CHOOSE_EFFECT,
                player_id=self.state.current_player.id,
                choice_index=0,
            )
            try:
                self.state = self.engine.execute_action(self.state, effect_action)
            except ValueError:
                pass

        # End turn
        if self.state.turn_phase in (TurnPhase.POST_ACTION, TurnPhase.END):
            end_action = GameAction(
                type=ActionType.END_TURN,
                player_id=self.state.current_player.id,
            )
            try:
                self.state = self.engine.execute_action(self.state, end_action)
            except ValueError:
                pass

    def _sample_random_action(self) -> int:
        """Sample a random valid action."""
        mask = self._get_action_mask()
        valid_indices = np.where(mask == 1)[0]
        if len(valid_indices) == 0:
            return 0
        return int(self.np_random.choice(valid_indices))

    def _get_observation(self) -> dict[str, np.ndarray]:
        """Get current observation."""
        if self.state is None:
            raise RuntimeError("State not initialized")

        obs = self.obs_encoder.encode(self.state, self.agent_player_index)
        obs["action_mask"] = self._get_action_mask()
        return obs

    def _get_action_mask(self) -> np.ndarray:
        """Get mask of valid actions."""
        if self.state is None:
            return np.zeros(12 * 45, dtype=np.int8)

        buy_mask = self.action_space_handler.get_buy_mask(self.state)
        place_mask = self.action_space_handler.get_place_mask(self.state)

        # Combine into full action mask
        # Action = buy * 45 + place
        full_mask = np.zeros(12 * 45, dtype=np.int8)

        for buy_idx in range(12):
            if buy_mask[buy_idx]:
                for place_idx in range(45):
                    if place_mask[place_idx]:
                        full_mask[buy_idx * 45 + place_idx] = 1

        # Ensure at least one action is valid
        if full_mask.sum() == 0:
            full_mask[0] = 1

        return full_mask

    def _calculate_reward(self) -> float:
        """Calculate reward for current state.

        Reward shaping:
        - Sparse: final score difference at game end
        - Dense: incremental rewards during game
        """
        if self.state is None:
            return 0.0

        # If game ended, return final reward
        if self.engine.is_game_ended(self.state):
            return self._get_final_reward()

        # Dense reward: small bonuses for good plays
        # This helps with credit assignment during training
        agent = self.state.players[self.agent_player_index]

        reward = 0.0

        # Small reward for placing cards
        cards_placed = sum(1 for c in agent.board if c is not None)
        reward += cards_placed * 0.01

        # Small reward for having gold/keys
        reward += agent.gold * 0.001
        reward += agent.keys * 0.005

        return reward

    def _get_final_reward(self) -> float:
        """Calculate final reward at game end."""
        if self.state is None:
            return 0.0

        scores = self._get_final_scores()
        agent_score = scores[self.agent_player_index]

        # Reward = agent score - average opponent score
        opponent_scores = [s for i, s in enumerate(scores) if i != self.agent_player_index]
        avg_opponent = sum(opponent_scores) / len(opponent_scores) if opponent_scores else 0

        # Normalize to roughly [-1, 1] range
        reward = (agent_score - avg_opponent) / 50.0

        # Bonus for winning
        if agent_score == max(scores):
            reward += 1.0

        return reward

    def _get_final_scores(self) -> list[int]:
        """Calculate final scores for all players."""
        if self.state is None:
            return [0] * self.num_players

        # Simplified scoring - just count cards + resources
        # Full scoring would use the backend calculator
        scores = []
        for player in self.state.players:
            score = 0
            # Count cards (each worth ~5 points on average)
            cards_count = sum(1 for c in player.board if c is not None)
            score += cards_count * 5
            # Add remaining resources
            score += player.gold
            score += player.keys * 2
            scores.append(score)

        return scores

    def _get_agent_rank(self) -> int:
        """Get agent's rank (1 = first place)."""
        scores = self._get_final_scores()
        agent_score = scores[self.agent_player_index]
        rank = 1
        for i, score in enumerate(scores):
            if i != self.agent_player_index and score > agent_score:
                rank += 1
        return rank

    def _get_info(self) -> dict[str, Any]:
        """Get additional info."""
        if self.state is None:
            return {}

        agent = self.state.players[self.agent_player_index]
        return {
            "turn_number": self.state.turn_number,
            "cards_placed": sum(1 for c in agent.board if c is not None),
            "gold": agent.gold,
            "keys": agent.keys,
            "phase": self.state.turn_phase.value,
        }

    def render(self) -> str | None:
        """Render the current state."""
        if self.render_mode is None or self.state is None:
            return None

        lines = []
        lines.append(f"\n=== Turn {self.state.turn_number} ===")
        lines.append(f"Phase: {self.state.turn_phase.value}")
        lines.append(f"Messenger: {self.state.board.messenger_location}")

        for i, player in enumerate(self.state.players):
            marker = ">>>" if i == self.agent_player_index else "   "
            current = "*" if i == self.state.current_player_index else " "
            cards = sum(1 for c in player.board if c is not None)
            lines.append(
                f"{marker}{current} {player.name}: {cards} cards, {player.gold}g, {player.keys}k"
            )

            # Show board as 3x3 grid
            for row in range(3):
                row_str = "      "
                for col in range(3):
                    pos = row * 3 + col
                    card = player.board[pos]
                    if card:
                        row_str += f"[{card.card_id}]"
                    else:
                        row_str += "[   ]"
                lines.append(row_str)

        output = "\n".join(lines)

        if self.render_mode == "human":
            print(output)

        return output

    def close(self) -> None:
        """Clean up resources."""
        pass

    def action_masks(self) -> np.ndarray:
        """Get action mask for MaskablePPO.

        This method is called by sb3_contrib.MaskablePPO.
        """
        return self._get_action_mask()
