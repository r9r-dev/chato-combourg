"""Self-play training for Chateau Combo.

Implements:
- Opponent pool with historical checkpoints
- Rotating opponent selection
- Elo-based matchmaking (optional)
"""

from __future__ import annotations

import random
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
from sb3_contrib import MaskablePPO
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv

from ..env import ChatoEnv
from ..models.policy import ChatoPolicy, create_policy_kwargs
from .config import TrainingConfig


class OpponentPool:
    """Pool of historical model checkpoints for self-play."""

    def __init__(
        self,
        max_size: int = 10,
        sample_latest_prob: float = 0.5,
    ):
        """Initialize opponent pool.

        Args:
            max_size: Maximum number of opponents to keep
            sample_latest_prob: Probability of sampling the latest opponent
        """
        self.max_size = max_size
        self.sample_latest_prob = sample_latest_prob
        self.opponents: deque[dict[str, Any]] = deque(maxlen=max_size)
        self.elos: dict[int, float] = {}  # opponent_id -> elo

    def add(self, model: MaskablePPO, timestep: int) -> int:
        """Add a new opponent to the pool.

        Args:
            model: The model to add
            timestep: Training timestep when this model was saved

        Returns:
            Opponent ID
        """
        opponent_id = len(self.opponents)

        # Save model state dict
        policy_state = {
            k: v.cpu().clone() for k, v in model.policy.state_dict().items()
        }

        self.opponents.append({
            "id": opponent_id,
            "timestep": timestep,
            "policy_state": policy_state,
        })

        # Initialize Elo
        self.elos[opponent_id] = 1000.0

        return opponent_id

    def sample(self) -> dict[str, Any] | None:
        """Sample an opponent from the pool.

        Returns:
            Opponent dict or None if pool is empty
        """
        if not self.opponents:
            return None

        # With some probability, always use the latest
        if random.random() < self.sample_latest_prob:
            return self.opponents[-1]

        # Otherwise, sample based on recency (more recent = higher prob)
        weights = np.array([i + 1 for i in range(len(self.opponents))])
        weights = weights / weights.sum()

        idx = np.random.choice(len(self.opponents), p=weights)
        return self.opponents[idx]

    def get_latest(self) -> dict[str, Any] | None:
        """Get the most recent opponent."""
        return self.opponents[-1] if self.opponents else None

    def load_opponent_policy(
        self,
        opponent: dict[str, Any],
        model: MaskablePPO,
    ) -> MaskablePPO:
        """Load opponent's policy state into a model.

        Args:
            opponent: Opponent dict from the pool
            model: Model to load state into

        Returns:
            Model with loaded state
        """
        model.policy.load_state_dict(opponent["policy_state"])
        return model

    def update_elo(
        self,
        opponent_id: int,
        agent_score: float,
        opponent_score: float,
        k: float = 32.0,
    ) -> None:
        """Update Elo rating after a game.

        Args:
            opponent_id: ID of the opponent
            agent_score: Agent's score (0-1, 1=win, 0.5=draw)
            opponent_score: Opponent's score
            k: Elo K-factor
        """
        if opponent_id not in self.elos:
            return

        # Simple Elo update (assuming agent is always 1000)
        agent_elo = 1000.0
        opponent_elo = self.elos[opponent_id]

        expected_agent = 1 / (1 + 10 ** ((opponent_elo - agent_elo) / 400))

        # Update opponent Elo (inverse of agent's result)
        self.elos[opponent_id] += k * (opponent_score - (1 - expected_agent))

    def __len__(self) -> int:
        return len(self.opponents)


