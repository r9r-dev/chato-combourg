import json
from pathlib import Path
from dataclasses import dataclass
from PIL import Image

from app.config import settings


@dataclass
class Card:
    """Reference card from the database."""
    id: str
    file_name: str
    name: str
    image_path: Path

    def load_image(self) -> Image.Image:
        """Load the card image."""
        return Image.open(self.image_path).convert("RGB")


class CardDatabase:
    """Manages the reference card database."""

    def __init__(self, cards_dir: Path = None, cards_json: Path = None):
        self.cards_dir = cards_dir or settings.cards_dir
        self.cards_json = cards_json or settings.cards_json
        self._cards: dict[str, Card] = {}
        self._loaded = False

    def load(self) -> None:
        """Load cards from JSON file."""
        if self._loaded:
            return

        with open(self.cards_json, "r", encoding="utf-8") as f:
            cards_data = json.load(f)

        for card_data in cards_data:
            card_id = card_data["id"]
            self._cards[card_id] = Card(
                id=card_id,
                file_name=card_data["file-name"],
                name=card_data.get("name", ""),
                image_path=self.cards_dir / card_data["file-name"],
            )

        self._loaded = True

    def get_card(self, card_id: str) -> Card | None:
        """Get a card by ID."""
        self.load()
        return self._cards.get(card_id)

    def get_all_cards(self) -> list[Card]:
        """Get all cards."""
        self.load()
        return list(self._cards.values())

    def get_card_ids(self) -> list[str]:
        """Get all card IDs."""
        self.load()
        return list(self._cards.keys())

    def __len__(self) -> int:
        self.load()
        return len(self._cards)


# Singleton instance
card_database = CardDatabase()
