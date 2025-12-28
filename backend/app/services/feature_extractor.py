"""Extract visual features from card images.

Detects:
- Coin value (upper left corner)
- Shield colors (upper right corner)
"""
from typing import Optional

import numpy as np
from PIL import Image

# Shield color ranges in HSV (more strict thresholds)
# Format: (hue_min, hue_max, sat_min, val_min)
SHIELD_COLORS = {
    "blue": (100, 125, 100, 100),    # Blue hue range
    "pink": (145, 165, 60, 160),     # Pink/magenta
    "green": (45, 75, 100, 100),     # Green
    "orange": (12, 22, 180, 180),    # Orange
    "red": (0, 8, 180, 120),         # Red (low hue)
    "yellow": (26, 38, 120, 180),    # Yellow
}


def rgb_to_hsv(r: int, g: int, b: int) -> tuple[int, int, int]:
    """Convert RGB to HSV (0-180, 0-255, 0-255 like OpenCV)."""
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    diff = max_c - min_c

    # Hue
    if diff == 0:
        h = 0
    elif max_c == r:
        h = (60 * ((g - b) / diff) + 360) % 360
    elif max_c == g:
        h = (60 * ((b - r) / diff) + 120) % 360
    else:
        h = (60 * ((r - g) / diff) + 240) % 360

    # Saturation
    s = 0 if max_c == 0 else (diff / max_c) * 255

    # Value
    v = max_c * 255

    return int(h / 2), int(s), int(v)  # OpenCV uses 0-180 for hue


class FeatureExtractor:
    """Extract visual features from card images."""

    def detect_shield_colors(self, card_image: Image.Image) -> list[str]:
        """Detect shield colors in upper right area of card.

        Args:
            card_image: PIL Image of a single card

        Returns:
            List of detected color names
        """
        w, h = card_image.size

        # Shield area is roughly upper right 30% width, upper 25% height
        shield_region = card_image.crop((
            int(w * 0.65),  # left
            int(h * 0.02),  # top
            int(w * 0.98),  # right
            int(h * 0.20),  # bottom
        ))

        # Convert to numpy for analysis
        img_array = np.array(shield_region)

        if len(img_array.shape) < 3:
            return []

        # Get dominant colors by analyzing pixels
        detected_colors = set()

        # Sample pixels
        pixels = img_array.reshape(-1, 3)

        # Count color matches
        color_counts = {color: 0 for color in SHIELD_COLORS}

        for pixel in pixels[::10]:  # Sample every 10th pixel for speed
            r, g, b = int(pixel[0]), int(pixel[1]), int(pixel[2])
            h, s, v = rgb_to_hsv(r, g, b)

            # Skip very dark or unsaturated pixels
            if v < 50 or s < 30:
                continue

            for color, (h_min, h_max, s_min, v_min) in SHIELD_COLORS.items():
                if h_min <= h <= h_max and s >= s_min and v >= v_min:
                    color_counts[color] += 1

        # Threshold for detection (at least 1% of sampled pixels)
        threshold = len(pixels) // 10 // 100

        for color, count in color_counts.items():
            if count > threshold:
                detected_colors.add(color)

        return list(detected_colors)

    def detect_coin_value(self, card_image: Image.Image) -> Optional[int]:
        """Detect coin value in upper left area of card.

        This is a simplified detector - for more accuracy, use OCR.

        Args:
            card_image: PIL Image of a single card

        Returns:
            Detected value (0-9) or None if not detected
        """
        # For now, return None - coin value detection requires OCR
        # which adds complexity. Shield colors alone provide good filtering.
        return None

    def extract_features(self, card_image: Image.Image) -> dict:
        """Extract all features from a card image.

        Args:
            card_image: PIL Image of a single card

        Returns:
            Dict with detected features
        """
        return {
            "value": self.detect_coin_value(card_image),
            "shield_colors": self.detect_shield_colors(card_image),
        }


# Singleton instance
feature_extractor = FeatureExtractor()
