"""Model endpoints for offline inference support.

Provides endpoints to download ONNX models for client-side inference.
Supports multiple model variants (FP32, FP16, INT8) for different use cases.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/model", tags=["model"])

# Path to ONNX model directory
# In Docker: /app/models is mounted from host
# In local dev: backend/models or project root/models
_docker_models = Path("/app/models")
_backend_models = Path(__file__).parent.parent.parent / "models"
_local_models = Path(__file__).parent.parent.parent.parent / "models"

# Check multiple locations
if _docker_models.exists():
    MODELS_DIR = _docker_models  # Docker: /app/models mounted from host
elif (_backend_models / "card_detector" / "onnx").exists():
    MODELS_DIR = _backend_models  # Local dev: backend/models
else:
    MODELS_DIR = _local_models  # Fallback: project root/models

ONNX_BASE_DIR = MODELS_DIR / "card_detector"

# Available model variants
MODEL_VARIANTS = {
    "fp32": {
        "name": "FP32 (Full Precision)",
        "description": "Maximum precision, largest file size",
        "recommended_for": "Meilleure qualité. Pour smartphones performants.",
    },
    "fp16": {
        "name": "FP16 (Half Precision)",
        "description": "Same precision as FP32, half the size",
        "recommended_for": "Résultats très proches de FP32. Modèle recommandé.",
    },
    "int8": {
        "name": "INT8 (Quantized)",
        "description": "Smallest size, slightly reduced precision",
        "recommended_for": "Petit modèle pour smartphones moins performants.",
    },
}

DEFAULT_VARIANT = "fp16"


class ModelVariantInfo(BaseModel):
    """Information about a single model variant."""

    variant: str
    name: str
    description: str
    recommended_for: str
    size_mb: float
    sha256: str
    available: bool


class ModelInfo(BaseModel):
    """Model metadata response."""

    version: str
    format: str
    input_size: int
    num_classes: int
    default_variant: str
    variants: list[ModelVariantInfo]


class LegacyModelInfo(BaseModel):
    """Legacy model info for backward compatibility."""

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
    precision: str


def _get_variant_dir(variant: str) -> Path:
    """Get the directory for a model variant."""
    return ONNX_BASE_DIR / f"onnx_{variant}"


def _load_metadata(variant: str = None) -> dict | None:
    """Load model metadata from JSON file."""
    if variant:
        metadata_path = _get_variant_dir(variant) / "metadata.json"
    else:
        # Default metadata from fp16 (recommended variant)
        metadata_path = _get_variant_dir(DEFAULT_VARIANT) / "metadata.json"

    if not metadata_path.exists():
        return None
    with open(metadata_path) as f:
        return json.load(f)


def _get_variant_path(variant: str) -> Path:
    """Get the path to a model variant's ONNX file."""
    return _get_variant_dir(variant) / "model.onnx"


@router.get("/info", response_model=ModelInfo)
async def get_model_info():
    """Get ONNX model metadata for all available variants.

    Returns information about all model variants (FP32, FP16, INT8)
    including size, hash, and availability.
    """
    # Get default metadata for version info
    default_metadata = _load_metadata()

    variants = []
    for variant_id, variant_info in MODEL_VARIANTS.items():
        metadata = _load_metadata(variant_id)
        model_path = _get_variant_path(variant_id)

        variants.append(
            ModelVariantInfo(
                variant=variant_id,
                name=variant_info["name"],
                description=variant_info["description"],
                recommended_for=variant_info["recommended_for"],
                size_mb=metadata.get("size_mb", 0) if metadata else 0,
                sha256=metadata.get("sha256", "") if metadata else "",
                available=model_path.exists(),
            )
        )

    return ModelInfo(
        version=default_metadata.get("version", "") if default_metadata else "",
        format="onnx",
        input_size=640,
        num_classes=92,
        default_variant=DEFAULT_VARIANT,
        variants=variants,
    )


@router.get("/info/{variant}", response_model=LegacyModelInfo)
async def get_variant_info(variant: str):
    """Get detailed info for a specific model variant.

    Args:
        variant: Model variant (fp32, fp16, int8)
    """
    if variant not in MODEL_VARIANTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid variant '{variant}'. Available: {list(MODEL_VARIANTS.keys())}",
        )

    metadata = _load_metadata(variant)
    model_path = _get_variant_path(variant)

    if metadata is None:
        return LegacyModelInfo(
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
            precision=variant,
        )

    return LegacyModelInfo(
        version=metadata.get("version", ""),
        format=metadata.get("format", "onnx"),
        filename=metadata.get("filename", "model.onnx"),
        size_bytes=metadata.get("size_bytes", 0),
        size_mb=metadata.get("size_mb", 0),
        sha256=metadata.get("sha256", ""),
        input_size=metadata.get("input_size", 640),
        opset=metadata.get("opset", 17),
        num_classes=metadata.get("num_classes", 92),
        available=model_path.exists(),
        precision=metadata.get("precision", variant),
    )


@router.get("/download")
async def download_model(
    variant: str = Query(default=DEFAULT_VARIANT, description="Model variant (fp32, fp16, int8)")
):
    """Download the ONNX model file for offline inference.

    Args:
        variant: Model variant to download (default: fp16)

    Returns the model.onnx file with appropriate headers for caching.
    """
    if variant not in MODEL_VARIANTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid variant '{variant}'. Available: {list(MODEL_VARIANTS.keys())}",
        )

    model_path = _get_variant_path(variant)

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"ONNX model ({variant}) not available. Run 'python scripts/export_onnx.py' to generate it.",
        )

    metadata = _load_metadata(variant)
    etag = metadata.get("sha256", "") if metadata else ""

    return FileResponse(
        path=str(model_path),
        media_type="application/octet-stream",
        filename=f"model_{variant}.onnx",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24h
            "ETag": f'"{etag}"' if etag else "",
            "X-Model-Variant": variant,
            "X-Model-Size-MB": str(metadata.get("size_mb", 0)) if metadata else "0",
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
