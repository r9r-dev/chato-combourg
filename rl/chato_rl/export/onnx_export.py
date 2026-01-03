"""ONNX export for trained models.

Allows running the trained agent in the browser via ONNX Runtime Web.
"""

from __future__ import annotations

from pathlib import Path
from typing import Tuple

import numpy as np
import onnx
import torch
import torch.nn as nn
from sb3_contrib import MaskablePPO

from ..env import ChatoEnv, ObservationEncoder


class OnnxChatoPolicy(nn.Module):
    """Wrapper for exporting policy to ONNX."""

    def __init__(self, policy: nn.Module, obs_encoder: ObservationEncoder):
        super().__init__()
        self.policy = policy
        self.obs_encoder = obs_encoder

    def forward(
        self,
        player_board: torch.Tensor,
        opponent_boards: torch.Tensor,
        available_cards: torch.Tensor,
        resources: torch.Tensor,
        game_info: torch.Tensor,
        action_mask: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Forward pass for ONNX export.

        Args:
            player_board: (batch, 9, features)
            opponent_boards: (batch, num_opp, 9, features)
            available_cards: (batch, 6, features)
            resources: (batch, 4)
            game_info: (batch, 3)
            action_mask: (batch, num_actions)

        Returns:
            Tuple of (action_probs, value)
        """
        # Build observation dict
        obs = {
            "player_board": player_board,
            "opponent_boards": opponent_boards,
            "available_cards": available_cards,
            "resources": resources,
            "game_info": game_info,
            "action_mask": action_mask,
        }

        # Get features from extractor
        features = self.policy.extract_features(obs)

        # Get action logits and value
        latent_pi, latent_vf = self.policy.mlp_extractor(features)
        action_logits = self.policy.action_net(latent_pi)
        value = self.policy.value_net(latent_vf)

        # Apply action mask (set invalid actions to -inf)
        masked_logits = action_logits.clone()
        masked_logits[action_mask == 0] = float("-inf")

        # Softmax to get probabilities
        action_probs = torch.softmax(masked_logits, dim=-1)

        return action_probs, value


def export_to_onnx(
    model_path: str,
    output_path: str,
    num_players: int = 2,
    opset_version: int = 17,
) -> None:
    """Export trained model to ONNX format.

    Args:
        model_path: Path to trained MaskablePPO model
        output_path: Path for output ONNX file
        num_players: Number of players in the game
        opset_version: ONNX opset version
    """
    print(f"Loading model from {model_path}...")
    model = MaskablePPO.load(model_path, device="cpu")

    # Create observation encoder
    obs_encoder = ObservationEncoder(num_players=num_players)

    # Create ONNX wrapper
    onnx_policy = OnnxChatoPolicy(model.policy, obs_encoder)
    onnx_policy.eval()

    # Get observation shapes from encoder
    obs_space = obs_encoder.get_observation_space()

    # Create dummy inputs
    batch_size = 1
    dummy_inputs = (
        torch.randn(batch_size, *obs_space["player_board"].shape),
        torch.randn(batch_size, *obs_space["opponent_boards"].shape),
        torch.randn(batch_size, *obs_space["available_cards"].shape),
        torch.randn(batch_size, *obs_space["resources"].shape),
        torch.randn(batch_size, *obs_space["game_info"].shape),
        torch.ones(batch_size, 12 * 45, dtype=torch.float32),  # Action mask
    )

    # Export to ONNX
    print(f"Exporting to {output_path}...")
    torch.onnx.export(
        onnx_policy,
        dummy_inputs,
        output_path,
        opset_version=opset_version,
        input_names=[
            "player_board",
            "opponent_boards",
            "available_cards",
            "resources",
            "game_info",
            "action_mask",
        ],
        output_names=["action_probs", "value"],
        dynamic_axes={
            "player_board": {0: "batch"},
            "opponent_boards": {0: "batch"},
            "available_cards": {0: "batch"},
            "resources": {0: "batch"},
            "game_info": {0: "batch"},
            "action_mask": {0: "batch"},
            "action_probs": {0: "batch"},
            "value": {0: "batch"},
        },
    )

    # Validate the exported model
    print("Validating ONNX model...")
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)

    # Get file size
    file_size = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"Export successful! File size: {file_size:.1f} MB")


def verify_onnx_model(
    onnx_path: str,
    model_path: str,
    num_players: int = 2,
) -> bool:
    """Verify ONNX model produces same outputs as PyTorch model.

    Args:
        onnx_path: Path to ONNX model
        model_path: Path to original PyTorch model
        num_players: Number of players

    Returns:
        True if outputs match, False otherwise
    """
    import onnxruntime as ort

    # Load models
    model = MaskablePPO.load(model_path, device="cpu")
    ort_session = ort.InferenceSession(onnx_path)

    # Create test observation
    obs_encoder = ObservationEncoder(num_players=num_players)
    obs_space = obs_encoder.get_observation_space()

    test_obs = {
        "player_board": np.random.randn(1, *obs_space["player_board"].shape).astype(np.float32),
        "opponent_boards": np.random.randn(1, *obs_space["opponent_boards"].shape).astype(np.float32),
        "available_cards": np.random.randn(1, *obs_space["available_cards"].shape).astype(np.float32),
        "resources": np.random.randn(1, *obs_space["resources"].shape).astype(np.float32),
        "game_info": np.random.randn(1, *obs_space["game_info"].shape).astype(np.float32),
        "action_mask": np.ones((1, 12 * 45), dtype=np.float32),
    }

    # Run ONNX inference
    ort_inputs = {
        "player_board": test_obs["player_board"],
        "opponent_boards": test_obs["opponent_boards"],
        "available_cards": test_obs["available_cards"],
        "resources": test_obs["resources"],
        "game_info": test_obs["game_info"],
        "action_mask": test_obs["action_mask"],
    }
    ort_outputs = ort_session.run(None, ort_inputs)

    # Run PyTorch inference
    with torch.no_grad():
        torch_obs = {k: torch.from_numpy(v) for k, v in test_obs.items()}
        features = model.policy.extract_features(torch_obs)
        latent_pi, latent_vf = model.policy.mlp_extractor(features)
        action_logits = model.policy.action_net(latent_pi)
        value = model.policy.value_net(latent_vf)

        masked_logits = action_logits.clone()
        masked_logits[torch_obs["action_mask"] == 0] = float("-inf")
        action_probs = torch.softmax(masked_logits, dim=-1)

    # Compare outputs
    onnx_probs = ort_outputs[0]
    torch_probs = action_probs.numpy()

    # Allow small numerical differences
    max_diff = np.max(np.abs(onnx_probs - torch_probs))
    print(f"Max probability difference: {max_diff:.6f}")

    return max_diff < 1e-4
