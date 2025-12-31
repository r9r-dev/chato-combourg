"""Router for capture management (training data collection)."""
import logging
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.capture_service import capture_service, CaptureStatus


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/captures", tags=["captures"])


class CardLabel(BaseModel):
    """A card label for training data."""
    position: int = Field(..., ge=0, le=8, description="Position 0-8")
    card_id: str = Field(..., description="Card ID (e.g., '001')")
    bbox: dict | None = Field(None, description="Bounding box if available")


class FinalizeStatus(str, Enum):
    """Status for finalize endpoint."""
    FAILED = "failed"
    FIXED = "fixed"
    SUCCESS = "success"


class FinalizeRequest(BaseModel):
    """Request body for finalizing a capture."""
    status: FinalizeStatus
    detection_count: int = Field(..., ge=0, description="Number of original detections")
    original_cards: list[CardLabel] | None = Field(
        None, description="Original detected cards (before corrections)"
    )
    final_cards: list[CardLabel] | None = Field(
        None, description="Final cards after user corrections"
    )


class FinalizeResponse(BaseModel):
    """Response for finalize endpoint."""
    success: bool
    message: str
    category: str | None = None


@router.delete(
    "/{capture_id}",
    responses={404: {"description": "Capture not found"}},
)
async def delete_capture(capture_id: str):
    """Delete a pending capture (when user quits without validating)."""
    logger.info(f"Deleting pending capture {capture_id}")

    success = capture_service.delete_pending_capture(capture_id)

    if not success:
        raise HTTPException(status_code=404, detail="Capture not found in pending")

    return {"success": True, "message": "Capture deleted"}


@router.post(
    "/{capture_id}/finalize",
    response_model=FinalizeResponse,
    responses={404: {"description": "Capture not found"}},
)
async def finalize_capture(capture_id: str, request: FinalizeRequest):
    """Finalize a capture by moving it to its final category.

    Categories:
    - suspicious: 0 detections (auto-determined from failed + detection_count=0)
    - failed: Had detections but user took new capture
    - fixed: Validated with corrections
    - success: Validated without corrections
    """
    logger.info(f"Finalizing capture {capture_id} with status {request.status}")

    # Map request status to CaptureStatus
    status_map = {
        FinalizeStatus.FAILED: CaptureStatus.FAILED,
        FinalizeStatus.FIXED: CaptureStatus.FIXED,
        FinalizeStatus.SUCCESS: CaptureStatus.SUCCESS,
    }
    capture_status = status_map[request.status]

    # Convert CardLabel to dict
    original_cards = None
    if request.original_cards:
        original_cards = [
            {"position": c.position, "card_id": c.card_id, "bbox": c.bbox}
            for c in request.original_cards
        ]

    final_cards = None
    if request.final_cards:
        final_cards = [
            {"position": c.position, "card_id": c.card_id, "bbox": c.bbox}
            for c in request.final_cards
        ]

    # Finalize capture
    success = capture_service.finalize_capture(
        capture_id=capture_id,
        status=capture_status,
        detection_count=request.detection_count,
        original_cards=original_cards,
        final_cards=final_cards,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Capture not found")

    # Determine actual category (suspicious if failed with 0 detections)
    actual_category = request.status.value
    if request.status == FinalizeStatus.FAILED and request.detection_count == 0:
        actual_category = "suspicious"

    logger.info(f"Capture {capture_id} finalized as {actual_category}")

    return FinalizeResponse(
        success=True,
        message=f"Capture finalized as {actual_category}",
        category=actual_category,
    )
