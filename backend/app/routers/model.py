"""Model endpoints for offline inference support.

Provides endpoints to download the ONNX model for client-side inference.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/model", tags=["model"])

# Path to ONNX model directory
# Same logic as yolo_detector: /app/models in Docker, or project root in local dev
_docker_models = Path("/app/models")
_local_models = Path(__file__).parent.parent.parent.parent / "models"
MODELS_DIR = _docker_models if _docker_models.exists() else _local_models
ONNX_DIR = MODELS_DIR / "card_detector" / "onnx"


class ModelInfo(BaseModel):
    """Model metadata response."""

    version: str
    format: str
    filename: str
    size_bytes: int
    size_mb: float
    sha256: str
    input_size: int
    opset: int
    num_classes: int
    available: bool


def _load_metadata() -> dict | None:
    """Load model metadata from JSON file."""
    metadata_path = ONNX_DIR / "metadata.json"
    if not metadata_path.exists():
        return None
    with open(metadata_path) as f:
        return json.load(f)


@router.get("/info", response_model=ModelInfo)
async def get_model_info():
    """Get ONNX model metadata for offline inference.

    Returns model version, size, hash for cache validation.
    """
    metadata = _load_metadata()

    if metadata is None:
        return ModelInfo(
            version="",
            format="onnx",
            filename="",
            size_bytes=0,
            size_mb=0,
            sha256="",
            input_size=640,
            opset=0,
            num_classes=92,
            available=False,
        )

    model_path = ONNX_DIR / "model.onnx"

    return ModelInfo(
        version=metadata.get("version", ""),
        format=metadata.get("format", "onnx"),
        filename=metadata.get("filename", "model.onnx"),
        size_bytes=metadata.get("size_bytes", 0),
        size_mb=metadata.get("size_mb", 0),
        sha256=metadata.get("sha256", ""),
        input_size=metadata.get("input_size", 640),
        opset=metadata.get("opset", 0),
        num_classes=metadata.get("num_classes", 92),
        available=model_path.exists(),
    )


@router.get("/download")
async def download_model():
    """Download the ONNX model file for offline inference.

    Returns the model.onnx file with appropriate headers for caching.
    """
    model_path = ONNX_DIR / "model.onnx"

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail="ONNX model not available. Run 'python scripts/export_onnx.py' to generate it.",
        )

    metadata = _load_metadata()
    etag = metadata.get("sha256", "") if metadata else ""

    return FileResponse(
        path=str(model_path),
        media_type="application/octet-stream",
        filename="model.onnx",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24h
            "ETag": f'"{etag}"' if etag else "",
        },
    )


@router.get("/classes")
async def get_model_classes():
    """Get the list of class names for the model.

    Returns the 92 card class names in order (index = class_id).
    """
    from app.services.yolo_detector import CLASS_NAMES

    return {
        "count": len(CLASS_NAMES),
        "classes": CLASS_NAMES,
    }
