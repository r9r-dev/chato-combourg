#!/usr/bin/env python3
"""Evaluation script for trained Chateau Combo RL agent."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sb3_contrib import MaskablePPO

from chato_rl.env import ChatoEnv


def main():
    parser = argparse.ArgumentParser(description="Evaluate Chateau Combo RL agent")

    parser.add_argument(
        "checkpoint",
        type=str,
        help="Path to model checkpoint",
    )
    parser.add_argument(
        "--n-games",
        type=int,
        default=100,
        help="Number of games to play",
    )
    parser.add_argument(
        "--num-players",
        type=int,
        default=2,
        help="Number of players (2-5)",
    )
    parser.add_argument(
        "--render",
        action="store_true",
        help="Render games to console",
    )
    parser.add_argument(
        "--deterministic",
        action="store_true",
        help="Use deterministic actions",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Chateau Combo RL Evaluation")
    print("=" * 60)
    print(f"Checkpoint: {args.checkpoint}")
    print(f"Games: {args.n_games}")
    print(f"Players: {args.num_players}")
    print("=" * 60)

    # Load model
    print("\nLoading model...")
    model = MaskablePPO.load(args.checkpoint)

    # Create environment
    render_mode = "human" if args.render else None
    env = ChatoEnv(num_players=args.num_players, render_mode=render_mode)

    # Run evaluation
    wins = 0
    total_reward = 0.0
    ranks = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    print("\nRunning evaluation...")
    for game in range(args.n_games):
        obs, _ = env.reset()
        done = False
        episode_reward = 0.0

        while not done:
            action_mask = obs["action_mask"]
            action, _ = model.predict(
                obs,
                deterministic=args.deterministic,
                action_masks=action_mask,
            )
            obs, reward, terminated, truncated, info = env.step(action)
            episode_reward += reward
            done = terminated or truncated

        total_reward += episode_reward
        rank = info.get("agent_rank", args.num_players)
        ranks[rank] = ranks.get(rank, 0) + 1

        if rank == 1:
            wins += 1

        if (game + 1) % 10 == 0:
            print(f"Game {game + 1}/{args.n_games}: Win rate = {wins / (game + 1):.1%}")

    env.close()

    # Print results
    print("\n" + "=" * 60)
    print("Results")
    print("=" * 60)
    print(f"Games played: {args.n_games}")
    print(f"Wins: {wins} ({wins / args.n_games:.1%})")
    print(f"Mean reward: {total_reward / args.n_games:.2f}")
    print("\nRank distribution:")
    for rank in range(1, args.num_players + 1):
        count = ranks.get(rank, 0)
        print(f"  {rank}st place: {count} ({count / args.n_games:.1%})")


if __name__ == "__main__":
    main()
