"""Grid helper functions for score calculation."""

from typing import TypedDict

from app.services.card_data import get_all_attributes

# Load card attributes (cached by lru_cache in card_data module)
CARD_ATTRIBUTES: dict = get_all_attributes()


class Shield(TypedDict):
    count: int
    color: str


class CardAttributes(TypedDict):
    value: int
    shields: list[Shield]
    category: str | None
    has_price_reduction: bool
    has_lock: bool
    has_coin_purse: bool
    max_coins: int


class Grid:
    """Helper class for grid operations during scoring."""

    COLORS = ["blue", "green", "orange", "pink", "red", "yellow"]

    def __init__(self, cards: list[str], coins_on_cards: dict[str, int]):
        """
        Initialize grid with card IDs.

        Args:
            cards: List of 9 card IDs in grid order (0=top-left, 8=bottom-right)
            coins_on_cards: Dict mapping card_id to coins placed on it
        """
        self.cards = cards
        self.coins_on_cards = coins_on_cards

    @staticmethod
    def get_row(position: int) -> int:
        """Get row index (0-2) for a position."""
        return position // 3

    @staticmethod
    def get_col(position: int) -> int:
        """Get column index (0-2) for a position."""
        return position % 3

    @staticmethod
    def get_position(row: int, col: int) -> int:
        """Get position (0-8) from row and column."""
        return row * 3 + col

    def get_card_at(self, position: int) -> str:
        """Get card ID at a specific position."""
        return self.cards[position]

    def get_attrs(self, card_id: str) -> CardAttributes:
        """Get attributes for a card."""
        return CARD_ATTRIBUTES[card_id]

    def get_row_positions(self, position: int) -> list[int]:
        """Get all positions in the same row."""
        row = self.get_row(position)
        return [row * 3, row * 3 + 1, row * 3 + 2]

    def get_col_positions(self, position: int) -> list[int]:
        """Get all positions in the same column."""
        col = self.get_col(position)
        return [col, col + 3, col + 6]

    def get_row_cards(self, position: int) -> list[str]:
        """Get all card IDs in the same row."""
        return [self.cards[p] for p in self.get_row_positions(position)]

    def get_col_cards(self, position: int) -> list[str]:
        """Get all card IDs in the same column."""
        return [self.cards[p] for p in self.get_col_positions(position)]

    def count_shields_in_cards(self, card_ids: list[str], color: str) -> int:
        """Count total shields of a color in a list of cards."""
        total = 0
        for card_id in card_ids:
            attrs = self.get_attrs(card_id)
            for shield in attrs["shields"]:
                if shield["color"] == color:
                    total += shield["count"]
        return total

    def count_shields_on_board(self, color: str) -> int:
        """Count total shields of a color on the entire board."""
        return self.count_shields_in_cards(self.cards, color)

    def count_shields_in_row(self, position: int, color: str) -> int:
        """Count shields of a color in the same row."""
        return self.count_shields_in_cards(self.get_row_cards(position), color)

    def count_shields_in_col(self, position: int, color: str) -> int:
        """Count shields of a color in the same column."""
        return self.count_shields_in_cards(self.get_col_cards(position), color)

    def count_shields_in_row_and_col(self, position: int, color: str) -> int:
        """Count shields of a color in the same row AND column (card counted once)."""
        row_cards = set(self.get_row_positions(position))
        col_cards = set(self.get_col_positions(position))
        all_positions = row_cards | col_cards
        card_ids = [self.cards[p] for p in all_positions]
        return self.count_shields_in_cards(card_ids, color)

    def count_shields_on_card(self, position: int, color: str) -> int:
        """Count shields of a color on a specific card at position."""
        card_id = self.cards[position]
        return self.count_shields_in_cards([card_id], color)

    def get_unique_colors_in_cards(self, card_ids: list[str]) -> set[str]:
        """Get set of unique shield colors in a list of cards."""
        colors = set()
        for card_id in card_ids:
            attrs = self.get_attrs(card_id)
            for shield in attrs["shields"]:
                colors.add(shield["color"])
        return colors

    def get_unique_colors_in_row(self, position: int) -> set[str]:
        """Get unique shield colors in the same row."""
        return self.get_unique_colors_in_cards(self.get_row_cards(position))

    def get_unique_colors_in_col(self, position: int) -> set[str]:
        """Get unique shield colors in the same column."""
        return self.get_unique_colors_in_cards(self.get_col_cards(position))

    def get_unique_colors_on_board(self) -> set[str]:
        """Get unique shield colors on the entire board."""
        return self.get_unique_colors_in_cards(self.cards)

    def has_color_on_board(self, color: str) -> bool:
        """Check if a color exists on the board."""
        return self.count_shields_on_board(color) > 0

    def has_color_in_row(self, position: int, color: str) -> bool:
        """Check if a color exists in the same row."""
        return self.count_shields_in_row(position, color) > 0

    def has_color_in_col(self, position: int, color: str) -> bool:
        """Check if a color exists in the same column."""
        return self.count_shields_in_col(position, color) > 0

    def is_top_row(self, position: int) -> bool:
        """Check if position is in the top row."""
        return self.get_row(position) == 0

    def is_middle_row(self, position: int) -> bool:
        """Check if position is in the middle row."""
        return self.get_row(position) == 1

    def is_bottom_row(self, position: int) -> bool:
        """Check if position is in the bottom row."""
        return self.get_row(position) == 2

    def is_left_col(self, position: int) -> bool:
        """Check if position is in the left column."""
        return self.get_col(position) == 0

    def is_middle_col(self, position: int) -> bool:
        """Check if position is in the middle column."""
        return self.get_col(position) == 1

    def is_right_col(self, position: int) -> bool:
        """Check if position is in the right column."""
        return self.get_col(position) == 2

    def is_corner(self, position: int) -> bool:
        """Check if position is a corner (0, 2, 6, 8)."""
        return position in (0, 2, 6, 8)

    def is_border(self, position: int) -> bool:
        """Check if position is a border but not corner (1, 3, 5, 7)."""
        return position in (1, 3, 5, 7)

    def is_center(self, position: int) -> bool:
        """Check if position is the center (4)."""
        return position == 4

    def count_cards_with_category(self, category: str) -> int:
        """Count cards with a specific category (village/castle)."""
        count = 0
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            if attrs["category"] == category:
                count += 1
        return count

    def count_village_cards(self) -> int:
        """Count village cards on the board."""
        return self.count_cards_with_category("village")

    def count_castle_cards(self) -> int:
        """Count castle cards on the board."""
        return self.count_cards_with_category("castle")

    def count_cards_with_price_reduction(self) -> int:
        """Count cards with price reduction on the board."""
        count = 0
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            if attrs["has_price_reduction"]:
                count += 1
        return count

    def count_cards_with_lock(self) -> int:
        """Count cards with lock on the board."""
        count = 0
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            if attrs["has_lock"]:
                count += 1
        return count

    def count_cards_with_coin_purse(self) -> int:
        """Count cards with coin purse on the board."""
        count = 0
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            if attrs["has_coin_purse"]:
                count += 1
        return count

    def count_cards_with_shield_count(self, shield_count: int) -> int:
        """Count cards with exactly N shields."""
        count = 0
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            total_shields = sum(s["count"] for s in attrs["shields"])
            if total_shields == shield_count:
                count += 1
        return count

    def count_cards_with_exact_value(self, value: int) -> int:
        """Count cards with exactly N as price."""
        count = 0
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            if attrs["value"] == value:
                count += 1
        return count

    def count_cards_with_value_or_more(self, min_value: int) -> int:
        """Count cards with price >= N."""
        count = 0
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            if attrs["value"] >= min_value:
                count += 1
        return count

    def get_unique_values_on_board(self) -> set[int]:
        """Get set of unique card values on the board."""
        values = set()
        for card_id in self.cards:
            attrs = self.get_attrs(card_id)
            values.add(attrs["value"])
        return values

    def sum_values_in_row(self, position: int) -> int:
        """Sum all card values in the same row."""
        total = 0
        for card_id in self.get_row_cards(position):
            attrs = self.get_attrs(card_id)
            total += attrs["value"]
        return total

    def sum_values_in_col(self, position: int) -> int:
        """Sum all card values in the same column."""
        total = 0
        for card_id in self.get_col_cards(position):
            attrs = self.get_attrs(card_id)
            total += attrs["value"]
        return total

    def has_card_on_board(self, card_id: str) -> bool:
        """Check if a specific card is on the board."""
        return card_id in self.cards

    def get_coins_on_card(self, card_id: str) -> int:
        """Get number of coins placed on a card."""
        return self.coins_on_cards.get(card_id, 0)

    def get_total_coins_on_cards(self) -> int:
        """Get total coins placed on all cards."""
        return sum(self.coins_on_cards.values())
