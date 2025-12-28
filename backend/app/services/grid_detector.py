import cv2
import numpy as np
from PIL import Image
from dataclasses import dataclass

# rembg import moved to function to avoid loading if not needed


@dataclass
class DetectedCard:
    """Represents a detected card in the image."""
    image: Image.Image
    position: tuple[int, int]  # (row, col) in grid
    bbox: tuple[int, int, int, int]  # (x, y, w, h) in original image
    confidence: float


def order_points(pts: np.ndarray) -> np.ndarray:
    """Order points in: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # Top-left has smallest sum
    rect[2] = pts[np.argmax(s)]  # Bottom-right has largest sum
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # Top-right has smallest difference
    rect[3] = pts[np.argmax(diff)]  # Bottom-left has largest difference
    return rect


def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Apply perspective transform to get a top-down view."""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Compute width (max of top and bottom edge)
    width_a = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    width_b = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    max_width = max(int(width_a), int(width_b))

    # Compute height (max of left and right edge)
    height_a = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    height_b = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    max_height = max(int(height_a), int(height_b))

    # Destination points for top-down view
    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype="float32")

    # Compute perspective transform and apply
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (max_width, max_height))
    return warped


def find_grid_contour(image: np.ndarray) -> np.ndarray | None:
    """Find the outer contour of the card grid."""
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    # Apply bilateral filter to reduce noise while keeping edges
    blurred = cv2.bilateralFilter(gray, 11, 17, 17)

    # Edge detection
    edges = cv2.Canny(blurred, 30, 200)

    # Dilate to connect edges
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    # Sort by area, largest first
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    # Find the largest quadrilateral
    for contour in contours[:10]:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

        # If we found a quadrilateral
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            image_area = image.shape[0] * image.shape[1]
            # Grid should be at least 20% of image
            if area > image_area * 0.2:
                return approx.reshape(4, 2)

    return None


