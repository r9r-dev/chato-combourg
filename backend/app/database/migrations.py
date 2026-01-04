"""Database migration system.

Runs migrations automatically at startup to keep the database schema up to date.
Each migration is executed only once and tracked in the schema_migrations table.
"""

import logging
from typing import Callable

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Type alias for migration functions
MigrationFunc = Callable[[Engine], None]


# Registry of migrations (version -> migration function)
MIGRATIONS: dict[int, tuple[str, MigrationFunc]] = {}


def migration(version: int, description: str):
    """Decorator to register a migration function."""
    def decorator(func: MigrationFunc) -> MigrationFunc:
        MIGRATIONS[version] = (description, func)
        return func
    return decorator


def _ensure_migrations_table(engine: Engine) -> None:
    """Create the schema_migrations table if it doesn't exist."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.commit()


def _get_applied_versions(engine: Engine) -> set[int]:
    """Get the set of already applied migration versions."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version FROM schema_migrations"))
        return {row[0] for row in result.fetchall()}


def _mark_applied(engine: Engine, version: int, description: str) -> None:
    """Mark a migration as applied."""
    with engine.connect() as conn:
        conn.execute(
            text("INSERT INTO schema_migrations (version, description) VALUES (:v, :d)"),
            {"v": version, "d": description}
        )
        conn.commit()


def run_migrations(engine: Engine) -> int:
    """Run all pending migrations.

    Returns:
        Number of migrations applied.
    """
    _ensure_migrations_table(engine)
    applied = _get_applied_versions(engine)

    pending = sorted(v for v in MIGRATIONS.keys() if v not in applied)
    if not pending:
        logger.info("Database schema is up to date")
        return 0

    logger.info(f"Found {len(pending)} pending migration(s)")

    for version in pending:
        description, func = MIGRATIONS[version]
        logger.info(f"Applying migration {version}: {description}")
        try:
            func(engine)
            _mark_applied(engine, version, description)
            logger.info(f"Migration {version} applied successfully")
        except Exception as e:
            logger.error(f"Migration {version} failed: {e}")
            raise

    return len(pending)


# ============================================================================
# MIGRATIONS
# ============================================================================

@migration(1, "Add card_scores column to game_players")
def migration_001_add_card_scores(engine: Engine) -> None:
    """Add card_scores column to store individual card scores."""
    with engine.connect() as conn:
        # Check if column already exists (SQLite doesn't support IF NOT EXISTS for columns)
        result = conn.execute(text("PRAGMA table_info(game_players)"))
        columns = {row[1] for row in result.fetchall()}

        if "card_scores" not in columns:
            conn.execute(text(
                "ALTER TABLE game_players ADD COLUMN card_scores JSON"
            ))
            conn.commit()
            logger.info("Added card_scores column to game_players")
        else:
            logger.info("Column card_scores already exists, skipping")


@migration(2, "Add is_legacy column to game_players")
def migration_002_add_is_legacy(engine: Engine) -> None:
    """Add is_legacy column to mark imported games without card data."""
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(game_players)"))
        columns = {row[1] for row in result.fetchall()}

        if "is_legacy" not in columns:
            conn.execute(text(
                "ALTER TABLE game_players ADD COLUMN is_legacy INTEGER DEFAULT 0"
            ))
            conn.commit()
            logger.info("Added is_legacy column to game_players")
        else:
            logger.info("Column is_legacy already exists, skipping")


@migration(3, "Add source column to games")
def migration_003_add_source(engine: Engine) -> None:
    """Add source column to distinguish game origin: scan, legacy, application."""
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(games)"))
        columns = {row[1] for row in result.fetchall()}

        if "source" not in columns:
            conn.execute(text(
                "ALTER TABLE games ADD COLUMN source TEXT DEFAULT 'scan'"
            ))
            conn.commit()
            logger.info("Added source column to games")
        else:
            logger.info("Column source already exists, skipping")


@migration(4, "Add is_ai column to players")
def migration_004_add_is_ai(engine: Engine) -> None:
    """Add is_ai column to distinguish AI players from human players."""
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(players)"))
        columns = {row[1] for row in result.fetchall()}

        if "is_ai" not in columns:
            conn.execute(text(
                "ALTER TABLE players ADD COLUMN is_ai INTEGER DEFAULT 0"
            ))
            conn.commit()
            logger.info("Added is_ai column to players")
        else:
            logger.info("Column is_ai already exists, skipping")