class SelfPlayTrainer:
    """Self-play training manager."""

    def __init__(self, config: TrainingConfig):
        """Initialize trainer.

        Args:
            config: Training configuration
        """
        self.config = config
        self.opponent_pool = OpponentPool(
            max_size=config.opponent_pool_size,
            sample_latest_prob=config.opponent_sample_latest_prob,
        )

        # Create directories
        config.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        config.log_dir.mkdir(parents=True, exist_ok=True)

        # Initialize environment and model
        self.env = self._create_env()
        self.model = self._create_model()

        # Current opponent policy (for env to use)
        self.current_opponent: MaskablePPO | None = None

    def _create_env(self, opponent_policy=None) -> DummyVecEnv | SubprocVecEnv:
        """Create vectorized environment."""

        def make_env(rank: int):
            def _init():
                env = ChatoEnv(
                    num_players=self.config.num_players,
                    opponent_policy=opponent_policy,
                    seed=rank,
                )
                return env
            return _init

        if self.config.num_envs == 1:
            return DummyVecEnv([make_env(0)])

        # Use SubprocVecEnv for parallel envs
        return SubprocVecEnv([make_env(i) for i in range(self.config.num_envs)])

    def _create_model(self) -> MaskablePPO:
        """Create the MaskablePPO model."""
        policy_kwargs = create_policy_kwargs(
            use_transformer=self.config.use_transformer,
            features_dim=self.config.features_dim,
            d_model=self.config.d_model,
            num_heads=self.config.num_heads,
            num_layers=self.config.num_layers,
            num_players=self.config.num_players,
        )

        return MaskablePPO(
            ChatoPolicy,
            self.env,
            learning_rate=self.config.learning_rate,
            n_steps=self.config.n_steps,
            batch_size=self.config.batch_size,
            n_epochs=self.config.n_epochs,
            gamma=self.config.gamma,
            gae_lambda=self.config.gae_lambda,
            clip_range=self.config.clip_range,
            ent_coef=self.config.ent_coef,
            vf_coef=self.config.vf_coef,
            max_grad_norm=self.config.max_grad_norm,
            policy_kwargs=policy_kwargs,
            verbose=1,
            tensorboard_log=str(self.config.log_dir),
            device=self.config.device,
        )

    def train(self) -> MaskablePPO:
        """Run self-play training.

        Returns:
            Trained model
        """
        from .callbacks import SelfPlayCallback, EvaluationCallback

        # Create callbacks
        callbacks = [
            SelfPlayCallback(
                trainer=self,
                update_freq=self.config.opponent_update_freq,
            ),
            EvaluationCallback(
                eval_env=ChatoEnv(num_players=self.config.num_players),
                eval_freq=self.config.eval_freq,
                n_eval_episodes=10,
            ),
        ]

        # Add initial opponent (random policy)
        self.opponent_pool.add(self.model, 0)

        # Train
        self.model.learn(
            total_timesteps=self.config.total_timesteps,
            callback=callbacks,
            log_interval=self.config.log_interval,
        )

        # Save final model
        final_path = self.config.checkpoint_dir / "final_model.zip"
        self.model.save(str(final_path))

        return self.model

    def update_opponent(self, timestep: int) -> None:
        """Add current model to opponent pool.

        Args:
            timestep: Current training timestep
        """
        # Add current model to pool
        self.opponent_pool.add(self.model, timestep)

        # Save checkpoint
        checkpoint_path = self.config.checkpoint_dir / f"checkpoint_{timestep}.zip"
        self.model.save(str(checkpoint_path))

        # Update environment with new opponent
        opponent = self.opponent_pool.sample()
        if opponent:
            # Create a new model instance for opponent
            if self.current_opponent is None:
                self.current_opponent = MaskablePPO.load(
                    str(checkpoint_path),
                    device="cpu",  # Keep opponent on CPU to save GPU memory
                )
            else:
                self.opponent_pool.load_opponent_policy(opponent, self.current_opponent)

            # Recreate env with new opponent
            self.env.close()
            self.env = self._create_env(opponent_policy=self.current_opponent)
            self.model.set_env(self.env)

    def load_checkpoint(self, path: str | Path) -> None:
        """Load a checkpoint.

        Args:
            path: Path to checkpoint
        """
        self.model = MaskablePPO.load(str(path), env=self.env)

    def evaluate(self, n_games: int = 100) -> dict[str, float]:
        """Evaluate current model against random opponents.

        Args:
            n_games: Number of games to play

        Returns:
            Evaluation metrics
        """
        wins = 0
        total_reward = 0.0

        env = ChatoEnv(num_players=self.config.num_players)

        for _ in range(n_games):
            obs, _ = env.reset()
            done = False
            episode_reward = 0.0

            while not done:
                action_mask = obs["action_mask"]
                action, _ = self.model.predict(
                    obs,
                    deterministic=True,
                    action_masks=action_mask,
                )
                obs, reward, terminated, truncated, info = env.step(action)
                episode_reward += reward
                done = terminated or truncated

            total_reward += episode_reward
            if info.get("agent_rank", 2) == 1:
                wins += 1

        env.close()

        return {
            "win_rate": wins / n_games,
            "mean_reward": total_reward / n_games,
        }
