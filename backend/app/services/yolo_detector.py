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

# Models directory: /app/models in Docker, or project root in local dev
_docker_models = Path("/app/models")
_local_models = Path(__file__).parent.parent.parent.parent / "models"
MODELS_DIR = _docker_models if _docker_models.exists() else _local_models
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
    """Detect and identify cards from grid images using YOLO11x (92 classes).

    Supports both OpenVINO and PyTorch models, selectable per-request.
    """

    def __init__(self):
        self._openvino_model = None
        self._pytorch_model = None
        self._openvino_available = False
        self._pytorch_available = False
        self._initialized = False
        self._default_model_type = "openvino"  # Prefer OpenVINO by default

    def initialize(self) -> None:
        """Load available models (OpenVINO and/or PyTorch)."""
        if self._initialized:
            return

        card_detector_dir = MODELS_DIR / "card_detector"
        openvino_dir = card_detector_dir / "model_openvino_model"
        pytorch_path = card_detector_dir / "yolo11" / "model.pt"

        # Load OpenVINO model if available
        if (openvino_dir / "metadata.yaml").exists():
            self._openvino_model = YOLO(str(openvino_dir) + "/", task="detect")
            self._openvino_available = True

        # Load PyTorch model if available
        if pytorch_path.exists():
            self._pytorch_model = YOLO(str(pytorch_path), task="detect")
            self._pytorch_available = True

        if not self._openvino_available and not self._pytorch_available:
            raise FileNotFoundError(
                f"YOLO model not found. Expected OpenVINO at "
                f"{openvino_dir} (with metadata.yaml) "
                f"or PyTorch at {pytorch_path}."
            )

        # Set default to best available
        if self._openvino_available:
            self._default_model_type = "openvino"
        else:
            self._default_model_type = "pytorch"

        self._initialized = True

    def get_available_models(self) -> list[str]:
        """Return list of available model types."""
        self.initialize()
        available = []
        if self._openvino_available:
            available.append("openvino")
        if self._pytorch_available:
            available.append("pytorch")
        return available

    def _get_model(self, model_type: str | None = None) -> YOLO:
        """Get the requested model, falling back to default if unavailable."""
        self.initialize()

        if model_type == "pytorch" and self._pytorch_available:
            return self._pytorch_model
        elif model_type == "openvino" and self._openvino_available:
            return self._openvino_model

        # Fallback to default
        if self._default_model_type == "openvino" and self._openvino_available:
            return self._openvino_model
        return self._pytorch_model

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
        self, image: Image.Image, confidence: float = 0.5, model_type: str | None = None
    ) -> list[dict]:
        """Detect and identify cards in an image.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold (default 0.5 for new model)
            model_type: Model to use ("openvino" or "pytorch"), None for default

        Returns:
            List of detected cards with class_id, class_name, bbox, confidence,
            sorted by position (top-left to bottom-right)
        """
        model = self._get_model(model_type)

        # Run detection with PIL image directly (numpy array doesn't work correctly)
        results = model.predict(source=image, verbose=False, conf=confidence, task="detect")

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
        self, image: Image.Image, confidence: float = 0.3, top_k: int = 6,
        model_type: str | None = None
    ) -> list[dict]:
        """Detect cards with alternative suggestions (top-K per detection).

        Useful for CardSelector UI when user wants to correct a detection.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold
            top_k: Number of alternative suggestions per card
            model_type: Model to use ("openvino" or "pytorch"), None for default

        Returns:
            List of detected cards with 'alternatives' field containing top-K suggestions
        """
        model = self._get_model(model_type)

        results = model.predict(source=image, verbose=False, conf=confidence, task="detect")

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
        self, image: Image.Image, confidence: float = 0.5, padding: int = 5,
        model_type: str | None = None
    ) -> list[tuple[Image.Image, dict]]:
        """Detect and extract card images from a grid.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold
            padding: Padding around detected bounding box
            model_type: Model to use ("openvino" or "pytorch"), None for default

        Returns:
            List of (card_image, detection_info) tuples
        """
        detections = self.detect_cards(image, confidence, model_type)

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
        self, image: Image.Image, confidence: float = 0.3, model_type: str | None = None
    ) -> list[dict]:
        """Analyze an image and return card results in API format.

        This is the main entry point for the analyze endpoint.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold
            model_type: Model to use ("openvino" or "pytorch"), None for default

        Returns:
            List of card results with card_id, matches, position, bbox
        """
        detections = self.detect_cards(image, confidence, model_type)

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
        self, image: Image.Image, confidence: float = 0.3, padding: int = 5,
        model_type: str | None = None
    ) -> list[DetectedCard]:
        """Detect and extract card images with DetectedCard format.

        Compatible with the old grid_detector interface.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold
            padding: Padding around detected bounding box
            model_type: Model to use ("openvino" or "pytorch"), None for default

        Returns:
            List of DetectedCard objects
        """
        detections = self.detect_cards(image, confidence, model_type)

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
    ) -> tuple[Path, str]:
        """Save debug information: original image, annotated image, and JSON report.

        Saves to pending/ subdirectory for later categorization.

        Args:
            image: Original PIL Image
            detections: List of detection results
            debug_dir: Directory to save debug files
            extra_info: Additional info to include in the report

        Returns:
            Tuple of (path to the debug folder created, capture_id)
        """
        # Create timestamped folder in pending/
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        capture_id = timestamp
        folder = debug_dir / "pending" / timestamp
        folder.mkdir(parents=True, exist_ok=True)

        # Save original image
        original_path = folder / "original.jpg"
        image.save(original_path, "JPEG", quality=95)

        # Create annotated image
        annotated = image.copy()
        draw = ImageDraw.Draw(annotated)

        # Try to load a font with Unicode support, fallback to default
        font_size = 26
        font = None
        font_paths = [
            # Debian / Ubuntu (Docker python:3.12-slim with fonts-dejavu-core)
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            # Other Linux distributions
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            # macOS (for local development)
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial Unicode.ttf",
        ]
        for font_path in font_paths:
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except (OSError, IOError):
                continue
        if font is None:
            font = ImageFont.load_default()

        colors = ["#FFD700", "#00FF00", "#FF6B6B", "#4ECDC4", "#9B59B6",
                  "#E74C3C", "#3498DB", "#2ECC71", "#F39C12"]

        def wrap_text(text: str, max_width: int, font) -> list[str]:
            """Wrap text to fit within max_width pixels."""
            words = text.split()
            lines = []
            current_line = ""
            for word in words:
                test_line = f"{current_line} {word}".strip()
                bbox = draw.textbbox((0, 0), test_line, font=font)
                if bbox[2] - bbox[0] <= max_width:
                    current_line = test_line
                else:
                    if current_line:
                        lines.append(current_line)
                    # Check if single word is too long
                    word_bbox = draw.textbbox((0, 0), word, font=font)
                    if word_bbox[2] - word_bbox[0] > max_width:
                        # Truncate the word
                        truncated = word
                        while len(truncated) > 1:
                            truncated = truncated[:-1]
                            test = truncated + "..."
                            test_bbox = draw.textbbox((0, 0), test, font=font)
                            if test_bbox[2] - test_bbox[0] <= max_width:
                                word = test
                                break
                    current_line = word
            if current_line:
                lines.append(current_line)
            return lines if lines else [text[:10] + "..."]

        for i, det in enumerate(detections):
            x1, y1, x2, y2 = det["bbox"]
            color = colors[i % len(colors)]
            box_width = x2 - x1
            padding = 4

            # Draw bounding box
            draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

            # Extract detection info
            class_name = det.get("class_name", "?")
            conf = det.get("confidence", 0)
            position = det.get("position", (0, 0))

            # 1. Confidence at top center
            conf_text = f"{conf:.1%}"
            conf_bbox = draw.textbbox((0, 0), conf_text, font=font)
            conf_width = conf_bbox[2] - conf_bbox[0]
            conf_x = x1 + (box_width - conf_width) // 2
            conf_y = y1 + padding
            bg_bbox = draw.textbbox((conf_x, conf_y), conf_text, font=font)
            draw.rectangle(bg_bbox, fill=color)
            draw.text((conf_x, conf_y), conf_text, fill="black", font=font)

            # 2. Position at bottom left
            pos_text = f"[{position[0]},{position[1]}]"
            pos_bbox = draw.textbbox((0, 0), pos_text, font=font)
            pos_height = pos_bbox[3] - pos_bbox[1]
            pos_x = x1 + padding
            pos_y = y2 - pos_height - padding
            bg_bbox = draw.textbbox((pos_x, pos_y), pos_text, font=font)
            draw.rectangle(bg_bbox, fill=color)
            draw.text((pos_x, pos_y), pos_text, fill="black", font=font)

            # 3. Class name with word wrap (below confidence)
            max_text_width = box_width - (padding * 2)
            lines = wrap_text(class_name, max_text_width, font)
            # Start below confidence text
            line_height = conf_bbox[3] - conf_bbox[1] + 2
            start_y = conf_y + line_height + 4
            for line in lines:
                line_bbox = draw.textbbox((0, 0), line, font=font)
                line_width = line_bbox[2] - line_bbox[0]
                line_x = x1 + (box_width - line_width) // 2  # Center each line
                # Stop if we would overlap with position text
                if start_y + (line_bbox[3] - line_bbox[1]) > pos_y - 4:
                    break
                bg_bbox = draw.textbbox((line_x, start_y), line, font=font)
                draw.rectangle(bg_bbox, fill=color)
                draw.text((line_x, start_y), line, fill="black", font=font)
                start_y += line_height

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

        return folder, capture_id


# Singleton instance
yolo_detector = YOLOCardDetector()