def find_individual_cards(image: np.ndarray, min_area_ratio: float = 0.02) -> list:
    """Find individual card contours in the image."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    # Try multiple thresholding approaches
    methods = [
        lambda: cv2.adaptiveThreshold(
            cv2.GaussianBlur(gray, (5, 5), 0), 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        ),
        lambda: cv2.threshold(
            cv2.GaussianBlur(gray, (5, 5), 0), 0, 255,
            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )[1],
    ]

    for method in methods:
        thresh = method()
        kernel = np.ones((3, 3), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        image_area = image.shape[0] * image.shape[1]
        min_area = image_area * min_area_ratio
        max_area = image_area * 0.15

        card_contours = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if min_area < area < max_area:
                peri = cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
                if 4 <= len(approx) <= 8:
                    # Check aspect ratio (cards are roughly 2:3)
                    x, y, w, h = cv2.boundingRect(contour)
                    aspect = max(w, h) / min(w, h) if min(w, h) > 0 else 0
                    if 1.0 < aspect < 2.5:
                        card_contours.append(contour)

        if len(card_contours) >= 9:
            return sorted(card_contours, key=cv2.contourArea, reverse=True)[:9]

    return []


def extract_card_with_perspective(image: np.ndarray, contour) -> np.ndarray:
    """Extract a card with perspective correction."""
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

    if len(approx) == 4:
        # Use perspective transform for quadrilaterals
        pts = approx.reshape(4, 2).astype("float32")
        return four_point_transform(image, pts)
    else:
        # Fall back to bounding rect
        x, y, w, h = cv2.boundingRect(contour)
        return image[y:y+h, x:x+w]


def assign_grid_positions(bboxes: list[tuple[int, int, int, int]]) -> list[tuple[int, int]]:
    """Assign grid positions (row, col) based on bounding box centers."""
    if len(bboxes) != 9:
        raise ValueError(f"Expected 9 cards, found {len(bboxes)}")

    # Calculate centers
    centers = [(x + w // 2, y + h // 2) for x, y, w, h in bboxes]
    indexed = list(enumerate(centers))

    # Sort by y to find rows
    y_sorted = sorted(centers, key=lambda c: c[1])

    # Find row boundaries
    y_coords = [c[1] for c in y_sorted]
    row_boundaries = []
    total_range = y_coords[-1] - y_coords[0]

    for i in range(1, len(y_coords)):
        gap = y_coords[i] - y_coords[i - 1]
        if gap > total_range / 4:
            row_boundaries.append((y_coords[i - 1] + y_coords[i]) / 2)

    def get_row(y):
        row = 0
        for boundary in row_boundaries:
            if y > boundary:
                row += 1
        return min(row, 2)

    # Group by rows
    rows = [[] for _ in range(3)]
    for idx, (cx, cy) in indexed:
        row = get_row(cy)
        rows[row].append((idx, cx, cy))

    # Sort each row by x and assign positions
    positions = [None] * len(bboxes)
    for row_idx, row in enumerate(rows):
        row.sort(key=lambda x: x[1])
        for col_idx, (orig_idx, _, _) in enumerate(row[:3]):
            positions[orig_idx] = (row_idx, col_idx)

    # Handle any None positions
    for i, pos in enumerate(positions):
        if pos is None:
            positions[i] = (2, 2)

    return positions


def detect_cards_with_perspective(image: np.ndarray) -> list[DetectedCard]:
    """Detect cards with perspective correction."""
    # First try to find the grid boundary
    grid_pts = find_grid_contour(image)

    if grid_pts is not None:
        # Apply perspective correction to the whole grid
        warped = four_point_transform(image, grid_pts)

        # Try to find individual cards in warped image
        card_contours = find_individual_cards(warped, min_area_ratio=0.08)

        if len(card_contours) >= 9:
            cards_data = []
            for contour in card_contours[:9]:
                card_img = extract_card_with_perspective(warped, contour)
                bbox = cv2.boundingRect(contour)
                cards_data.append((card_img, bbox))

            bboxes = [bbox for _, bbox in cards_data]
            positions = assign_grid_positions(bboxes)

            detected_cards = []
            for (card_img, bbox), position in zip(cards_data, positions):
                pil_image = Image.fromarray(card_img)
                detected_cards.append(DetectedCard(
                    image=pil_image,
                    position=position,
                    bbox=bbox,
                    confidence=0.9,
                ))
            return detected_cards
        else:
            # Divide warped grid into 9 equal parts
            return divide_into_grid(warped, confidence=0.8)

    # No grid found, try finding cards directly
    card_contours = find_individual_cards(image, min_area_ratio=0.02)

    if len(card_contours) >= 9:
        cards_data = []
        for contour in card_contours[:9]:
            card_img = extract_card_with_perspective(image, contour)
            bbox = cv2.boundingRect(contour)
            cards_data.append((card_img, bbox))

        bboxes = [bbox for _, bbox in cards_data]
        positions = assign_grid_positions(bboxes)

        detected_cards = []
        for (card_img, bbox), position in zip(cards_data, positions):
            pil_image = Image.fromarray(card_img)
            detected_cards.append(DetectedCard(
                image=pil_image,
                position=position,
                bbox=bbox,
                confidence=0.85,
            ))
        return detected_cards

    raise ValueError(f"Could not detect 9 cards. Found {len(card_contours)} potential cards.")


def divide_into_grid(image: np.ndarray, margin: float = 0.02, confidence: float = 0.5) -> list[DetectedCard]:
    """Divide image into a 3x3 grid."""
    h, w = image.shape[:2]
    margin_px_w = int(w * margin)
    margin_px_h = int(h * margin)

    effective_w = w - 2 * margin_px_w
    effective_h = h - 2 * margin_px_h
    cell_w = effective_w // 3
    cell_h = effective_h // 3

    detected_cards = []
    for row in range(3):
        for col in range(3):
            x = margin_px_w + col * cell_w
            y = margin_px_h + row * cell_h

            # Add small inner margin to avoid borders
            inner_margin = 5
            card_img = image[
                y + inner_margin : y + cell_h - inner_margin,
                x + inner_margin : x + cell_w - inner_margin
            ]

            pil_image = Image.fromarray(card_img)
            detected_cards.append(DetectedCard(
                image=pil_image,
                position=(row, col),
                bbox=(x, y, cell_w, cell_h),
                confidence=confidence,
            ))

    return detected_cards


def remove_background(image: np.ndarray) -> np.ndarray:
    """Remove background using rembg."""
    from rembg import remove
    pil_image = Image.fromarray(image)
    result = remove(pil_image)
    # Convert RGBA to RGB with black background
    if result.mode == 'RGBA':
        background = Image.new('RGB', result.size, (0, 0, 0))
        background.paste(result, mask=result.split()[3])
        result = background
    return np.array(result)


def find_grid_bounds_after_bg_removal(image: np.ndarray) -> tuple | None:
    """Find the bounding box of the card grid after background removal."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    # Simple threshold since background is black
    _, thresh = cv2.threshold(gray, 20, 255, cv2.THRESH_BINARY)

    # Light cleanup
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    # Find the largest contour (should be the grid)
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    image_area = image.shape[0] * image.shape[1]

    # Grid should be at least 20% of image
    if area < image_area * 0.2:
        return None

    # Get bounding rectangle
    x, y, w, h = cv2.boundingRect(largest)
    return (x, y, w, h)


