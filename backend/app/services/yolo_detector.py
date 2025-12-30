"""YOLO11-based card detector for detecting and identifying cards from grid images.

This module provides a simplified pipeline where YOLO11 handles both detection
and identification of 92 card types in a single pass.
"""
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO

MODELS_DIR = Path(__file__).parent.parent.parent / "models"
CARDS_DIR = Path(__file__).parent.parent.parent / "cards"

# Load card attributes for similarity matching
_card_attributes: dict | None = None


def _load_card_attributes() -> dict:
    """Load card attributes from JSON file (cached)."""
    global _card_attributes
    if _card_attributes is None:
        attrs_path = CARDS_DIR / "card_attributes.json"
        with open(attrs_path) as f:
            _card_attributes = json.load(f)
    return _card_attributes


def _get_shield_signature(shields: list[dict]) -> tuple:
    """Get a comparable signature for shields (total count, sorted colors)."""
    total_count = sum(s.get("count", 0) for s in shields)
    # Create a sorted tuple of (color, count) for comparison
    colors = tuple(sorted((s.get("color"), s.get("count", 0)) for s in shields))
    return (total_count, colors)


def find_similar_cards(card_id: str, limit: int = 2) -> list[dict]:
    """Find cards similar to the given card based on attributes.

    Similarity criteria (in order of priority):
    1. Same number of shields
    2. Same shield colors
    3. Same category (village/castle/null)
    4. Same cost (if still more than limit results)

    Args:
        card_id: The card ID to find similar cards for (e.g., "001")
        limit: Maximum number of similar cards to return

    Returns:
        List of similar card IDs with similarity scores
    """
    attrs = _load_card_attributes()

    if card_id not in attrs:
        return []

    target = attrs[card_id]
    target_shields = target.get("shields", [])
    target_signature = _get_shield_signature(target_shields)
    target_category = target.get("category")
    target_value = target.get("value", 0)

    candidates = []

    for cid, card_attrs in attrs.items():
        if cid == card_id:
            continue

        # Calculate similarity score (higher = more similar)
        score = 0
        shields = card_attrs.get("shields", [])
        signature = _get_shield_signature(shields)

        # Same total shield count (most important)
        if signature[0] == target_signature[0]:
            score += 100

        # Same shield colors
        if signature[1] == target_signature[1]:
            score += 50

        # Same category
        if card_attrs.get("category") == target_category:
            score += 25

        # Same value/cost
        if card_attrs.get("value", 0) == target_value:
            score += 10

        # Only include if at least shields match
        if score >= 100:
            candidates.append({
                "id": cid,
                "score": score,
                "probability": round(score / 185, 2),  # Normalize to 0-1
            })

    # Sort by score (descending) and return top N
    candidates.sort(key=lambda x: (-x["score"], x["id"]))
    return candidates[:limit]


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

        # Compute grid bounds from top 9 detections only (not all detections)
        # This avoids false positives affecting the grid calculation
        grid_bounds = self._compute_grid_bounds(sorted_dets[:9])
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

        # Run detection with PIL image directly (numpy array doesn't work correctly)
        results = self.model.predict(source=image, verbose=False, conf=confidence)

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

        results = self.model.predict(source=image, verbose=False, conf=confidence)

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

            # Create matches list: primary match + 2 similar cards as alternatives
            matches = [
                {"id": card_id, "probability": round(det["confidence"], 4)}
            ]

            # Add similar cards as alternatives
            similar = find_similar_cards(card_id, limit=2)
            for alt in similar:
                matches.append({"id": alt["id"], "probability": alt["probability"]})

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


    def save_debug_info(
        self,
        image: Image.Image,
        detections: list[dict],
        debug_dir: Path,
        extra_info: dict | None = None,
    ) -> Path:
        """Save debug information: original image, annotated image, and JSON report.

        Args:
            image: Original PIL Image
            detections: List of detection results
            debug_dir: Directory to save debug files
            extra_info: Additional info to include in the report

        Returns:
            Path to the debug folder created
        """
        # Create timestamped folder
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        folder = debug_dir / timestamp
        folder.mkdir(parents=True, exist_ok=True)

        # Save original image
        original_path = folder / "original.jpg"
        image.save(original_path, "JPEG", quality=95)

        # Create annotated image
        annotated = image.copy()
        draw = ImageDraw.Draw(annotated)

        # Try to load a font, fallback to default
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except (OSError, IOError):
            font = ImageFont.load_default()

        colors = ["#FFD700", "#00FF00", "#FF6B6B", "#4ECDC4", "#9B59B6",
                  "#E74C3C", "#3498DB", "#2ECC71", "#F39C12"]

        for i, det in enumerate(detections):
            x1, y1, x2, y2 = det["bbox"]
            color = colors[i % len(colors)]

            # Draw bounding box
            draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

            # Draw label
            class_name = det.get("class_name", "?")
            conf = det.get("confidence", 0)
            position = det.get("position", (0, 0))
            label = f"{class_name} ({conf:.2f}) [{position[0]},{position[1]}]"

            # Background for text
            bbox = draw.textbbox((x1, y1 - 20), label, font=font)
            draw.rectangle(bbox, fill=color)
            draw.text((x1, y1 - 20), label, fill="black", font=font)

        # Save annotated image
        annotated_path = folder / "annotated.jpg"
        annotated.save(annotated_path, "JPEG", quality=95)

        # Create report
        report = {
            "timestamp": timestamp,
            "image_size": {"width": image.width, "height": image.height},
            "detections_count": len(detections),
            "detections": [
                {
                    "class_id": det.get("class_id"),
                    "class_name": det.get("class_name"),
                    "card_id": class_id_to_card_id(det.get("class_id", 0)),
                    "confidence": det.get("confidence"),
                    "position": det.get("position"),
                    "bbox": det.get("bbox"),
                    "center": det.get("center"),
                }
                for det in detections
            ],
        }

        if extra_info:
            report["extra"] = extra_info

        # Save report
        report_path = folder / "report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return folder


# Singleton instance
yolo_detector = YOLOCardDetector()
