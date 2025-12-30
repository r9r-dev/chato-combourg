"""YOLO11-based card detector for detecting and identifying cards from grid images.

This module provides a simplified pipeline where YOLO11 handles both detection
and identification of 92 card types in a single pass.
"""
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from ultralytics import YOLO

MODELS_DIR = Path(__file__).parent.parent.parent / "models"


@dataclass
class DetectedCard:
    """Represents a detected card in the image."""
    image: Image.Image
    position: tuple[int, int]  # (row, col) in grid
    bbox: tuple[int, int, int, int]  # (x, y, w, h) in original image
    confidence: float

# 92 card class names (same order as training data.yaml)
CLASS_NAMES = [
    "Son Altesse", "Imprimeuse", "Duchesse", "Conspirateur", "Pélerin",
    "Aumônier", "Maître de guilde", "Souffleur de verre", "Garde royal",
    "Dame au masque de fer", "Professeur", "Châtelaine", "Prince", "Intendant",
    "Dramaturge", "Juge", "Templier", "Sa Majesté la reine", "Bouffon",
    "Banquière", "Astronome", "Officier", "Chevaleresse", "Architecte",
    "Doyenne", "Baron", "Générale", "Princesse", "Veilleur", "Orfèvre",
    "Capitaine", "Alchimiste", "Apothicaire", "Flagorneur", "La main du Cardinal",
    "Fossoyeur", "Nonne", "Sa Sainteté", "Mécène", "Prêteur sur gages",
    "Maître d'armes", "Scribe", "Milicien", "Dévot", "Artificier",
    "Chancelière", "Mère supérieure", "Cardinale", "Bûcheron", "Miraculée",
    "Curé", "Espion", "Apiculteur", "Mercenaire", "Bâtard", "Roi des gueux",
    "Forgeronne", "Aubergiste", "Potier", "Horlogère", "Sculptrice",
    "Mendiante", "Agricultrice", "Sorcière", "Armurière", "Serrurier",
    "Bergère", "Médecin", "Brigand", "Prince des voleurs", "Épicière",
    "Barbare", "Tailleuse de pierre", "Usurpateur", "Faussaire", "Vigneron",
    "Colporteur", "Inventeur", "Tire-laine", "Écuyer", "Fermière",
    "Charpentier", "Philosophe", "Bourreau", "Boulangère", "Voyageuse",
    "Pêcheur", "Voyante", "Village", "Château", "Révolutionnaire", "Moine"
]


def class_id_to_card_id(class_id: int) -> str:
    """Convert YOLO class_id (0-91) to card_id string ("001"-"092")."""
    return f"{class_id + 1:03d}"


def card_id_to_class_id(card_id: str) -> int:
    """Convert card_id string ("001"-"092") to YOLO class_id (0-91)."""
    return int(card_id) - 1


