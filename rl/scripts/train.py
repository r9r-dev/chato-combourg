#!/usr/bin/env python3
"""Training script for Chateau Combo RL agent."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from chato_rl.training import SelfPlayTrainer, TrainingConfig
from chato_rl.training.config import ColabConfig, DebugConfig


def main():
    parser = argparse.ArgumentParser(description="Train Chateau Combo RL agent")

    parser.add_argument(
        "--config",
        type=str,
        default="default",
        choices=["default", "colab", "debug"],
        help="Training configuration preset",
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=None,
        help="Path to checkpoint to resume from",
    )
    parser.add_argument(
        "--timesteps",
        type=int,
        default=None,
        help="Override total timesteps",
    )
    parser.add_argument(
        "--num-envs",
        type=int,
        default=None,
        help="Override number of parallel environments",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Device to use (cpu, cuda, mps, auto)",
    )
    parser.add_argument(
        "--use-mlp",
        action="store_true",
        help="Use MLP instead of Transformer",
    )
    parser.add_argument(
        "--checkpoint-dir",
        type=str,
        default=None,
        help="Directory for checkpoints",
    )
    parser.add_argument(
        "--log-dir",
        type=str,
        default=None,
        help="Directory for tensorboard logs",
    )

    args = parser.parse_args()

    # Select configuration
    if args.config == "colab":
        config = ColabConfig()
    elif args.config == "debug":
        config = DebugConfig()
    else:
        config = TrainingConfig()

    # Apply overrides
    if args.timesteps is not None:
        config.total_timesteps = args.timesteps

    if args.num_envs is not None:
        config.num_envs = args.num_envs

    if args.device is not None:
        config.device = args.device

    if args.use_mlp:
        config.use_transformer = False

    if args.checkpoint_dir is not None:
        config.checkpoint_dir = Path(args.checkpoint_dir)

    if args.log_dir is not None:
        config.log_dir = Path(args.log_dir)

    # Print configuration
    print("=" * 60)
    print("Chateau Combo RL Training")
    print("=" * 60)
    print(f"Config: {args.config}")
    print(f"Total timesteps: {config.total_timesteps:,}")
    print(f"Parallel envs: {config.num_envs}")
    print(f"Device: {config.device}")
    print(f"Architecture: {'Transformer' if config.use_transformer else 'MLP'}")
    print(f"Checkpoint dir: {config.checkpoint_dir}")
    print(f"Log dir: {config.log_dir}")
    print("=" * 60)

    # Create trainer
    trainer = SelfPlayTrainer(config)

    # Load checkpoint if specified
    if args.checkpoint:
        print(f"Loading checkpoint: {args.checkpoint}")
        trainer.load_checkpoint(args.checkpoint)

    # Train
    print("\nStarting training...")
    model = trainer.train()

    # Final evaluation
    print("\nRunning final evaluation...")
    metrics = trainer.evaluate(n_games=100)
    print(f"Final win rate: {metrics['win_rate']:.1%}")
    print(f"Final mean reward: {metrics['mean_reward']:.2f}")

    print("\nTraining complete!")
    print(f"Final model saved to: {config.checkpoint_dir / 'final_model.zip'}")


if __name__ == "__main__":
    main()
