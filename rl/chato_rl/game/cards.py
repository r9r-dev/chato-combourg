"""Card database - loads card data from JSON files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import Card, CardCategory, Shield, ShieldColor


class CardDatabase:
    """Singleton database of all 92 cards."""

    _instance: CardDatabase | None = None
    _cards: dict[str, Card] = {}
    _effects: dict[str, dict] = {}

    def __new__(cls) -> CardDatabase:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_cards()
        return cls._instance

    def _load_cards(self) -> None:
        """Load card data from JSON files."""
        # Find the backend cards directory
        # Use resolve() to handle symlinks in editable installs
        current_dir = Path(__file__).resolve().parent
        # rl/chato_rl/game -> chato-combourg (3 parents from rl/)
        project_root = current_dir.parent.parent.parent.parent
        cards_dir = project_root / "backend" / "cards"

        # Fallback: search upward for backend/cards
        if not cards_dir.exists():
            search_dir = current_dir
            for _ in range(10):  # Max 10 levels up
                candidate = search_dir / "backend" / "cards"
                if candidate.exists():
                    cards_dir = candidate
                    break
                search_dir = search_dir.parent

        attributes_path = cards_dir / "card_attributes.json"
        effects_path = cards_dir / "card_effects.json"

        if not attributes_path.exists():
            raise FileNotFoundError(f"Card attributes not found at {attributes_path}")

        with open(attributes_path) as f:
            attributes_data: dict[str, Any] = json.load(f)

        # Load effects if available
        if effects_path.exists():
            with open(effects_path) as f:
                self._effects = json.load(f)

        # Parse each card
        for card_id, attrs in attributes_data.items():
            shields = []
            for shield_data in attrs.get("shields", []):
                shields.append(
                    Shield(
                        count=shield_data["count"],
                        color=ShieldColor(shield_data["color"]),
                    )
                )

            category = None
            if attrs.get("category"):
                category = CardCategory(attrs["category"])

            self._cards[card_id] = Card(
                id=card_id,
                value=attrs.get("value", 0),
                shields=shields,
                category=category,
                has_messenger=attrs.get("has_messenger", False),
                has_price_reduction=attrs.get("has_price_reduction", False),
                has_lock=attrs.get("has_lock", False),
                has_coin_purse=attrs.get("has_coin_purse", False),
                max_coins=attrs.get("max_coins", 0),
            )

    def get(self, card_id: str) -> Card:
        """Get a card by ID."""
        if card_id not in self._cards:
            raise KeyError(f"Unknown card ID: {card_id}")
        return self._cards[card_id]

    def get_effects(self, card_id: str) -> dict | None:
        """Get card effects by ID."""
        return self._effects.get(card_id)

    def all_cards(self) -> list[Card]:
        """Get all cards."""
        return list(self._cards.values())

    def all_card_ids(self) -> list[str]:
        """Get all card IDs sorted."""
        return sorted(self._cards.keys())

    @property
    def num_cards(self) -> int:
        """Total number of cards."""
        return len(self._cards)

    def get_castle_cards(self) -> list[str]:
        """Get all castle card IDs."""
        return [c.id for c in self._cards.values() if c.category == CardCategory.CASTLE]

    def get_village_cards(self) -> list[str]:
        """Get all village card IDs."""
        return [c.id for c in self._cards.values() if c.category == CardCategory.VILLAGE]
