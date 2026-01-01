#!/usr/bin/env python3
"""
Migration script to add card_scores and is_legacy columns to game_players table.
Run this script once to update existing databases.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/migrate_add_legacy_fields.py
"""

import sqlite3
import sys
from pathlib import Path

# Default database path
DEFAULT_DB_PATH = Path(__file__).parent.parent / "data" / "chato.db"


def migrate(db_path: Path) -> bool:
    """Add card_scores and is_legacy columns to game_players table."""
    if not db_path.exists():
        print(f"Database not found: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(game_players)")
        columns = {row[1] for row in cursor.fetchall()}

        changes_made = False

        # Add card_scores column if not exists
        if "card_scores" not in columns:
            print("Adding 'card_scores' column...")
            cursor.execute(
                "ALTER TABLE game_players ADD COLUMN card_scores TEXT DEFAULT NULL"
            )
            changes_made = True
        else:
            print("Column 'card_scores' already exists")

        # Add is_legacy column if not exists
        if "is_legacy" not in columns:
            print("Adding 'is_legacy' column...")
            cursor.execute(
                "ALTER TABLE game_players ADD COLUMN is_legacy INTEGER DEFAULT 0"
            )
            changes_made = True
        else:
            print("Column 'is_legacy' already exists")

        if changes_made:
            conn.commit()
            print("Migration completed successfully!")
        else:
            print("No changes needed - database is already up to date")

        return True

    except sqlite3.Error as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()


if __name__ == "__main__":
    # Use provided path or default
    if len(sys.argv) > 1:
        db_path = Path(sys.argv[1])
    else:
        db_path = DEFAULT_DB_PATH

    print(f"Migrating database: {db_path}")
    success = migrate(db_path)
    sys.exit(0 if success else 1)
