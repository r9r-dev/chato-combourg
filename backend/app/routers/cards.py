"""Cards data router for serving card attributes and effects."""

import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/cards", tags=["cards"])

# Paths to card data files
CARDS_DIR = Path(__file__).parent.parent.parent / "cards"
ATTRIBUTES_FILE = CARDS_DIR / "card_attributes.json"
EFFECTS_FILE = CARDS_DIR / "card_effects.json"

# Cache for card data
_attributes_cache: dict | None = None
_effects_cache: dict | None = None


def load_attributes() -> dict:
    """Load and cache card attributes."""
    global _attributes_cache
    if _attributes_cache is None:
        with open(ATTRIBUTES_FILE, "r", encoding="utf-8") as f:
            _attributes_cache = json.load(f)
    return _attributes_cache


def load_effects() -> dict:
    """Load and cache card effects."""
    global _effects_cache
    if _effects_cache is None:
        with open(EFFECTS_FILE, "r", encoding="utf-8") as f:
            _effects_cache = json.load(f)
    return _effects_cache


@router.get("/attributes")
async def get_card_attributes() -> dict:
    """
    Get all card attributes.

    Returns a dictionary mapping card IDs to their attributes:
    - value: Card cost (0-8)
    - shields: Array of {count, color}
    - category: "village" | "castle" | null
    - has_messenger: Boolean
    - has_price_reduction: Boolean
    - has_lock: Boolean
    - has_coin_purse: Boolean
    - max_coins: Number
    """
    return load_attributes()


@router.get("/effects")
async def get_card_effects() -> dict:
    """
    Get all card effects for the Play mode.

    Returns a dictionary mapping card IDs to their effects:
    - has_messenger: Boolean
    - effects: Array of effect objects
    - lock_effect: Effect triggered when using a key on the card's lock
    """
    return load_effects()
