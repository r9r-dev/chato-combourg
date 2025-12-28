from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Paths
    base_dir: Path = Path(__file__).parent.parent
    cards_dir: Path = base_dir / "cards"
    embeddings_dir: Path = base_dir / "embeddings"
    cards_json: Path = cards_dir / "cards.json"

    # CLIP settings
    clip_model: str = "ViT-B/32"
    clip_confidence_threshold: float = 0.75  # Lower threshold to trigger Claude fallback
    top_k_matches: int = 6

    # Claude API settings
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    max_upload_size: int = 20 * 1024 * 1024  # 20MB

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
