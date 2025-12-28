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

    def _sort_by_grid_position(self, detections: list[dict]) -> list[dict]:
        """Sort detections into grid order using coordinate clustering.

        Groups cards by Y-coordinate proximity (rows), then sorts each row by X.
        This is more robust than simple sorting when cards aren't perfectly aligned.
        """
        if len(detections) <= 1:
            return detections

        # Extract Y coordinates
        y_coords = [d["center"][1] for d in detections]

        # Find row boundaries using gaps in Y coordinates
        sorted_y = sorted(set(y_coords))
        if len(sorted_y) >= 3:
            # Calculate gaps between consecutive Y values
            gaps = [(sorted_y[i + 1] - sorted_y[i], i) for i in range(len(sorted_y) - 1)]
            # Find the 2 largest gaps to split into 3 rows
            gaps.sort(reverse=True)
            split_indices = sorted([gaps[0][1], gaps[1][1]] if len(gaps) >= 2 else [gaps[0][1]])

            # Calculate thresholds as midpoints of the gaps
            thresholds = []
            for idx in split_indices:
                threshold = (sorted_y[idx] + sorted_y[idx + 1]) / 2
                thresholds.append(threshold)
            thresholds.sort()
        else:
            # Fallback: divide Y range into 3 equal parts
            min_y, max_y = min(y_coords), max(y_coords)
            range_y = max_y - min_y
            thresholds = [min_y + range_y / 3, min_y + 2 * range_y / 3]

        # Assign each detection to a row
        rows: list[list[dict]] = [[], [], []]
        for det in detections:
            y = det["center"][1]
            if y < thresholds[0]:
                rows[0].append(det)
            elif y < thresholds[1]:
                rows[1].append(det)
            else:
                rows[2].append(det)

        # Sort each row by X coordinate
        for row in rows:
            row.sort(key=lambda d: d["center"][0])

        # Flatten back
        return [d for row in rows for d in row]

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

        # Sort by position: top-to-bottom, then left-to-right
        # Group into rows based on y-coordinate clustering
        if detections:
            detections = self._sort_by_grid_position(detections)

        # Take top 9 by confidence if more than 9 detected
        if len(detections) > 9:
            # Re-sort by confidence, take top 9, then re-sort by position
            by_conf = sorted(detections, key=lambda d: d["confidence"], reverse=True)[:9]
            detections = self._sort_by_grid_position(by_conf)

        # Assign grid positions
        for i, det in enumerate(detections):
            row = i // 3
            col = i % 3
            det["position"] = (row, col)

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
