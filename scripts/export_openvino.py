#!/usr/bin/env python3
"""Export YOLO model to OpenVINO format.

Usage:
    python scripts/export_openvino.py /path/to/model.pt /path/to/output_dir

The output directory will contain the OpenVINO model with the correct
naming convention expected by Ultralytics (*_openvino_model/).
"""
import sys
from pathlib import Path

from ultralytics import YOLO


def main():
    if len(sys.argv) < 2:
        print("Usage: python export_openvino.py <model.pt> [output_dir]")
        print("Example: python export_openvino.py ./models/model.pt ./models/")
        sys.exit(1)

    model_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else model_path.parent

    if not model_path.exists():
        print(f"Error: Model not found: {model_path}")
        sys.exit(1)

    print(f"Loading model: {model_path}")
    model = YOLO(str(model_path))

    print(f"Exporting to OpenVINO format...")
    # Export creates a folder named: {model_stem}_openvino_model/
    # e.g., model.pt -> model_openvino_model/
    export_path = model.export(format="openvino")

    print(f"Export complete: {export_path}")

    # List exported files
    export_dir = Path(export_path)
    if export_dir.is_dir():
        print("\nExported files:")
        for f in sorted(export_dir.iterdir()):
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"  {f.name}: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
