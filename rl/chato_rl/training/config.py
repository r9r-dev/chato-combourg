"""Training configuration."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TrainingConfig:
    """Configuration for RL training."""

    # Environment
    num_players: int = 2
    num_envs: int = 8  # Parallel environments

    # Model architecture
    use_transformer: bool = True
    features_dim: int = 128
    d_model: int = 64
    num_heads: int = 4
    num_layers: int = 2

    # PPO hyperparameters
    learning_rate: float = 3e-4
    n_steps: int = 2048
    batch_size: int = 64
    n_epochs: int = 10
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_range: float = 0.2
    ent_coef: float = 0.01
    vf_coef: float = 0.5
    max_grad_norm: float = 0.5

    # Training schedule
    total_timesteps: int = 10_000_000
    eval_freq: int = 10_000
    save_freq: int = 50_000
    log_interval: int = 1

    # Self-play
    opponent_pool_size: int = 10
    opponent_update_freq: int = 100_000
    opponent_sample_latest_prob: float = 0.5

    # Checkpointing
    checkpoint_dir: Path = field(default_factory=lambda: Path("checkpoints"))
    log_dir: Path = field(default_factory=lambda: Path("logs"))

    # Device
    device: str = "auto"  # "cpu", "cuda", "mps", or "auto"

    def __post_init__(self):
        """Ensure paths are Path objects."""
        if isinstance(self.checkpoint_dir, str):
            self.checkpoint_dir = Path(self.checkpoint_dir)
        if isinstance(self.log_dir, str):
            self.log_dir = Path(self.log_dir)


@dataclass
class ColabConfig(TrainingConfig):
    """Configuration optimized for Google Colab T4."""

    # T4 GPU with 16GB VRAM
    num_envs: int = 16
    batch_size: int = 128

    # More aggressive training
    learning_rate: float = 5e-4
    n_steps: int = 1024

    # Smaller model for faster iteration
    d_model: int = 32
    num_heads: int = 2
    num_layers: int = 1
    features_dim: int = 64

    # Checkpointing to Google Drive
    checkpoint_dir: Path = field(default_factory=lambda: Path("/content/drive/MyDrive/chato_rl/checkpoints"))
    log_dir: Path = field(default_factory=lambda: Path("/content/drive/MyDrive/chato_rl/logs"))

    device: str = "cuda"


@dataclass
class A100Config(TrainingConfig):
    """Configuration optimized for A100 GPU (40GB/80GB VRAM)."""

    # A100 can handle much more parallelism
    num_envs: int = 32
    batch_size: int = 512

    # Larger model - A100 can handle it
    use_transformer: bool = True
    d_model: int = 128
    num_heads: int = 8
    num_layers: int = 4
    features_dim: int = 256

    # PPO hyperparameters optimized for larger batches
    learning_rate: float = 3e-4
    n_steps: int = 2048
    n_epochs: int = 10
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_range: float = 0.2
    ent_coef: float = 0.01

    # More frequent evaluation on fast hardware
    eval_freq: int = 25_000
    save_freq: int = 100_000
    opponent_update_freq: int = 200_000

    # Training target
    total_timesteps: int = 20_000_000  # 20M steps

    # Checkpointing to Google Drive
    checkpoint_dir: Path = field(default_factory=lambda: Path("/content/drive/MyDrive/chato_rl/checkpoints"))
    log_dir: Path = field(default_factory=lambda: Path("/content/drive/MyDrive/chato_rl/logs"))

    device: str = "cuda"


@dataclass
class DebugConfig(TrainingConfig):
    """Configuration for debugging."""

    num_envs: int = 1
    total_timesteps: int = 1000
    eval_freq: int = 100
    save_freq: int = 500
    n_steps: int = 64
    batch_size: int = 32

    # Simpler model
    use_transformer: bool = False
    features_dim: int = 32

    device: str = "cpu"
