"""Tests for the Gymnasium environment."""

import pytest
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestChatoEnv:
    """Tests for ChatoEnv."""

    def test_create_env(self):
        """Test environment creation."""
        from chato_rl.env import ChatoEnv

        env = ChatoEnv(num_players=2)
        assert env.num_players == 2

    def test_reset(self):
        """Test environment reset."""
        from chato_rl.env import ChatoEnv

        env = ChatoEnv(num_players=2)
        obs, info = env.reset(seed=42)

        assert "player_board" in obs
        assert "resources" in obs
        assert "action_mask" in obs
        assert obs["action_mask"].sum() > 0  # At least one valid action

    def test_step(self):
        """Test environment step."""
        from chato_rl.env import ChatoEnv
        import numpy as np

        env = ChatoEnv(num_players=2)
        obs, _ = env.reset(seed=42)

        # Get a valid action
        mask = obs["action_mask"]
        valid_actions = np.where(mask == 1)[0]
        action = valid_actions[0]

        obs2, reward, terminated, truncated, info = env.step(action)

        assert isinstance(reward, (int, float))
        assert isinstance(terminated, bool)
        assert isinstance(truncated, bool)

    def test_observation_space(self):
        """Test observation space definition."""
        from chato_rl.env import ChatoEnv

        env = ChatoEnv(num_players=2)
        obs, _ = env.reset(seed=42)

        # Check all observations are within space
        for key, value in obs.items():
            assert key in env.observation_space.spaces


class TestObservationEncoder:
    """Tests for ObservationEncoder."""

    def test_card_features(self):
        """Test card feature building."""
        from chato_rl.env import ObservationEncoder

        encoder = ObservationEncoder(num_players=2)
        assert encoder._card_features.shape[0] == 93  # 0-92
        assert encoder._card_features.shape[1] == 15  # Feature dim


class TestActionSpace:
    """Tests for action space."""

    def test_hierarchical_action_space(self):
        """Test HierarchicalActionSpace."""
        from chato_rl.env import HierarchicalActionSpace

        action_space = HierarchicalActionSpace()

        # Buy: 12 actions (6 cards x 2 buy types)
        assert action_space.get_buy_action_space().n == 12

        # Place: 45 actions (9 positions x 5 shift options)
        assert action_space.get_place_action_space().n == 45


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