def detect_cards(image: np.ndarray, use_fallback: bool = True) -> list[DetectedCard]:
    """Main function to detect cards with background removal."""
    # First try to find grid contour (works well on plain backgrounds)
    grid_pts = find_grid_contour(image)

    if grid_pts is not None:
        # Grid found - apply perspective correction and divide
        warped = four_point_transform(image, grid_pts)
        card_contours = find_individual_cards(warped, min_area_ratio=0.08)

        if len(card_contours) >= 9:
            cards_data = []
            for contour in card_contours[:9]:
                card_img = extract_card_with_perspective(warped, contour)
                bbox = cv2.boundingRect(contour)
                cards_data.append((card_img, bbox))

            bboxes = [bbox for _, bbox in cards_data]
            positions = assign_grid_positions(bboxes)

            detected_cards = []
            for (card_img, bbox), position in zip(cards_data, positions):
                pil_image = Image.fromarray(card_img)
                detected_cards.append(DetectedCard(
                    image=pil_image,
                    position=position,
                    bbox=bbox,
                    confidence=0.95,
                ))
            return detected_cards
        else:
            # Grid found but can't find individual cards - divide warped
            return divide_into_grid(warped, confidence=0.85)

    # No grid contour found - try background removal to find grid bounds
    try:
        nobg_image = remove_background(image)
        grid_bounds = find_grid_bounds_after_bg_removal(nobg_image)

        if grid_bounds is not None:
            x, y, w, h = grid_bounds
            # Extract grid region from ORIGINAL image
            grid_region = image[y:y+h, x:x+w]
            # Divide into 9 cards
            return divide_into_grid(grid_region, margin=0.01, confidence=0.85)
    except Exception:
        pass

    # Final fallback: divide whole image into grid
    if use_fallback:
        return divide_into_grid(image, confidence=0.5)

    raise ValueError("Could not detect 9 cards.")


def detect_cards_yolo(image: Image.Image, fallback_to_grid: bool = True) -> list[DetectedCard]:
    """Detect cards using YOLOv8 trained model.

    This is the preferred method for card detection.

    Args:
        image: PIL Image of the grid
        fallback_to_grid: If True, fall back to grid division if YOLO fails

    Returns:
        List of DetectedCard objects
    """
    from app.services.yolo_detector import yolo_detector

    try:
        # Use YOLO detector
        cards = yolo_detector.extract_cards(image, confidence=0.05)

        if len(cards) >= 9:
            detected_cards = []
            for card_image, det in cards[:9]:
                x1, y1, x2, y2 = det["bbox"]
                detected_cards.append(DetectedCard(
                    image=card_image,
                    position=det["position"],
                    bbox=(x1, y1, x2 - x1, y2 - y1),
                    confidence=det["confidence"],
                ))
            return detected_cards
        elif len(cards) > 0 and len(cards) < 9:
            # Partial detection - return what we have
            detected_cards = []
            for card_image, det in cards:
                x1, y1, x2, y2 = det["bbox"]
                detected_cards.append(DetectedCard(
                    image=card_image,
                    position=det["position"],
                    bbox=(x1, y1, x2 - x1, y2 - y1),
                    confidence=det["confidence"],
                ))
            return detected_cards

    except Exception as e:
        print(f"YOLO detection failed: {e}")

    # Fallback to grid division
    if fallback_to_grid:
        image_array = np.array(image)
        return divide_into_grid(image_array, confidence=0.5)

    raise ValueError("Could not detect cards with YOLO.")
