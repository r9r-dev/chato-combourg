from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App version
    app_version: str = "3.10.2"

    # Paths
    base_dir: Path = Path(__file__).parent.parent
    cards_dir: Path = base_dir / "cards"

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

    # Worker d'inférence distant (macdaemon sur le Mac mini)
    # PYTORCH_WORKER_URL=http://10.0.0.186:1337/api/v1/chato active l'inférence distante ;
    # PYTORCH_WORKER_TOKEN porte le jeton « chato » (Authorization: Bearer).
    pytorch_worker_url: str = ""
    pytorch_worker_token: str = ""
    pytorch_worker_timeout: float = 10.0  # seconds


settings = Settings()
