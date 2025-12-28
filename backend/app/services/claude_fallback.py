import base64
import io
import json
import re

import anthropic
from PIL import Image

from app.config import settings
from app.services.card_database import card_database


class ClaudeFallback:
    """Claude Vision API fallback for card identification."""

    def __init__(self):
        self.client = None
        self._initialized = False

    def initialize(self) -> None:
        """Initialize Anthropic client."""
        if self._initialized:
            return

        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY not set in environment")

        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._initialized = True

    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string."""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")

    def _get_card_list_prompt(self) -> str:
        """Generate prompt listing all available cards with names."""
        cards = card_database.get_all_cards()
        card_list = "\n".join([f"- ID {card.id}: {card.name}" for card in cards])
        return card_list

    def identify_card(
        self, card_image: Image.Image, clip_suggestions: list[tuple[str, float]] = None
    ) -> list[tuple[str, float]]:
        """Identify a card using Claude Vision.

        Args:
            card_image: PIL Image of the card to identify
            clip_suggestions: Optional CLIP suggestions to help Claude

        Returns:
            List of (card_id, probability) tuples
        """
        self.initialize()

        # Convert image to base64
        image_b64 = self._image_to_base64(card_image)

        # Build prompt
        card_list = self._get_card_list_prompt()

        suggestions_text = ""
        if clip_suggestions:
            suggestions_text = "\n\nPossible matches from image analysis (may be incorrect):\n"
            for card_id, score in clip_suggestions[:5]:
                suggestions_text += f"- ID {card_id} (score: {score:.2f})\n"

        prompt = f"""Analyze this card image and identify which card from the database it matches.

Available card IDs:
{card_list}
{suggestions_text}

IMPORTANT: Respond ONLY with a JSON object in this exact format:
{{"matches": [{{"id": "XXX", "probability": 0.XX}}, ...]}}

- Include up to 3 most likely matches
- Probabilities should sum to 1.0 or less
- Use card IDs from the list above (format: "001", "002", etc.)
- Base your identification on visual features of the card"""

        # Call Claude API
        response = self.client.messages.create(
            model=settings.claude_model,
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        # Parse response
        return self._parse_response(response.content[0].text)

    def _parse_response(self, response_text: str) -> list[tuple[str, float]]:
        """Parse Claude's response to extract matches."""
        try:
            # Try to find JSON in response
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                matches = data.get("matches", [])
                return [(m["id"], m["probability"]) for m in matches]
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        # Fallback: try to extract card IDs from text
        card_ids = card_database.get_card_ids()
        found = []
        for card_id in card_ids:
            if card_id in response_text:
                found.append((card_id, 0.5))

        return found[:3] if found else []

    def _image_to_base64_resized(self, image: Image.Image, max_bytes: int = 4_500_000) -> str:
        """Convert and resize image to fit within byte limit."""
        # Start with max dimension of 1500 for reasonable quality
        max_dim = 1500

        while max_dim >= 500:
            if max(image.size) > max_dim:
                ratio = max_dim / max(image.size)
                new_size = (int(image.width * ratio), int(image.height * ratio))
                resized = image.resize(new_size, Image.Resampling.LANCZOS)
            else:
                resized = image

            # Convert to JPEG for smaller size
            buffer = io.BytesIO()
            resized.save(buffer, format="JPEG", quality=85)

            if buffer.tell() <= max_bytes:
                return base64.standard_b64encode(buffer.getvalue()).decode("utf-8"), "image/jpeg"

            max_dim -= 200

        # Last resort: very small
        ratio = 400 / max(image.size)
        new_size = (int(image.width * ratio), int(image.height * ratio))
        resized = image.resize(new_size, Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        resized.save(buffer, format="JPEG", quality=70)
        return base64.standard_b64encode(buffer.getvalue()).decode("utf-8"), "image/jpeg"

    def identify_grid(self, grid_image: Image.Image) -> list[dict]:
        """Identify all 9 cards in a 3x3 grid image.

        Args:
            grid_image: PIL Image of the full 3x3 grid

        Returns:
            List of 9 dicts with position and matches
        """
        self.initialize()

        # Resize and compress to fit API limits
        image_b64, media_type = self._image_to_base64_resized(grid_image)
        card_list = self._get_card_list_prompt()

        prompt = f"""This image shows 9 French medieval-themed game cards arranged in a 3x3 grid.

Each card has:
- A character name written vertically on the left side (e.g., "Brigand", "Epiciere", "Medecin")
- A number in a circle at the top left
- A character illustration in the center

Your task: Read the CHARACTER NAME on each card and match it to the list below.

Available cards (ID: Name):
{card_list}

IMPORTANT: Respond ONLY with a JSON object. Match by reading the name on each card.
{{
  "cards": [
    {{"position": [0, 0], "id": "XXX", "confidence": 0.XX}},
    {{"position": [0, 1], "id": "XXX", "confidence": 0.XX}},
    {{"position": [0, 2], "id": "XXX", "confidence": 0.XX}},
    {{"position": [1, 0], "id": "XXX", "confidence": 0.XX}},
    {{"position": [1, 1], "id": "XXX", "confidence": 0.XX}},
    {{"position": [1, 2], "id": "XXX", "confidence": 0.XX}},
    {{"position": [2, 0], "id": "XXX", "confidence": 0.XX}},
    {{"position": [2, 1], "id": "XXX", "confidence": 0.XX}},
    {{"position": [2, 2], "id": "XXX", "confidence": 0.XX}}
  ]
}}

Position [0,0] = top-left card, [2,2] = bottom-right card.
Read left to right, top to bottom."""

        response = self.client.messages.create(
            model=settings.claude_model,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        return self._parse_grid_response(response.content[0].text)

    def _parse_grid_response(self, response_text: str) -> list[dict]:
        """Parse Claude's grid response."""
        try:
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                cards = data.get("cards", [])
                return [
                    {
                        "position": tuple(c["position"]),
                        "id": c["id"],
                        "confidence": c.get("confidence", 0.9)
                    }
                    for c in cards
                ]
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        return []


# Singleton instance
claude_fallback = ClaudeFallback()
