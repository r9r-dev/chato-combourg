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
        # Group into rows based on y-coordinate
        if detections:
            # Sort by y first to identify rows
            detections.sort(key=lambda d: d["center"][1])

            # Group into 3 rows
            row_size = len(detections) // 3 if len(detections) >= 3 else len(detections)
            rows = []
            for i in range(0, len(detections), max(1, row_size)):
                row = detections[i:i + row_size]
                # Sort each row by x
                row.sort(key=lambda d: d["center"][0])
                rows.append(row)

            # Flatten back
            detections = [d for row in rows for d in row]

        # Take top 9 by confidence if more than 9 detected
        if len(detections) > 9:
            # Re-sort by confidence, take top 9, then re-sort by position
            by_conf = sorted(detections, key=lambda d: d["confidence"], reverse=True)[:9]
            by_conf.sort(key=lambda d: (d["center"][1], d["center"][0]))
            detections = by_conf

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
