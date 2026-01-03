"""Custom policy network for MaskablePPO.

Uses the CardTransformer to encode game state and outputs action probabilities.
"""

from __future__ import annotations

from typing import Any, Callable

import gymnasium as gym
import numpy as np
import torch
import torch.nn as nn
from sb3_contrib.common.maskable.policies import MaskableActorCriticPolicy
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor

from .transformer import CardTransformer


class ChatoFeaturesExtractor(BaseFeaturesExtractor):
    """Custom features extractor using CardTransformer.

    Processes the Dict observation space and outputs a flat feature vector.
    """

    def __init__(
        self,
        observation_space: gym.spaces.Dict,
        features_dim: int = 128,
        d_model: int = 64,
        num_heads: int = 4,
        num_layers: int = 2,
        num_players: int = 2,
    ):
        super().__init__(observation_space, features_dim)

        # Get dimensions from observation space
        player_board_shape = observation_space["player_board"].shape
        available_cards_shape = observation_space["available_cards"].shape

        # Card feature dims may differ between board (17) and available (16)
        board_feature_dim = player_board_shape[1]  # 17
        available_feature_dim = available_cards_shape[1]  # 16

        self.transformer = CardTransformer(
            board_feature_dim=board_feature_dim,
            available_feature_dim=available_feature_dim,
            d_model=d_model,
            num_heads=num_heads,
            num_layers=num_layers,
            num_players=num_players,
            output_dim=features_dim,
        )

        self._features_dim = features_dim

    def forward(self, observations: dict[str, torch.Tensor]) -> torch.Tensor:
        """Extract features from observations.

        Args:
            observations: Dict of observation tensors

        Returns:
            Feature tensor (batch, features_dim)
        """
        return self.transformer(
            player_board=observations["player_board"],
            opponent_boards=observations["opponent_boards"],
            available_cards=observations["available_cards"],
            resources=observations["resources"],
            game_info=observations["game_info"],
        )


class SimpleFeaturesExtractor(BaseFeaturesExtractor):
    """Simpler MLP-based features extractor for faster training.

    Flattens all observations and processes through MLP.
    """

    def __init__(
        self,
        observation_space: gym.spaces.Dict,
        features_dim: int = 128,
        hidden_dim: int = 256,
    ):
        super().__init__(observation_space, features_dim)

        # Calculate total input size from observation space
        total_input = 0
        for key, space in observation_space.spaces.items():
            if key != "action_mask":  # Don't include action mask in features
                total_input += int(np.prod(space.shape))

        self.network = nn.Sequential(
            nn.Linear(total_input, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, features_dim),
            nn.ReLU(),
        )

        self._features_dim = features_dim

    def forward(self, observations: dict[str, torch.Tensor]) -> torch.Tensor:
        """Extract features from observations.

        Args:
            observations: Dict of observation tensors

        Returns:
            Feature tensor (batch, features_dim)
        """
        # Flatten all observations except action_mask
        flat_obs = []
        for key, value in observations.items():
            if key != "action_mask":
                flat_obs.append(value.view(value.size(0), -1))

        x = torch.cat(flat_obs, dim=1)
        return self.network(x)


class ChatoPolicy(MaskableActorCriticPolicy):
    """Custom actor-critic policy for Chateau Combo.

    Can use either Transformer or MLP features extractor.
    Inherits from MaskableActorCriticPolicy for action masking support.
    """

    def __init__(
        self,
        observation_space: gym.spaces.Dict,
        action_space: gym.spaces.Discrete,
        lr_schedule: Callable[[float], float],
        net_arch: list[dict[str, list[int]]] | None = None,
        activation_fn: type[nn.Module] = nn.ReLU,
        use_transformer: bool = True,
        features_dim: int = 128,
        d_model: int = 64,
        num_heads: int = 4,
        num_layers: int = 2,
        num_players: int = 2,
        *args,
        **kwargs,
    ):
        self.use_transformer = use_transformer
        self._features_dim = features_dim
        self._d_model = d_model
        self._num_heads = num_heads
        self._num_layers = num_layers
        self._num_players = num_players

        # Default network architecture
        if net_arch is None:
            net_arch = [dict(pi=[128, 64], vf=[128, 64])]

        super().__init__(
            observation_space,
            action_space,
            lr_schedule,
            net_arch=net_arch,
            activation_fn=activation_fn,
            features_extractor_class=self._get_extractor_class(),
            features_extractor_kwargs=self._get_extractor_kwargs(),
            *args,
            **kwargs,
        )

    def _get_extractor_class(self) -> type[BaseFeaturesExtractor]:
        """Get the features extractor class."""
        if self.use_transformer:
            return ChatoFeaturesExtractor
        return SimpleFeaturesExtractor

    def _get_extractor_kwargs(self) -> dict[str, Any]:
        """Get kwargs for features extractor."""
        if self.use_transformer:
            return {
                "features_dim": self._features_dim,
                "d_model": self._d_model,
                "num_heads": self._num_heads,
                "num_layers": self._num_layers,
                "num_players": self._num_players,
            }
        return {
            "features_dim": self._features_dim,
            "hidden_dim": 256,
        }


def create_policy_kwargs(
    use_transformer: bool = True,
    features_dim: int = 128,
    d_model: int = 64,
    num_heads: int = 4,
    num_layers: int = 2,
    num_players: int = 2,
) -> dict[str, Any]:
    """Create policy kwargs for MaskablePPO.

    Usage:
        from sb3_contrib import MaskablePPO

        policy_kwargs = create_policy_kwargs(use_transformer=True)
        model = MaskablePPO(
            ChatoPolicy,
            env,
            policy_kwargs=policy_kwargs,
            ...
        )
    """
    return {
        "use_transformer": use_transformer,
        "features_dim": features_dim,
        "d_model": d_model,
        "num_heads": num_heads,
        "num_layers": num_layers,
        "num_players": num_players,
    }
