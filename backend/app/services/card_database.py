from pathlib import Path
from dataclasses import dataclass
from PIL import Image

from app.config import settings
from app.services.card_data import load_cards_data


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

    def __init__(self, cards_dir: Path = None):
        self.cards_dir = cards_dir or settings.cards_dir
        self._cards: dict[str, Card] = {}
        self._loaded = False

    def load(self) -> None:
        """Load cards from unified JSON file."""
        if self._loaded:
            return

        cards_data = load_cards_data()

        for card_id, card_info in cards_data.items():
            self._cards[card_id] = Card(
                id=card_id,
                file_name=card_info["file_name"],
                name=card_info.get("name", ""),
                image_path=self.cards_dir / card_info["file_name"],
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
