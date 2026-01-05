"""Centralized card data loader.

This module provides a single source of truth for all card data,
loaded from the unified cards_data.json file.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

# Cards directory path
CARDS_DIR = Path(__file__).parent.parent.parent / "cards"
CARDS_DATA_FILE = CARDS_DIR / "cards_data.json"


@lru_cache(maxsize=1)
def load_cards_data() -> dict[str, dict[str, Any]]:
    """Load all card data from the unified JSON file.

    Returns a dictionary mapping card IDs (e.g., "001") to card data.
    Cached after first load for performance.
    """
    with open(CARDS_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_card(card_id: str) -> dict[str, Any]:
    """Get data for a specific card by ID."""
    data = load_cards_data()
    if card_id not in data:
        raise KeyError(f"Unknown card ID: {card_id}")
    return data[card_id]


def get_all_cards() -> list[dict[str, Any]]:
    """Get all cards as a list."""
    return list(load_cards_data().values())


def get_card_attributes(card_id: str) -> dict[str, Any]:
    """Get attributes for a card (value, shields, category, flags)."""
    card = get_card(card_id)
    return {
        "value": card["value"],
        "shields": card["shields"],
        "category": card["category"],
        "has_messenger": card["has_messenger"],
        "has_price_reduction": card["has_price_reduction"],
        "has_lock": card["has_lock"],
        "has_coin_purse": card["has_coin_purse"],
        "max_coins": card["max_coins"],
    }


def get_all_attributes() -> dict[str, dict[str, Any]]:
    """Get attributes for all cards, keyed by card ID."""
    data = load_cards_data()
    return {
        card_id: {
            "value": card["value"],
            "shields": card["shields"],
            "category": card["category"],
            "has_messenger": card["has_messenger"],
            "has_price_reduction": card["has_price_reduction"],
            "has_lock": card["has_lock"],
            "has_coin_purse": card["has_coin_purse"],
            "max_coins": card["max_coins"],
        }
        for card_id, card in data.items()
    }


def get_card_effects(card_id: str) -> dict[str, Any]:
    """Get effects for a card (effects, lock_effect)."""
    card = get_card(card_id)
    result = {
        "has_messenger": card["has_messenger"],
        "effects": card["effects"],
        "lock_effect": card["lock_effect"],
    }
    # Include flipped card fields if present
    if card.get("is_flipped"):
        result["is_flipped"] = card["is_flipped"]
        result["flipped_from"] = card.get("flipped_from")
    return result


def get_all_effects() -> dict[str, dict[str, Any]]:
    """Get effects for all cards, keyed by card ID."""
    data = load_cards_data()
    result = {}
    for card_id, card in data.items():
        effects = {
            "has_messenger": card["has_messenger"],
            "effects": card["effects"],
            "lock_effect": card["lock_effect"],
        }
        # Include flipped card fields if present
        if card.get("is_flipped"):
            effects["is_flipped"] = card["is_flipped"]
            effects["flipped_from"] = card.get("flipped_from")
        result[card_id] = effects
    return result


def get_card_list() -> list[dict[str, str]]:
    """Get basic card info (id, name, file_name) for all cards."""
    data = load_cards_data()
    return [
        {
            "id": card["id"],
            "name": card["name"],
            "file-name": card["file_name"],  # Keep original key for compatibility
        }
        for card in data.values()
    ]
