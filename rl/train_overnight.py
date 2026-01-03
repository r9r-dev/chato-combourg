"""Training script for overnight run on Mac."""

from pathlib import Path
from sb3_contrib import MaskablePPO
from chato_rl.training import SelfPlayTrainer
from chato_rl.training.config import TrainingConfig
from chato_rl.training.callbacks import EvaluationCallback, SelfPlayCallback
from chato_rl.env import ChatoEnv

# Configuration Mac M4
config = TrainingConfig()
config.device = 'mps'
config.num_envs = 8
config.total_timesteps = 19_400_000  # Remaining from 600k to 20M
config.log_dir = Path('logs')
config.checkpoint_dir = Path('checkpoints')
config.save_freq = 100_000  # Save every 100k steps
config.eval_freq = 50_000   # Eval every 50k steps

print("=" * 60)
print("ENTRAINEMENT EXTREME AI - SELF-PLAY")
print("=" * 60)
print(f"Device: {config.device}")
print(f"Envs: {config.num_envs}")
print(f"Timesteps: {config.total_timesteps:,}")
print(f"Checkpoints: {config.checkpoint_dir}")
print(f"Logs: {config.log_dir}")
print("=" * 60)

# Create trainer
trainer = SelfPlayTrainer(config)

# Load from checkpoint
checkpoint = 'checkpoints/checkpoint_600032.zip'
print(f"\nChargement checkpoint: {checkpoint}")
trainer.model = MaskablePPO.load(checkpoint, env=trainer.env, device='mps')
trainer.model.tensorboard_log = str(config.log_dir)

# Setup opponent pool
print("Setup opponent pool...")
trainer.opponent_pool.add(trainer.model, 600032)
trainer.update_opponent(600032)

# Callbacks
callbacks = [
    SelfPlayCallback(trainer=trainer, update_freq=200_000),
    EvaluationCallback(
        eval_env=ChatoEnv(num_players=2),
        eval_freq=config.eval_freq,
        n_eval_episodes=20,
    ),
]

print("\nDemarrage entrainement...")
print("Ctrl+C pour arreter proprement (sauvegarde automatique)\n")

try:
    trainer.model.learn(
        total_timesteps=config.total_timesteps,
        callback=callbacks,
        reset_num_timesteps=False,
        tb_log_name="extreme_ai_selfplay",
        log_interval=1,
    )
except KeyboardInterrupt:
    print("\n\nInterruption - Sauvegarde en cours...")

# Save final model
final_path = config.checkpoint_dir / "final_model.zip"
trainer.model.save(str(final_path))
print(f"\nModele sauvegarde: {final_path}")
print("ENTRAINEMENT TERMINE!")
