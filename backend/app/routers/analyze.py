import logging

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.config import settings

logger = logging.getLogger(__name__)
from app.models import AnalyzeResponse, CardResult, CardMatch, ErrorResponse
from app.services.image_processor import load_image_from_bytes
from app.services.grid_detector import detect_cards_yolo
from app.services.clip_matcher import clip_matcher
from app.services.claude_fallback import claude_fallback
from app.services.template_matcher import template_matcher
from app.services.attribute_matcher import attribute_matcher

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

    Returns identification results for each card position with confidence scores.
    """
    logger.info(f"Received analyze request: {photo.filename}, content_type={photo.content_type}")

    # Validate file type
    if not photo.content_type or not photo.content_type.startswith("image/"):
        logger.warning(f"Invalid content type: {photo.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read and process image
    try:
        content = await photo.read()
        logger.info(f"Image size: {len(content)} bytes")
        if len(content) > settings.max_upload_size:
            logger.warning(f"File too large: {len(content)} > {settings.max_upload_size}")
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.max_upload_size // (1024*1024)}MB",
            )

        # Load image with EXIF correction
        image = load_image_from_bytes(content)
        logger.info(f"Image loaded: {image.size}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process image: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")

    # Detect cards in grid using YOLOv8
    try:
        logger.info("Detecting cards with YOLO...")
        detected_cards = detect_cards_yolo(image)
        logger.info(f"Detected {len(detected_cards)} cards")
    except Exception as e:
        logger.error(f"Failed to detect cards: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to detect cards: {str(e)}")

    # Identify each card
    results = []
    for card in detected_cards:
        # Get CLIP matches (return more candidates for user selection)
        clip_matches = clip_matcher.find_matches(card.image, top_k=settings.top_k_matches)
        confidence = clip_matcher.get_confidence(clip_matches)

        method = "clip"
        final_matches = clip_matches

        # If CLIP confidence is low, try template matching to filter candidates
        if confidence < settings.clip_confidence_threshold:
            # Detect card value and shields using template matching
            detected_value = template_matcher.detect_value(card.image, threshold=0.5)
            detected_shields = template_matcher.detect_shields(card.image, threshold=0.5)

            if detected_value is not None or detected_shields:
                # Filter candidates using strict matching (card shields must be subset of detected)
                filtered = attribute_matcher.filter_candidates_strict(
                    clip_matches,
                    value=detected_value,
                    shield_colors=detected_shields if detected_shields else None,
                )
                if filtered:
                    final_matches = filtered
                    method = "clip+template"
                    confidence = clip_matcher.get_confidence(final_matches)

        # Use Claude fallback if still low confidence
        if confidence < settings.clip_confidence_threshold:
            try:
                claude_matches = claude_fallback.identify_card(card.image, clip_matches)
                if claude_matches:
                    final_matches = claude_matches
                    method = "claude"
            except Exception:
                # If Claude fails, keep previous results
                pass

        # Create CardMatch objects
        matches = [
            CardMatch(id=card_id, probability=round(prob, 4))
            for card_id, prob in final_matches
        ]

        results.append(
            CardResult(
                position=card.position,
                matches=matches,
                method=method,
            )
        )

    # Sort by position
    results.sort(key=lambda x: (x.position[0], x.position[1]))

    return AnalyzeResponse(success=True, cards=results)


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
