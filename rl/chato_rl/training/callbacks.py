"""Training callbacks for self-play and evaluation."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
from stable_baselines3.common.callbacks import BaseCallback, EvalCallback

if TYPE_CHECKING:
    from .self_play import SelfPlayTrainer


class SelfPlayCallback(BaseCallback):
    """Callback for self-play opponent updates."""

    def __init__(
        self,
        trainer: SelfPlayTrainer,
        update_freq: int = 100_000,
        verbose: int = 1,
    ):
        """Initialize callback.

        Args:
            trainer: SelfPlayTrainer instance
            update_freq: How often to update opponent pool (timesteps)
            verbose: Verbosity level
        """
        super().__init__(verbose)
        self.trainer = trainer
        self.update_freq = update_freq
        self.last_update = 0

    def _on_step(self) -> bool:
        """Called after each step."""
        if self.num_timesteps - self.last_update >= self.update_freq:
            if self.verbose > 0:
                print(f"\n[SelfPlay] Updating opponent pool at timestep {self.num_timesteps}")
                print(f"[SelfPlay] Pool size: {len(self.trainer.opponent_pool)}")

            self.trainer.update_opponent(self.num_timesteps)
            self.last_update = self.num_timesteps

        return True


class EvaluationCallback(BaseCallback):
    """Callback for periodic evaluation."""

    def __init__(
        self,
        eval_env,
        eval_freq: int = 10_000,
        n_eval_episodes: int = 10,
        verbose: int = 1,
    ):
        """Initialize callback.

        Args:
            eval_env: Environment for evaluation
            eval_freq: How often to evaluate (timesteps)
            n_eval_episodes: Number of evaluation episodes
            verbose: Verbosity level
        """
        super().__init__(verbose)
        self.eval_env = eval_env
        self.eval_freq = eval_freq
        self.n_eval_episodes = n_eval_episodes
        self.last_eval = 0
        self.best_mean_reward = -np.inf

    def _on_step(self) -> bool:
        """Called after each step."""
        if self.num_timesteps - self.last_eval >= self.eval_freq:
            self._evaluate()
            self.last_eval = self.num_timesteps

        return True

    def _evaluate(self) -> None:
        """Run evaluation."""
        rewards = []
        wins = 0

        for _ in range(self.n_eval_episodes):
            obs, _ = self.eval_env.reset()
            done = False
            episode_reward = 0.0

            while not done:
                action_mask = obs.get("action_mask")
                action, _ = self.model.predict(
                    obs,
                    deterministic=True,
                    action_masks=action_mask,
                )
                obs, reward, terminated, truncated, info = self.eval_env.step(action)
                episode_reward += reward
                done = terminated or truncated

            rewards.append(episode_reward)
            if info.get("agent_rank", 2) == 1:
                wins += 1

        mean_reward = np.mean(rewards)
        std_reward = np.std(rewards)
        win_rate = wins / self.n_eval_episodes

        if self.verbose > 0:
            print(f"\n[Eval] Timestep {self.num_timesteps}")
            print(f"[Eval] Mean reward: {mean_reward:.2f} +/- {std_reward:.2f}")
            print(f"[Eval] Win rate: {win_rate:.1%}")

        # Log to tensorboard
        if self.logger is not None:
            self.logger.record("eval/mean_reward", mean_reward)
            self.logger.record("eval/std_reward", std_reward)
            self.logger.record("eval/win_rate", win_rate)

        # Save best model
        if mean_reward > self.best_mean_reward:
            self.best_mean_reward = mean_reward
            if self.verbose > 0:
                print(f"[Eval] New best model! Reward: {mean_reward:.2f}")

            # Save through trainer if available
            if hasattr(self, "trainer") and self.trainer is not None:
                best_path = self.trainer.config.checkpoint_dir / "best_model.zip"
                self.model.save(str(best_path))


class ProgressCallback(BaseCallback):
    """Callback for progress reporting."""

    def __init__(
        self,
        total_timesteps: int,
        report_freq: int = 10_000,
        verbose: int = 1,
    ):
        """Initialize callback.

        Args:
            total_timesteps: Total training timesteps
            report_freq: How often to report progress
            verbose: Verbosity level
        """
        super().__init__(verbose)
        self.total_timesteps = total_timesteps
        self.report_freq = report_freq
        self.last_report = 0

    def _on_step(self) -> bool:
        """Called after each step."""
        if self.num_timesteps - self.last_report >= self.report_freq:
            progress = self.num_timesteps / self.total_timesteps
            if self.verbose > 0:
                print(f"\n[Progress] {progress:.1%} ({self.num_timesteps:,} / {self.total_timesteps:,})")

            self.last_report = self.num_timesteps

        return True


class TensorboardCallback(BaseCallback):
    """Callback for additional tensorboard logging."""

    def __init__(self, verbose: int = 0):
        super().__init__(verbose)

    def _on_step(self) -> bool:
        """Called after each step."""
        # Log additional metrics from info
        infos = self.locals.get("infos", [])
        for info in infos:
            if "turn_number" in info:
                self.logger.record("game/turn_number", info["turn_number"])
            if "cards_placed" in info:
                self.logger.record("game/cards_placed", info["cards_placed"])
            if "gold" in info:
                self.logger.record("game/gold", info["gold"])
            if "keys" in info:
                self.logger.record("game/keys", info["keys"])

        return True
