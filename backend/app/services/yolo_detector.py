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
        """Sort detections and assign grid positions based on spatial coordinates.

        Groups cards by Y-coordinate proximity (rows), then sorts each row by X.
        Assigns (row, col) positions based on actual spatial location, not index.
        This is robust even when fewer than 9 cards are detected.
        """
        if len(detections) == 0:
            return detections

        if len(detections) == 1:
            # Single card: assign based on position in image
            det = detections[0]
            det["position"] = (1, 1)  # Default to center
            return detections

        # Extract Y coordinates
        y_coords = [d["center"][1] for d in detections]
        x_coords = [d["center"][0] for d in detections]

        # Calculate Y thresholds for row assignment
        y_thresholds = self._calculate_thresholds(y_coords)

        # Calculate X thresholds for column assignment
        x_thresholds = self._calculate_thresholds(x_coords)

        # Assign row and column to each detection based on coordinates
        for det in detections:
            y = det["center"][1]
            x = det["center"][0]

            # Determine row
            if y < y_thresholds[0]:
                row = 0
            elif y < y_thresholds[1]:
                row = 1
            else:
                row = 2

            # Determine column
            if x < x_thresholds[0]:
                col = 0
            elif x < x_thresholds[1]:
                col = 1
            else:
                col = 2

            det["position"] = (row, col)

        # Sort by position for consistent ordering
        detections.sort(key=lambda d: (d["position"][0], d["position"][1]))

        return detections

    def _calculate_thresholds(self, coords: list[float]) -> tuple[float, float]:
        """Calculate two thresholds to divide coordinates into 3 groups.

        Uses gap analysis when possible, falls back to equal division.
        """
        sorted_coords = sorted(set(coords))

        if len(sorted_coords) >= 3:
            # Calculate gaps between consecutive values
            gaps = [
                (sorted_coords[i + 1] - sorted_coords[i], i)
                for i in range(len(sorted_coords) - 1)
            ]
            # Find the 2 largest gaps to split into 3 groups
            gaps.sort(reverse=True)

            if len(gaps) >= 2:
                split_indices = sorted([gaps[0][1], gaps[1][1]])
            else:
                split_indices = [gaps[0][1]]

            # Calculate thresholds as midpoints of the gaps
            thresholds = []
            for idx in split_indices:
                threshold = (sorted_coords[idx] + sorted_coords[idx + 1]) / 2
                thresholds.append(threshold)
            thresholds.sort()

            # Ensure we have 2 thresholds
            if len(thresholds) == 1:
                # Add a second threshold
                min_c, max_c = min(coords), max(coords)
                if thresholds[0] < (min_c + max_c) / 2:
                    thresholds.append(thresholds[0] + (max_c - thresholds[0]) / 2)
                else:
                    thresholds.insert(0, min_c + (thresholds[0] - min_c) / 2)

            return (thresholds[0], thresholds[1])
        else:
            # Fallback: divide range into 3 equal parts
            min_c, max_c = min(coords), max(coords)
            range_c = max_c - min_c if max_c > min_c else 100  # Avoid division issues
            return (min_c + range_c / 3, min_c + 2 * range_c / 3)

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
