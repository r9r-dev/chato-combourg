"""YOLOv8-based card detector for extracting cards from grid images."""
from pathlib import Path

import numpy as np
from PIL import Image
from ultralytics import YOLO

MODELS_DIR = Path(__file__).parent.parent.parent / "models"


class YOLOCardDetector:
    """Detect and extract cards from grid images using YOLOv8."""

    def __init__(self):
        self.model = None
        self._initialized = False

    def initialize(self) -> None:
        """Load the trained YOLOv8 model."""
        if self._initialized:
            return

        model_path = MODELS_DIR / "card_detector" / "weights" / "best.pt"
        if not model_path.exists():
            raise FileNotFoundError(
                f"YOLOv8 model not found at {model_path}. "
                "Run training first: python tests/train_yolo.py"
            )

        self.model = YOLO(str(model_path))
        self._initialized = True

    def _sort_and_assign_positions(self, detections: list[dict]) -> list[dict]:
        """Sort detections and assign grid positions based on bounding box grid division.

        Estimates the full grid area from detected cards, then divides it into
        a 3x3 grid. Each card is assigned to the cell containing its center.
        This is robust even when some cards are missing or slightly misaligned.
        """
        if len(detections) == 0:
            return detections

        if len(detections) == 1:
            det = detections[0]
            det["position"] = (1, 1)  # Default to center
            return detections

        # Calculate average card dimensions
        avg_width = sum(d["bbox"][2] - d["bbox"][0] for d in detections) / len(detections)
        avg_height = sum(d["bbox"][3] - d["bbox"][1] for d in detections) / len(detections)

        # Get bounding box of all card centers
        x_coords = [d["center"][0] for d in detections]
        y_coords = [d["center"][1] for d in detections]

        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)

        # Estimate full grid bounds by adding margins for potentially missing edge cards
        # The margin is half a card width/height (distance from center to edge)
        # Plus a small gap between cards (estimated at 10% of card size)
        margin_x = avg_width * 0.6
        margin_y = avg_height * 0.6

        grid_left = min_x - margin_x
        grid_right = max_x + margin_x
        grid_top = min_y - margin_y
        grid_bottom = max_y + margin_y

        # Ensure minimum grid size (at least 3 card widths/heights)
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

        # Calculate cell boundaries (divide grid into 3x3)
        cell_width = grid_width / 3
        cell_height = grid_height / 3

        # Assign each card to its grid cell
        for det in detections:
            cx, cy = det["center"]

            # Calculate column (0, 1, or 2)
            col = int((cx - grid_left) / cell_width)
            col = max(0, min(2, col))  # Clamp to valid range

            # Calculate row (0, 1, or 2)
            row = int((cy - grid_top) / cell_height)
            row = max(0, min(2, row))  # Clamp to valid range

            det["position"] = (row, col)

        # Sort by position for consistent ordering
        detections.sort(key=lambda d: (d["position"][0], d["position"][1]))

        return detections

    def detect_cards(
        self, image: Image.Image, confidence: float = 0.05
    ) -> list[dict]:
        """Detect cards in an image.

        Args:
            image: PIL Image of the grid
            confidence: Minimum confidence threshold

        Returns:
            List of detected cards with bounding boxes and confidence scores,
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

        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            conf = float(box.conf[0].cpu().numpy())

            # Calculate center for sorting
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2

            detections.append({
                "bbox": (x1, y1, x2, y2),
                "confidence": conf,
                "center": (cx, cy),
            })

        # Take top 9 by confidence if more than 9 detected
        if len(detections) > 9:
            detections = sorted(
                detections, key=lambda d: d["confidence"], reverse=True
            )[:9]

        # Sort and assign grid positions based on spatial coordinates
        # This works correctly even when fewer than 9 cards are detected
        if detections:
            detections = self._sort_and_assign_positions(detections)

        return detections

    def extract_cards(
        self, image: Image.Image, confidence: float = 0.05, padding: int = 5
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


# Singleton instance
yolo_detector = YOLOCardDetector()
