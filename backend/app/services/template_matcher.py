"""Template matching for coin values and shields using OpenCV.

Uses template matching to detect:
- Coin value (0-8) in upper left
- Shield types in upper right

Includes HSV color verification and CLAHE preprocessing for better accuracy.
"""
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"

# HSV color ranges for shield verification
SHIELD_HSV_RANGES = {
    "orange": ((5, 160, 150), (22, 255, 255)),
    "yellow": ((18, 30, 80), (55, 255, 255)),
    "green": ((30, 30, 50), (90, 255, 255)),
    "red": ((0, 100, 80), (10, 255, 255)),
    "red2": ((160, 100, 80), (180, 255, 255)),
    "blue": ((90, 50, 80), (130, 255, 255)),
    "pink": ((140, 40, 100), (170, 255, 255)),
}

# Per-color thresholds for shield detection
SHIELD_THRESHOLDS = {
    "yellow": 0.68,
    "green": 0.85,
    "orange": 0.70,
    "red": 0.75,
    "blue": 0.88,
    "pink": 0.75,
}

# Color pixel percentage thresholds
COLOR_PERCENTAGE_THRESHOLDS = {
    "orange": 0.25,
    "yellow": 0.05,
    "green": 0.05,
}


class TemplateMatcher:
    """Match card features using OpenCV template matching."""

    def __init__(self):
        self._value_templates: dict[int, np.ndarray] = {}
        self._shield_templates: dict[str, np.ndarray] = {}
        self._initialized = False

    def initialize(self) -> None:
        """Load all templates."""
        if self._initialized:
            return

        # Load value templates (0-8)
        values_dir = TEMPLATES_DIR / "values"
        if values_dir.exists():
            for i in range(9):
                path = values_dir / f"{i}.png"
                if path.exists():
                    img = cv2.imread(str(path))
                    if img is not None:
                        self._value_templates[i] = img

        # Load shield templates
        shields_dir = TEMPLATES_DIR / "shields"
        if shields_dir.exists():
            for path in shields_dir.glob("*.png"):
                color = path.stem
                img = cv2.imread(str(path))
                if img is not None:
                    self._shield_templates[color] = img

        self._initialized = True

    def _extract_coin_region(self, img: np.ndarray) -> np.ndarray:
        """Extract coin region from card image."""
        h, w = img.shape[:2]
        x1 = int(w * 0.0)
        y1 = int(h * 0.0)
        x2 = int(w * 0.35)
        y2 = int(h * 0.25)
        return img[y1:y2, x1:x2]

    def _extract_shield_region(self, img: np.ndarray) -> np.ndarray:
        """Extract shield region from card image."""
        h, w = img.shape[:2]
        x1 = int(w * 0.55)
        y1 = int(h * 0.0)
        x2 = int(w * 1.0)
        y2 = int(h * 0.30)
        return img[y1:y2, x1:x2]

    def _verify_shield_color(self, image: np.ndarray, color: str) -> bool:
        """Verify that the image region contains the expected shield color."""
        if image.size == 0:
            return False

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        if color == "red":
            low1, high1 = SHIELD_HSV_RANGES["red"]
            low2, high2 = SHIELD_HSV_RANGES["red2"]
            mask1 = cv2.inRange(hsv, np.array(low1), np.array(high1))
            mask2 = cv2.inRange(hsv, np.array(low2), np.array(high2))
            mask = cv2.bitwise_or(mask1, mask2)
        elif color in SHIELD_HSV_RANGES:
            low, high = SHIELD_HSV_RANGES[color]
            mask = cv2.inRange(hsv, np.array(low), np.array(high))
        else:
            return True

        total_pixels = mask.size
        matching_pixels = cv2.countNonZero(mask)
        percentage = matching_pixels / total_pixels

        threshold = COLOR_PERCENTAGE_THRESHOLDS.get(color, 0.15)
        return percentage >= threshold

    def _match_template_multiscale(
        self,
        image: np.ndarray,
        template: np.ndarray,
        scales: list[float] = None,
        use_clahe: bool = False,
    ) -> tuple[float, float]:
        """Match template at multiple scales, return best score and scale."""
        if scales is None:
            scales = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8]

        best_score = 0.0
        best_scale = 1.0

        # Convert to grayscale
        if len(image.shape) == 3:
            image_gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            image_gray = image

        if len(template.shape) == 3:
            template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)
        else:
            template_gray = template

        # Apply CLAHE for better contrast (helps with value detection)
        if use_clahe:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            image_gray = clahe.apply(image_gray)
            template_gray = clahe.apply(template_gray)

        for scale in scales:
            new_w = int(template_gray.shape[1] * scale)
            new_h = int(template_gray.shape[0] * scale)

            if new_w < 10 or new_h < 10:
                continue
            if new_w > image_gray.shape[1] or new_h > image_gray.shape[0]:
                continue

            resized = cv2.resize(template_gray, (new_w, new_h))

            result = cv2.matchTemplate(image_gray, resized, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, _ = cv2.minMaxLoc(result)

            if max_val > best_score:
                best_score = max_val
                best_scale = scale

        return best_score, best_scale

    def detect_value(self, card_image: Image.Image, threshold: float = 0.75) -> Optional[int]:
        """Detect coin value in a card image.

        Args:
            card_image: PIL Image of a single card
            threshold: Minimum match score to accept

        Returns:
            Detected value (0-8) or None if not found
        """
        self.initialize()

        if not self._value_templates:
            return None

        # Convert to OpenCV format
        img_array = np.array(card_image)
        if len(img_array.shape) == 3 and img_array.shape[2] == 3:
            img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        else:
            img_cv = img_array

        # Extract coin region
        coin_region = self._extract_coin_region(img_cv)

        # Try each value template with CLAHE
        best_value = None
        best_score = threshold

        for value, template in self._value_templates.items():
            score, _ = self._match_template_multiscale(coin_region, template, use_clahe=True)
            if score > best_score:
                best_score = score
                best_value = value

        return best_value

    def detect_shields(
        self, card_image: Image.Image, threshold: float = 0.65
    ) -> list[str]:
        """Detect shield types in a card image.

        Args:
            card_image: PIL Image of a single card
            threshold: Base minimum match score (per-color thresholds override)

        Returns:
            List of detected shield colors
        """
        self.initialize()

        if not self._shield_templates:
            return []

        # Convert to OpenCV format
        img_array = np.array(card_image)
        if len(img_array.shape) == 3 and img_array.shape[2] == 3:
            img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        else:
            img_cv = img_array

        # Extract shield region
        shield_region = self._extract_shield_region(img_cv)

        # Try each shield template with per-color thresholds and color verification
        detected = []

        for color, template in self._shield_templates.items():
            color_threshold = SHIELD_THRESHOLDS.get(color, threshold)
            score, _ = self._match_template_multiscale(shield_region, template, use_clahe=False)

            if score >= color_threshold:
                # Verify the color is actually present
                if self._verify_shield_color(shield_region, color):
                    detected.append((color, score))

        # Sort by score and return colors
        detected.sort(key=lambda x: x[1], reverse=True)
        return [color for color, _ in detected]

    def detect_features(
        self, card_image: Image.Image, value_threshold: float = 0.75, shield_threshold: float = 0.65
    ) -> dict:
        """Detect all features from a card image.

        Args:
            card_image: PIL Image of a single card
            value_threshold: Minimum score for value detection
            shield_threshold: Base minimum score for shield detection

        Returns:
            Dict with detected value and shields
        """
        return {
            "value": self.detect_value(card_image, value_threshold),
            "shields": self.detect_shields(card_image, shield_threshold),
        }


# Singleton instance
template_matcher = TemplateMatcher()