class YOLOCardDetector:
    """Detect and identify cards from grid images using YOLO11x (92 classes)."""

    def __init__(self):
        self.model = None
        self._initialized = False

    def initialize(self) -> None:
        """Load the trained YOLO11x model."""
        if self._initialized:
            return

        model_path = MODELS_DIR / "card_detector" / "weights" / "best.pt"
        if not model_path.exists():
            raise FileNotFoundError(
                f"YOLO model not found at {model_path}. "
                "Download from Google Drive or train a new model."
            )

        self.model = YOLO(str(model_path))
        self._initialized = True

    def _compute_grid_bounds(self, detections: list[dict]) -> tuple:
        """Compute the 3x3 grid bounds from detected cards."""
        if len(detections) == 0:
            return None

        # Calculate average card dimensions
        avg_width = sum(d["bbox"][2] - d["bbox"][0] for d in detections) / len(detections)
        avg_height = sum(d["bbox"][3] - d["bbox"][1] for d in detections) / len(detections)

        # Get bounding box of all card centers
        x_coords = [d["center"][0] for d in detections]
        y_coords = [d["center"][1] for d in detections]

        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)

        # Estimate full grid bounds with margins
        margin_x = avg_width * 0.6
        margin_y = avg_height * 0.6

        grid_left = min_x - margin_x
        grid_right = max_x + margin_x
        grid_top = min_y - margin_y
        grid_bottom = max_y + margin_y

        # Ensure minimum grid size
        grid_width = grid_right - grid_left
        grid_height = grid_bottom - grid_top

        min_grid_width = avg_width * 2.5
        min_grid_height = avg_height * 2.5

        if grid_width < min_grid_width:
            center_x = (grid_left + grid_right) / 2
            grid_left = center_x - min_grid_width / 2
            grid_right = center_x + min_grid_width / 2
            grid_width = min_grid_width

        if grid_height < min_grid_height:
            center_y = (grid_top + grid_bottom) / 2
            grid_top = center_y - min_grid_height / 2
            grid_bottom = center_y + min_grid_height / 2
            grid_height = min_grid_height

        return grid_left, grid_top, grid_width, grid_height

    def _assign_grid_position(self, det: dict, grid_bounds: tuple) -> tuple[int, int]:
        """Assign a detection to a grid cell (row, col)."""
        grid_left, grid_top, grid_width, grid_height = grid_bounds
        cell_width = grid_width / 3
        cell_height = grid_height / 3

        cx, cy = det["center"]

        col = int((cx - grid_left) / cell_width)
        col = max(0, min(2, col))

        row = int((cy - grid_top) / cell_height)
        row = max(0, min(2, row))

        return (row, col)

    def _select_best_9_cards(self, detections: list[dict]) -> list[dict]:
        """Select the best 9 cards using confidence and grid position logic.

        Strategy:
        1. If exactly 9 cards: use them all
        2. If more than 9 cards:
           a. Take top 9 by confidence
           b. Check if they cover 9 different grid positions
           c. If duplicates: select best card per grid zone
        """
        if len(detections) <= 9:
            return detections

        # Sort by confidence (highest first)
        sorted_dets = sorted(detections, key=lambda d: d["confidence"], reverse=True)

        # Compute grid bounds from all detections
        grid_bounds = self._compute_grid_bounds(detections)
        if grid_bounds is None:
            return sorted_dets[:9]

        # Assign grid positions to all detections
        for det in sorted_dets:
            det["position"] = self._assign_grid_position(det, grid_bounds)

        # Try top 9 by confidence first
        top9 = sorted_dets[:9]
        positions = [d["position"] for d in top9]

        # Check if all 9 positions are unique
        if len(set(positions)) == 9:
            return top9

        # Duplicates found: select best card per grid zone
        best_per_zone = {}
        for det in sorted_dets:
            pos = det["position"]
            if pos not in best_per_zone:
                best_per_zone[pos] = det
            # Keep highest confidence per zone (already sorted)

        # Return cards sorted by position
        result = list(best_per_zone.values())
        result.sort(key=lambda d: (d["position"][0], d["position"][1]))

        return result

    def _sort_and_assign_positions(self, detections: list[dict]) -> list[dict]:
        """Sort detections and assign grid positions."""
        if len(detections) == 0:
            return detections

        if len(detections) == 1:
            det = detections[0]
            det["position"] = (1, 1)  # Default to center
            return detections

        grid_bounds = self._compute_grid_bounds(detections)
        if grid_bounds is None:
            return detections

        for det in detections:
            det["position"] = self._assign_grid_position(det, grid_bounds)

        # Sort by position for consistent ordering
        detections.sort(key=lambda d: (d["position"][0], d["position"][1]))

        return detections

    def detect_cards(
        self, image: Image.Image, confidence: float = 0.5
    ) -> list[dict]:
        """Detect and identify cards in an image.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold (default 0.5 for new model)

        Returns:
            List of detected cards with class_id, class_name, bbox, confidence,
            sorted by position (top-left to bottom-right)
        """
        self.initialize()

        # Convert to numpy array
        image_array = np.array(image)

        # Run detection
        results = self.model(image_array, verbose=False, conf=confidence)

        # Extract detections
        detections = []
        boxes = results[0].boxes

        if len(boxes) == 0:
            return []

        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            conf = float(box.conf[0].cpu().numpy())
            class_id = int(box.cls[0].cpu().numpy())
            class_name = CLASS_NAMES[class_id] if class_id < len(CLASS_NAMES) else f"Unknown({class_id})"

            # Calculate center for grid assignment
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2

            detections.append({
                "class_id": class_id,
                "class_name": class_name,
                "bbox": (x1, y1, x2, y2),
                "confidence": conf,
                "center": (cx, cy),
            })

        # Select best 9 cards using confidence + grid position logic
        detections = self._select_best_9_cards(detections)

        # Final sort by grid position
        if detections:
            detections = self._sort_and_assign_positions(detections)

        return detections

    def detect_with_alternatives(
        self, image: Image.Image, confidence: float = 0.3, top_k: int = 6
    ) -> list[dict]:
        """Detect cards with alternative suggestions (top-K per detection).

        Useful for CardSelector UI when user wants to correct a detection.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold
            top_k: Number of alternative suggestions per card

        Returns:
            List of detected cards with 'alternatives' field containing top-K suggestions
        """
        self.initialize()

        image_array = np.array(image)
        results = self.model(image_array, verbose=False, conf=confidence)

        detections = []
        boxes = results[0].boxes

        if len(boxes) == 0:
            return []

        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            conf = float(box.conf[0].cpu().numpy())
            class_id = int(box.cls[0].cpu().numpy())
            class_name = CLASS_NAMES[class_id] if class_id < len(CLASS_NAMES) else f"Unknown({class_id})"

            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2

            # Get top-K alternatives from class probabilities if available
            alternatives = [{"class_id": class_id, "class_name": class_name, "confidence": conf}]

            detections.append({
                "class_id": class_id,
                "class_name": class_name,
                "bbox": (x1, y1, x2, y2),
                "confidence": conf,
                "center": (cx, cy),
                "alternatives": alternatives,
            })

        detections = self._select_best_9_cards(detections)

        if detections:
            detections = self._sort_and_assign_positions(detections)

        return detections

    def extract_cards(
        self, image: Image.Image, confidence: float = 0.5, padding: int = 5
    ) -> list[tuple[Image.Image, dict]]:
        """Detect and extract card images from a grid.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold
            padding: Padding around detected bounding box

        Returns:
            List of (card_image, detection_info) tuples
        """
        detections = self.detect_cards(image, confidence)

        cards = []
        img_w, img_h = image.size

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]

            # Add padding
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(img_w, x2 + padding)
            y2 = min(img_h, y2 + padding)

            # Crop card
            card_image = image.crop((x1, y1, x2, y2))
            cards.append((card_image, det))

        return cards


    def analyze_image(
        self, image: Image.Image, confidence: float = 0.3
    ) -> list[dict]:
        """Analyze an image and return card results in API format.

        This is the main entry point for the analyze endpoint.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold

        Returns:
            List of card results with card_id, matches, position, bbox
        """
        detections = self.detect_cards(image, confidence)

        img_width, img_height = image.size
        results = []

        for det in detections:
            # Convert class_id to card_id
            card_id = class_id_to_card_id(det["class_id"])

            # Create matches list (primary match + could add alternatives later)
            matches = [
                {"id": card_id, "probability": round(det["confidence"], 4)}
            ]

            # Convert bbox from pixels to percentages
            x1, y1, x2, y2 = det["bbox"]
            bbox = {
                "x": round(x1 / img_width * 100, 2),
                "y": round(y1 / img_height * 100, 2),
                "width": round((x2 - x1) / img_width * 100, 2),
                "height": round((y2 - y1) / img_height * 100, 2),
            }

            results.append({
                "position": det["position"],
                "matches": matches,
                "method": "yolo11",
                "bbox": bbox,
            })

        return results

    def get_detected_cards(
        self, image: Image.Image, confidence: float = 0.3, padding: int = 5
    ) -> list[DetectedCard]:
        """Detect and extract card images with DetectedCard format.

        Compatible with the old grid_detector interface.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold
            padding: Padding around detected bounding box

        Returns:
            List of DetectedCard objects
        """
        detections = self.detect_cards(image, confidence)

        cards = []
        img_w, img_h = image.size

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]

            # Add padding
            x1_pad = max(0, x1 - padding)
            y1_pad = max(0, y1 - padding)
            x2_pad = min(img_w, x2 + padding)
            y2_pad = min(img_h, y2 + padding)

            # Crop card
            card_image = image.crop((x1_pad, y1_pad, x2_pad, y2_pad))

            cards.append(DetectedCard(
                image=card_image,
                position=det["position"],
                bbox=(x1, y1, x2 - x1, y2 - y1),
                confidence=det["confidence"],
            ))

        return cards


# Singleton instance
yolo_detector = YOLOCardDetector()
