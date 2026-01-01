import logging
import platform
import subprocess
import time

from fastapi import APIRouter, File, UploadFile, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AnalyzeResponse, CardResult, CardMatch, BoundingBox, ErrorResponse
from app.services.image_processor import load_image_from_bytes
from app.services.yolo_detector import yolo_detector
from app.auth import get_current_user_optional
from app.database import get_db, User, Setting
from app.exceptions import (
    InvalidImageError,
    ImageTooLargeError,
    ImageProcessingError,
    CardDetectionError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analyze"])


def _get_user_model_type(user: User | None, db: Session) -> str | None:
    """Get the detection_model setting for a user."""
    if user is None:
        return None
    setting = (
        db.query(Setting)
        .filter(Setting.user_id == user.id, Setting.key == "detection_model")
        .first()
    )
    return setting.value if setting else None


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def analyze_photo(
    photo: UploadFile = File(..., description="Photo of 9 cards in 3x3 grid"),
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Analyze a photo containing 9 cards in a 3x3 grid.

    Uses YOLO11 with 92 classes for detection and identification in a single pass.
    Returns identification results for each card position with confidence scores.
    The model type (openvino/pytorch) can be configured in user settings.
    """
    # Get user's preferred model type
    model_type = _get_user_model_type(user, db)

    # Validate file type
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise InvalidImageError()

    # Read and process image
    try:
        content = await photo.read()
        if len(content) > settings.max_upload_size:
            raise ImageTooLargeError(settings.max_upload_size // (1024 * 1024))

        # Load image with EXIF correction
        image = load_image_from_bytes(content)

    except (InvalidImageError, ImageTooLargeError):
        raise
    except Exception as e:
        logger.error(f"Erreur image: {e}")
        raise ImageProcessingError(detail=f"Impossible de traiter l'image : {e}")

    # Detect and identify cards using YOLO11
    try:
        start_time = time.perf_counter()

        # Get raw detections first (needed for debug)
        detections = yolo_detector.detect_cards(image, confidence=0.3, model_type=model_type)

        # Save capture for future model training
        capture_id = None
        try:
            capture_folder, capture_id = yolo_detector.save_debug_info(
                image=image,
                detections=detections,
                debug_dir=settings.captures_dir,
                extra_info={
                    "filename": photo.filename,
                    "content_type": photo.content_type,
                    "file_size": len(content),
                    "model_type": model_type,
                }
            )
        except Exception as e:
            logger.warning(f"Capture non sauvegardée: {e}")

        # Convert detections to API format
        card_results = yolo_detector.analyze_image(image, confidence=0.3, model_type=model_type)

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"Analyse: {len(card_results)} cartes en {elapsed_ms:.0f}ms")

    except Exception as e:
        logger.error(f"Erreur analyse: {e}")
        raise CardDetectionError(detail=f"Erreur lors de la détection : {e}")

    # Convert to response models
    results = []
    for card in card_results:
        matches = [
            CardMatch(id=m["id"], probability=m["probability"])
            for m in card["matches"]
        ]

        bbox = BoundingBox(
            x=card["bbox"]["x"],
            y=card["bbox"]["y"],
            width=card["bbox"]["width"],
            height=card["bbox"]["height"],
        )

        results.append(
            CardResult(
                position=card["position"],
                matches=matches,
                method=card["method"],
                bbox=bbox,
            )
        )

    # Sort by position
    results.sort(key=lambda x: (x.position[0], x.position[1]))

    return AnalyzeResponse(success=True, cards=results, capture_id=capture_id)


def _get_cpu_model() -> str:
    """Get CPU model name."""
    system = platform.system()

    if system == "Darwin":  # macOS
        try:
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass
    elif system == "Linux":
        try:
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if line.startswith("model name"):
                        return line.split(":")[1].strip()
        except Exception:
            pass

    # Fallback
    return platform.processor() or "Unknown"


@router.get("/health")
async def health_check():
    """Health check endpoint with system info."""
    available_models = yolo_detector.get_available_models()
    default_model = yolo_detector.get_default_model_type()

    return {
        "status": "healthy",
        "inference": {
            "framework": default_model,
            "available": available_models,
        },
        "cpu": _get_cpu_model(),
    }


@router.get("/cards")
async def list_cards():
    """List all available card IDs."""
    from app.services.card_database import card_database

    cards = card_database.get_all_cards()
    return {
        "count": len(cards),
        "cards": [{"id": c.id, "name": c.name, "file": c.file_name} for c in cards],
    }
