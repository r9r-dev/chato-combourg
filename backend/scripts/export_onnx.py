#!/usr/bin/env python3
"""Export YOLO model to ONNX format for browser inference.

This script exports the trained YOLO11 model to ONNX format compatible
with ONNX Runtime Web for client-side inference in the PWA.

Usage:
    python scripts/export_onnx.py                       # Export FP32 (default)
    python scripts/export_onnx.py --half                # Export FP16 (smaller, slightly less precise)
    python scripts/export_onnx.py --imgsz 480           # Smaller input for mobile
    python scripts/export_onnx.py --output ./custom/    # Custom output directory

WARNING: INT8 quantization is NOT recommended for YOLO models as it
drastically degrades detection accuracy. Use FP32 or FP16 instead.
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

from ultralytics import YOLO


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export YOLO model to ONNX for browser inference"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to model.pt (default: auto-detect in models/card_detector/)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory (default: backend/models/card_detector/onnx/)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Input image size (default: 640)",
    )
    parser.add_argument(
        "--half",
        action="store_true",
        default=False,
        help="Export in FP16 half-precision (smaller file, ~170MB -> ~85MB)",
    )
    parser.add_argument(
        "--simplify",
        action="store_true",
        default=True,
        help="Simplify ONNX model graph (default: True)",
    )
    parser.add_argument(
        "--no-simplify",
        action="store_false",
        dest="simplify",
        help="Disable model simplification",
    )
    parser.add_argument(
        "--dynamic",
        action="store_true",
        default=False,
        help="Enable dynamic input shapes (default: False for better browser perf)",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=17,
        help="ONNX opset version (default: 17 for broad compatibility)",
    )
    return parser.parse_args()


def find_model_path(script_dir: Path) -> Path | None:
    """Find the best available model file."""
    backend_dir = script_dir.parent
    project_root = backend_dir.parent

    # Search in multiple locations
    search_dirs = [
        backend_dir / "models" / "card_detector",
        project_root / "models" / "card_detector",
    ]

    for base_dir in search_dirs:
        # Priority order for each location
        candidates = [
            base_dir / "yolo11" / "model.pt",
            base_dir / "best.pt",
            base_dir / "last.pt",
            base_dir / "weights" / "best.pt",
            base_dir / "weights" / "last.pt",
        ]

        for path in candidates:
            if path.exists():
                return path

    return None


def compute_file_hash(file_path: Path) -> str:
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def main():
    args = parse_args()

    # Determine paths
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent

    # Find model
    if args.model:
        model_path = Path(args.model)
    else:
        model_path = find_model_path(script_dir)

    if model_path is None or not model_path.exists():
        print(f"Error: Model not found.")
        print(f"Searched in:")
        print(f"  - {backend_dir / 'models' / 'card_detector'}")
        print(f"  - {backend_dir.parent / 'models' / 'card_detector'}")
        print("Please provide a model path with --model")
        return 1

    print(f"Source model: {model_path}")

    # Output directory
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = backend_dir / "models" / "card_detector" / "onnx"

    output_dir.mkdir(parents=True, exist_ok=True)

    # Load model
    print(f"Loading model...")
    model = YOLO(str(model_path))

    # Determine precision
    precision = "fp16" if args.half else "fp32"

    # Export configuration
    print(f"\nExport configuration:")
    print(f"  Precision: {precision.upper()}")
    print(f"  Image size: {args.imgsz}x{args.imgsz}")
    print(f"  Simplify: {args.simplify}")
    print(f"  Dynamic: {args.dynamic}")
    print(f"  Opset: {args.opset}")

    # Export to ONNX
    print(f"\nExporting to ONNX ({precision.upper()})...")
    try:
        export_path = model.export(
            format="onnx",
            imgsz=args.imgsz,
            simplify=args.simplify,
            dynamic=args.dynamic,
            opset=args.opset,
            half=args.half,
        )

        # Move to output directory
        export_path = Path(export_path)
        final_path = output_dir / "model.onnx"

        if export_path != final_path:
            import shutil
            shutil.move(str(export_path), str(final_path))

        print(f"\nModel exported to: {final_path}")

    except Exception as e:
        print(f"Error during export: {e}")
        return 1

    # Compute metadata
    file_size = final_path.stat().st_size
    file_hash = compute_file_hash(final_path)

    # Create metadata file for the API
    metadata = {
        "version": datetime.now().strftime("%Y%m%d"),
        "format": "onnx",
        "filename": "model.onnx",
        "size_bytes": file_size,
        "size_mb": round(file_size / (1024 * 1024), 2),
        "sha256": file_hash,
        "input_size": args.imgsz,
        "opset": args.opset,
        "precision": precision,
        "simplified": args.simplify,
        "dynamic": args.dynamic,
        "num_classes": 92,
        "exported_at": datetime.now().isoformat(),
        "source_model": model_path.name,
    }

    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nMetadata saved to: {metadata_path}")
    print(f"\nExport summary:")
    print(f"  Precision: {precision.upper()}")
    print(f"  File size: {metadata['size_mb']} MB")
    print(f"  SHA-256: {file_hash[:16]}...")
    print(f"  Version: {metadata['version']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
