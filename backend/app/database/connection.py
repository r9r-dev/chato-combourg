from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Ensure database directory exists
settings.database_dir.mkdir(parents=True, exist_ok=True)

# Compute database URL if not provided
if settings.database_url:
    DATABASE_URL = settings.database_url
else:
    db_path = settings.database_dir / "chato.db"
    DATABASE_URL = f"sqlite:///{db_path}"

# SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite specific
    echo=False,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and run migrations."""
    # Create all tables from models
    Base.metadata.create_all(bind=engine)

    # Run pending migrations
    from app.database.migrations import run_migrations
    run_migrations(engine)
