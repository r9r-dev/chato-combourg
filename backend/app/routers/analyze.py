import logging
import time

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.config import settings
from app.models import AnalyzeResponse, CardResult, CardMatch, BoundingBox, ErrorResponse
from app.services.image_processor import load_image_from_bytes
from app.services.yolo_detector import yolo_detector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def analyze_photo(
    photo: UploadFile = File(..., description="Photo of 9 cards in 3x3 grid"),
):
    """Analyze a photo containing 9 cards in a 3x3 grid.

    Uses YOLO11 with 92 classes for detection and identification in a single pass.
    Returns identification results for each card position with confidence scores.
    """
    # Validate file type
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read and process image
    try:
        content = await photo.read()
        if len(content) > settings.max_upload_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.max_upload_size // (1024*1024)}MB",
            )

        # Load image with EXIF correction
        image = load_image_from_bytes(content)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur image: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")

    # Detect and identify cards using YOLO11
    try:
        start_time = time.perf_counter()

        # Get raw detections first (needed for debug)
        detections = yolo_detector.detect_cards(image, confidence=0.3)

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
                }
            )
        except Exception as e:
            logger.warning(f"Capture non sauvegardée: {e}")

        # Convert detections to API format
        card_results = yolo_detector.analyze_image(image, confidence=0.3)

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"Analyse: {len(card_results)} cartes en {elapsed_ms:.0f}ms")

    except Exception as e:
        logger.error(f"Erreur analyse: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to analyze cards: {str(e)}")

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


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@router.get("/cards")
async def list_cards():
    """List all available card IDs."""
    from app.services.card_database import card_database

    cards = card_database.get_all_cards()
    return {
        "count": len(cards),
        "cards": [{"id": c.id, "name": c.name, "file": c.file_name} for c in cards],
    }
