from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App version
    app_version: str = "1.6.0"

    # Paths
    base_dir: Path = Path(__file__).parent.parent
    cards_dir: Path = base_dir / "cards"
    cards_json: Path = cards_dir / "cards.json"

    # YOLO settings
    yolo_confidence_threshold: float = 0.3

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    max_upload_size: int = 20 * 1024 * 1024  # 20MB

    # Database settings
    database_dir: Path = base_dir / "data"
    database_url: str = ""  # Will be computed if empty

    # Authentication (Pangolin proxy)
    dev_mode: bool = False  # If True, use fake user for development
    dev_user_id: str = "dev-user-001"
    dev_user_email: str = "dev@localhost"
    dev_user_name: str = "Développeur Local"

    # Analysis captures - saves images and reports to data/captures/
    captures_dir: Path = database_dir / "captures"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
