"""Card attribute matching service.

Uses card value (coin) and shield colors to filter/rank candidates
when CLIP confidence is low.
"""
import json
from pathlib import Path
from typing import Optional

CARDS_DIR = Path(__file__).parent.parent.parent / "cards"


class AttributeMatcher:
    """Match cards by their attributes (value, shields)."""

    def __init__(self):
        self._attributes: dict = {}
        self._by_value: dict[int, list[str]] = {}  # value -> list of card IDs
        self._by_shield_color: dict[str, list[str]] = {}  # color -> list of card IDs
        self._initialized = False

    def initialize(self) -> None:
        """Load card attributes from JSON."""
        if self._initialized:
            return

        attr_file = CARDS_DIR / "card_attributes.json"
        if not attr_file.exists():
            raise FileNotFoundError(f"Card attributes not found: {attr_file}")

        with open(attr_file) as f:
            self._attributes = json.load(f)

        # Build indexes
        for card_id, attr in self._attributes.items():
            value = attr.get("value", -1)
            shields = attr.get("shields", [])

            # Index by value
            if value not in self._by_value:
                self._by_value[value] = []
            self._by_value[value].append(card_id)

            # Index by shield colors
            colors = set()
            for shield in shields:
                colors.add(shield.get("color", ""))
            for color in colors:
                if color not in self._by_shield_color:
                    self._by_shield_color[color] = []
                self._by_shield_color[color].append(card_id)

        self._initialized = True

    def get_attributes(self, card_id: str) -> Optional[dict]:
        """Get attributes for a card."""
        self.initialize()
        return self._attributes.get(card_id)

    def get_cards_by_value(self, value: int) -> list[str]:
        """Get all card IDs with a specific value."""
        self.initialize()
        return self._by_value.get(value, [])

    def get_cards_by_shield_color(self, color: str) -> list[str]:
        """Get all card IDs with a specific shield color."""
        self.initialize()
        return self._by_shield_color.get(color.lower(), [])

    def filter_candidates(
        self,
        candidates: list[tuple[str, float]],
        value: Optional[int] = None,
        shield_colors: Optional[list[str]] = None,
    ) -> list[tuple[str, float]]:
        """Filter candidate cards by attributes.

        Args:
            candidates: List of (card_id, probability) tuples from CLIP
            value: Filter by coin value (if detected)
            shield_colors: Filter by shield colors present (if detected)
                          Cards must have at least one matching shield color

        Returns:
            Filtered list of candidates that match the criteria
        """
        self.initialize()

        if value is None and not shield_colors:
            return candidates

        filtered = []
        for card_id, prob in candidates:
            attr = self._attributes.get(card_id)
            if not attr:
                continue

            # Check value match (exact)
            if value is not None and attr.get("value") != value:
                continue

            # Check shield colors match (card must have at least one detected color)
            if shield_colors:
                card_colors = set()
                for shield in attr.get("shields", []):
                    card_colors.add(shield.get("color", "").lower())

                # Card must have at least one of the detected shield colors
                detected_set = {c.lower() for c in shield_colors}
                if not card_colors & detected_set:  # No intersection
                    continue

            filtered.append((card_id, prob))

        return filtered

    def filter_candidates_strict(
        self,
        candidates: list[tuple[str, float]],
        value: Optional[int] = None,
        shield_colors: Optional[list[str]] = None,
    ) -> list[tuple[str, float]]:
        """Filter with strict shield matching - card shields must be subset of detected.

        Use this when shield detection has false positives but rarely misses.
        """
        self.initialize()

        if value is None and not shield_colors:
            return candidates

        filtered = []
        for card_id, prob in candidates:
            attr = self._attributes.get(card_id)
            if not attr:
                continue

            # Check value match (exact)
            if value is not None and attr.get("value") != value:
                continue

            # Check shield colors - card's shields must all be in detected set
            if shield_colors:
                card_colors = set()
                for shield in attr.get("shields", []):
                    card_colors.add(shield.get("color", "").lower())

                detected_set = {c.lower() for c in shield_colors}

                # All card colors must be in detected colors
                if card_colors and not card_colors.issubset(detected_set):
                    continue

            filtered.append((card_id, prob))

        return filtered

    def rerank_by_attributes(
        self,
        candidates: list[tuple[str, float]],
        value: Optional[int] = None,
        shield_colors: Optional[list[str]] = None,
        boost: float = 0.3,
    ) -> list[tuple[str, float]]:
        """Boost candidates that match detected attributes.

        Instead of filtering, this boosts matching candidates' scores.

        Args:
            candidates: List of (card_id, probability) tuples
            value: Detected coin value
            shield_colors: Detected shield colors
            boost: Amount to boost matching candidates (0-1)

        Returns:
            Reranked list of candidates
        """
        self.initialize()

        if value is None and not shield_colors:
            return candidates

        reranked = []
        for card_id, prob in candidates:
            attr = self._attributes.get(card_id)
            if not attr:
                reranked.append((card_id, prob))
                continue

            match_score = 0.0

            # Check value match
            if value is not None and attr.get("value") == value:
                match_score += boost

            # Check shield colors match
            if shield_colors:
                card_colors = set()
                for shield in attr.get("shields", []):
                    card_colors.add(shield.get("color", "").lower())

                matching_colors = sum(1 for c in shield_colors if c.lower() in card_colors)
                if matching_colors > 0:
                    match_score += boost * (matching_colors / len(shield_colors))

            # Apply boost (cap at 1.0)
            new_prob = min(1.0, prob + match_score)
            reranked.append((card_id, new_prob))

        # Sort by new probability
        reranked.sort(key=lambda x: x[1], reverse=True)
        return reranked

    def get_unique_values(self) -> list[int]:
        """Get all unique card values."""
        self.initialize()
        return sorted(self._by_value.keys())

    def get_unique_colors(self) -> list[str]:
        """Get all unique shield colors."""
        self.initialize()
        return sorted(self._by_shield_color.keys())

    def get_stats(self) -> dict:
        """Get statistics about card attributes."""
        self.initialize()
        return {
            "total_cards": len(self._attributes),
            "values": {v: len(ids) for v, ids in sorted(self._by_value.items())},
            "colors": {c: len(ids) for c, ids in sorted(self._by_shield_color.items())},
        }


# Singleton instance
attribute_matcher = AttributeMatcher()
