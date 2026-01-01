"""
PyTorch Worker - Micro-service d'inference YOLO sur Mac M4.

Ce service expose un endpoint /infer qui recoit une image et retourne
les detections de cartes. Il est concu pour tourner sur un Mac avec
GPU Apple Silicon (MPS) pour des inferences rapides (~1s vs 7s sur CPU).
"""

import io
import logging
import time
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PyTorch Worker",
    description="Inference YOLO sur Mac M4",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Class names (001-092)
CLASS_NAMES = [f"{i:03d}" for i in range(1, 93)]

# Model path - relative to worker directory
MODELS_DIR = Path(__file__).parent.parent / "models" / "card_detector"
PYTORCH_MODEL_PATH = MODELS_DIR / "yolo11" / "model.pt"


class Detection(BaseModel):
    class_id: int
    class_name: str
    bbox: tuple[int, int, int, int]
    confidence: float
    center: tuple[float, float]
    position: tuple[int, int] | None = None


class InferResponse(BaseModel):
    success: bool
    cards: list[Detection]
    inference_time_ms: float
    device: str


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    model_loaded: bool


# Global model instance
_model: YOLO | None = None
_device: str = "cpu"


def get_model() -> YOLO:
    """Load and cache the YOLO model."""
    global _model, _device

    if _model is None:
        if not PYTORCH_MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found: {PYTORCH_MODEL_PATH}")

        logger.info(f"Loading model from {PYTORCH_MODEL_PATH}")
        _model = YOLO(str(PYTORCH_MODEL_PATH), task="detect")

        # Detect device
        import torch
        if torch.backends.mps.is_available():
            _device = "mps"
        elif torch.cuda.is_available():
            _device = "cuda"
        else:
            _device = "cpu"

        logger.info(f"Model loaded, using device: {_device}")

    return _model


def compute_grid_bounds(detections: list[dict]) -> tuple | None:
    """Compute the 3x3 grid bounds from detected cards."""
    if len(detections) == 0:
        return None

    avg_width = sum(d["bbox"][2] - d["bbox"][0] for d in detections) / len(detections)
    avg_height = sum(d["bbox"][3] - d["bbox"][1] for d in detections) / len(detections)

    x_coords = [d["center"][0] for d in detections]
    y_coords = [d["center"][1] for d in detections]

    min_x, max_x = min(x_coords), max(x_coords)
    min_y, max_y = min(y_coords), max(y_coords)

    margin_x = avg_width * 0.6
    margin_y = avg_height * 0.6

    grid_left = min_x - margin_x
    grid_right = max_x + margin_x
    grid_top = min_y - margin_y
    grid_bottom = max_y + margin_y

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


def assign_grid_position(det: dict, grid_bounds: tuple) -> tuple[int, int]:
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


def select_best_9_cards(detections: list[dict]) -> list[dict]:
    """Select the best 9 cards using confidence and grid position logic."""
    if len(detections) <= 9:
        return detections

    sorted_dets = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    grid_bounds = compute_grid_bounds(sorted_dets[:9])
    if grid_bounds is None:
        return sorted_dets[:9]

    for det in sorted_dets:
        det["position"] = assign_grid_position(det, grid_bounds)

    top9 = sorted_dets[:9]
    positions = [d["position"] for d in top9]

    if len(set(positions)) == 9:
        return top9

    best_per_zone = {}
    for det in sorted_dets:
        pos = det["position"]
        if pos not in best_per_zone:
            best_per_zone[pos] = det

    result = list(best_per_zone.values())
    result.sort(key=lambda d: (d["position"][0], d["position"][1]))

    return result


def sort_and_assign_positions(detections: list[dict]) -> list[dict]:
    """Sort detections and assign grid positions."""
    if len(detections) == 0:
        return detections

    if len(detections) == 1:
        det = detections[0]
        det["position"] = (1, 1)
        return detections

    grid_bounds = compute_grid_bounds(detections)
    if grid_bounds is None:
        return detections

    for det in detections:
        det["position"] = assign_grid_position(det, grid_bounds)

    detections.sort(key=lambda d: (d["position"][0], d["position"][1]))

    return detections


def detect_cards(image: Image.Image, confidence: float = 0.3) -> list[dict]:
    """Detect and identify cards in an image."""
    model = get_model()

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

        detections.append({
            "class_id": class_id,
            "class_name": class_name,
            "bbox": (x1, y1, x2, y2),
            "confidence": conf,
            "center": (cx, cy),
        })

    detections = select_best_9_cards(detections)

    if detections:
        detections = sort_and_assign_positions(detections)

    return detections


@app.post("/infer", response_model=InferResponse)
async def infer(image: UploadFile = File(..., description="Image to analyze")):
    """Run inference on an uploaded image."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        content = await image.read()
        pil_image = Image.open(io.BytesIO(content))

        # Convert to RGB if needed
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        # Handle EXIF orientation
        try:
            from PIL import ExifTags
            for orientation in ExifTags.TAGS.keys():
                if ExifTags.TAGS[orientation] == "Orientation":
                    break
            exif = pil_image._getexif()
            if exif:
                orientation_value = exif.get(orientation)
                if orientation_value == 3:
                    pil_image = pil_image.rotate(180, expand=True)
                elif orientation_value == 6:
                    pil_image = pil_image.rotate(270, expand=True)
                elif orientation_value == 8:
                    pil_image = pil_image.rotate(90, expand=True)
        except (AttributeError, KeyError, IndexError):
            pass

    except Exception as e:
        logger.error(f"Failed to process image: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")

    try:
        start_time = time.perf_counter()
        raw_detections = detect_cards(pil_image, confidence=0.3)
        inference_time_ms = (time.perf_counter() - start_time) * 1000

        cards = [
            Detection(
                class_id=d["class_id"],
                class_name=d["class_name"],
                bbox=d["bbox"],
                confidence=d["confidence"],
                center=d["center"],
                position=d.get("position"),
            )
            for d in raw_detections
        ]

        logger.info(f"Inference: {len(cards)} cards in {inference_time_ms:.0f}ms")

        return InferResponse(
            success=True,
            cards=cards,
            inference_time_ms=inference_time_ms,
            device=_device,
        )

    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    model_loaded = _model is not None

    # Try to load model if not loaded
    if not model_loaded:
        try:
            get_model()
            model_loaded = True
        except Exception:
            pass

    return HealthResponse(
        status="ok" if model_loaded else "model_not_loaded",
        model="pytorch",
        device=_device,
        model_loaded=model_loaded,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=50100)
