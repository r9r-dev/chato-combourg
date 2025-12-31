#!/usr/bin/env python3
"""Test script to compare PyTorch and ONNX model inference.

This script:
1. Generates a synthetic test image with a 3x3 grid of cards
2. Runs inference with PyTorch model
3. Runs inference with ONNX model (same preprocessing as frontend)
4. Compares results and identifies discrepancies

Usage:
    cd backend
    source venv/bin/activate
    python scripts/test_onnx.py
    python scripts/test_onnx.py --image path/to/real/photo.jpg
"""

import argparse
import random
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image
from ultralytics import YOLO


# Configuration
INPUT_SIZE = 640
NUM_CLASSES = 92
CONFIDENCE_THRESHOLD = 0.3

SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
CARDS_DIR = BACKEND_DIR / "cards"
TESTS_DIR = PROJECT_ROOT / "tests"

# Models can be in backend/models or root/models
BACKEND_MODELS_DIR = BACKEND_DIR / "models" / "card_detector"
ROOT_MODELS_DIR = PROJECT_ROOT / "models" / "card_detector"

# Find ONNX model
if (BACKEND_MODELS_DIR / "onnx" / "model.onnx").exists():
    ONNX_MODEL_PATH = BACKEND_MODELS_DIR / "onnx" / "model.onnx"
else:
    ONNX_MODEL_PATH = ROOT_MODELS_DIR / "onnx" / "model.onnx"

# Find PyTorch model
if (BACKEND_MODELS_DIR / "yolo11" / "model.pt").exists():
    PYTORCH_MODEL_PATH = BACKEND_MODELS_DIR / "yolo11" / "model.pt"
elif (ROOT_MODELS_DIR / "yolo11" / "model.pt").exists():
    PYTORCH_MODEL_PATH = ROOT_MODELS_DIR / "yolo11" / "model.pt"
else:
    # Fallback
    PYTORCH_MODEL_PATH = ROOT_MODELS_DIR / "yolo11" / "model.pt"


def generate_test_image(output_path: Path = None) -> tuple[Image.Image, list[str]]:
    """Generate a synthetic 3x3 grid image with random cards.

    Returns:
        Tuple of (PIL Image, list of card_ids used)
    """
    # Card dimensions (original: 630x880)
    card_width, card_height = 200, 280
    gap = 20

    # Grid dimensions
    grid_width = card_width * 3 + gap * 4
    grid_height = card_height * 3 + gap * 4

    # Create background (simulating a table)
    image = Image.new("RGB", (grid_width, grid_height), color=(50, 50, 50))

    # Select 9 random cards
    card_files = list(CARDS_DIR.glob("carte_*.png"))
    selected_cards = random.sample(card_files, 9)
    card_ids = []

    # Place cards in grid
    for row in range(3):
        for col in range(3):
            idx = row * 3 + col
            card_path = selected_cards[idx]
            card_id = card_path.stem.replace("carte_", "")
            card_ids.append(card_id)

            # Load and resize card
            card = Image.open(card_path).convert("RGB")
            card = card.resize((card_width, card_height), Image.Resampling.LANCZOS)

            # Calculate position
            x = gap + col * (card_width + gap)
            y = gap + row * (card_height + gap)

            # Paste card
            image.paste(card, (x, y))

    if output_path:
        image.save(output_path, "JPEG", quality=95)
        print(f"Test image saved to: {output_path}")

    return image, card_ids


def preprocess_for_onnx(image: Image.Image) -> np.ndarray:
    """Preprocess image for ONNX inference (same as frontend localInference.ts).

    Uses the same letterbox formula as ultralytics LetterBox for consistency.
    """
    # Handle EXIF orientation (like browser does automatically)
    from PIL import ImageOps
    image = ImageOps.exif_transpose(image)

    # Calculate letterbox dimensions (using height/width order like ultralytics)
    orig_w, orig_h = image.size
    scale = min(INPUT_SIZE / orig_h, INPUT_SIZE / orig_w)
    new_w = round(orig_w * scale)
    new_h = round(orig_h * scale)

    # Calculate padding (same formula as ultralytics LetterBox)
    dw = INPUT_SIZE - new_w
    dh = INPUT_SIZE - new_h
    offset_x = round(dw / 2 - 0.1)
    offset_y = round(dh / 2 - 0.1)

    # Create letterboxed image with YOLO letterbox color (114, 114, 114)
    letterboxed = Image.new("RGB", (INPUT_SIZE, INPUT_SIZE), color=(114, 114, 114))
    resized = image.resize((new_w, new_h), Image.Resampling.BILINEAR)
    letterboxed.paste(resized, (offset_x, offset_y))

    # Convert to numpy and normalize to 0-1
    img_array = np.array(letterboxed).astype(np.float32) / 255.0

    # Convert HWC to CHW format
    img_array = img_array.transpose(2, 0, 1)

    # Add batch dimension [1, 3, 640, 640]
    img_array = np.expand_dims(img_array, axis=0)

    return img_array


def postprocess_onnx_output(output: np.ndarray, conf_threshold: float = CONFIDENCE_THRESHOLD) -> list[dict]:
    """Post-process ONNX output (same logic as frontend localInference.ts)."""
    # Output shape: [1, 96, 8400] where 96 = 4 (bbox) + 92 (classes)
    data = output[0]  # Remove batch dimension -> [96, 8400]
    num_predictions = data.shape[1]

    detections = []

    for i in range(num_predictions):
        # Extract box coordinates (x, y, w, h)
        x = data[0, i]
        y = data[1, i]
        w = data[2, i]
        h = data[3, i]

        # Find best class and confidence
        class_scores = data[4:, i]  # Shape: [92,]
        best_class_id = int(np.argmax(class_scores))
        best_confidence = float(class_scores[best_class_id])

        if best_confidence >= conf_threshold:
            detections.append({
                "class_id": best_class_id,
                "confidence": best_confidence,
                "x": float(x) / INPUT_SIZE,
                "y": float(y) / INPUT_SIZE,
                "width": float(w) / INPUT_SIZE,
                "height": float(h) / INPUT_SIZE,
            })

    return detections


def apply_nms(detections: list[dict], iou_threshold: float = 0.45) -> list[dict]:
    """Apply Non-Maximum Suppression."""
    if not detections:
        return []

    # Sort by confidence
    detections = sorted(detections, key=lambda d: d["confidence"], reverse=True)

    kept = []
    for det in detections:
        dominated = False
        for kept_det in kept:
            iou = compute_iou(det, kept_det)
            if iou > iou_threshold:
                dominated = True
                break
        if not dominated:
            kept.append(det)

    return kept


def compute_iou(a: dict, b: dict) -> float:
    """Compute Intersection over Union."""
    ax1 = a["x"] - a["width"] / 2
    ay1 = a["y"] - a["height"] / 2
    ax2 = a["x"] + a["width"] / 2
    ay2 = a["y"] + a["height"] / 2

    bx1 = b["x"] - b["width"] / 2
    by1 = b["y"] - b["height"] / 2
    bx2 = b["x"] + b["width"] / 2
    by2 = b["y"] + b["height"] / 2

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    a_area = a["width"] * a["height"]
    b_area = b["width"] * b["height"]
    union_area = a_area + b_area - inter_area

    return inter_area / union_area if union_area > 0 else 0


def class_id_to_card_id(class_id: int) -> str:
    """Convert class_id (0-91) to card_id string (001-092)."""
    return f"{class_id + 1:03d}"


def inspect_onnx_model(model_path: Path) -> dict:
    """Inspect ONNX model to get input/output names and shapes."""
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    inputs = []
    for inp in session.get_inputs():
        inputs.append({
            "name": inp.name,
            "shape": inp.shape,
            "type": inp.type,
        })

    outputs = []
    for out in session.get_outputs():
        outputs.append({
            "name": out.name,
            "shape": out.shape,
            "type": out.type,
        })

    return {"inputs": inputs, "outputs": outputs}


def run_pytorch_inference(image: Image.Image, model_path: Path) -> list[dict]:
    """Run inference with PyTorch model."""
    model = YOLO(str(model_path), task="detect")
    results = model.predict(source=image, verbose=False, conf=CONFIDENCE_THRESHOLD, task="detect")

    detections = []
    boxes = results[0].boxes

    for box in boxes:
        x1, y1, x2, y2 = map(float, box.xyxy[0].cpu().numpy())
        conf = float(box.conf[0].cpu().numpy())
        class_id = int(box.cls[0].cpu().numpy())

        # Normalize to 0-1
        img_w, img_h = image.size
        detections.append({
            "class_id": class_id,
            "card_id": class_id_to_card_id(class_id),
            "confidence": conf,
            "bbox": {
                "x1": x1 / img_w,
                "y1": y1 / img_h,
                "x2": x2 / img_w,
                "y2": y2 / img_h,
            },
        })

    return detections


def run_onnx_inference(image: Image.Image, model_path: Path) -> list[dict]:
    """Run inference with ONNX model (same as frontend)."""
    # Get model info
    model_info = inspect_onnx_model(model_path)
    input_name = model_info["inputs"][0]["name"]
    output_name = model_info["outputs"][0]["name"]

    # Create session
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    # Preprocess
    input_tensor = preprocess_for_onnx(image)

    # Run inference
    outputs = session.run([output_name], {input_name: input_tensor})
    output = outputs[0]

    # Post-process
    detections = postprocess_onnx_output(output)
    detections = apply_nms(detections)

    # Convert to same format as PyTorch
    results = []
    for det in detections:
        results.append({
            "class_id": det["class_id"],
            "card_id": class_id_to_card_id(det["class_id"]),
            "confidence": det["confidence"],
            "bbox": {
                "x1": det["x"] - det["width"] / 2,
                "y1": det["y"] - det["height"] / 2,
                "x2": det["x"] + det["width"] / 2,
                "y2": det["y"] + det["height"] / 2,
            },
        })

    return results


def run_onnx_via_yolo(image: Image.Image, model_path: Path) -> list[dict]:
    """Run inference with ONNX model via YOLO API (correct preprocessing)."""
    model = YOLO(str(model_path), task="detect")
    results = model.predict(source=image, verbose=False, conf=CONFIDENCE_THRESHOLD, task="detect")

    detections = []
    boxes = results[0].boxes

    for box in boxes:
        x1, y1, x2, y2 = map(float, box.xyxy[0].cpu().numpy())
        conf = float(box.conf[0].cpu().numpy())
        class_id = int(box.cls[0].cpu().numpy())

        # Normalize to 0-1
        img_w, img_h = image.size
        detections.append({
            "class_id": class_id,
            "card_id": class_id_to_card_id(class_id),
            "confidence": conf,
            "bbox": {
                "x1": x1 / img_w,
                "y1": y1 / img_h,
                "x2": x2 / img_w,
                "y2": y2 / img_h,
            },
        })

    return detections


def print_results(title: str, detections: list[dict]):
    """Print detection results."""
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"Number of detections: {len(detections)}")

    if not detections:
        print("  (no detections)")
        return

    # Sort by confidence
    detections = sorted(detections, key=lambda d: d["confidence"], reverse=True)

    for i, det in enumerate(detections):
        print(f"  [{i+1}] Card {det['card_id']} (class {det['class_id']:2d}) "
              f"conf={det['confidence']:.4f}")


def compare_results(pytorch_dets: list[dict], onnx_dets: list[dict], expected_cards: list[str]):
    """Compare PyTorch and ONNX results."""
    print(f"\n{'='*60}")
    print("COMPARISON")
    print(f"{'='*60}")

    pytorch_cards = set(d["card_id"] for d in pytorch_dets)
    onnx_cards = set(d["card_id"] for d in onnx_dets)
    expected_set = set(expected_cards)

    print(f"\nExpected cards:      {sorted(expected_cards)}")
    print(f"PyTorch detected:    {sorted(pytorch_cards)} ({len(pytorch_cards)}/9)")
    print(f"ONNX detected:       {sorted(onnx_cards)} ({len(onnx_cards)}/9)")

    # Check correctness
    pytorch_correct = pytorch_cards & expected_set
    onnx_correct = onnx_cards & expected_set

    print(f"\nPyTorch correct:     {len(pytorch_correct)}/9 ({len(pytorch_correct)/9*100:.1f}%)")
    print(f"ONNX correct:        {len(onnx_correct)}/9 ({len(onnx_correct)/9*100:.1f}%)")

    # Confidence comparison
    if pytorch_dets and onnx_dets:
        pytorch_avg_conf = sum(d["confidence"] for d in pytorch_dets) / len(pytorch_dets)
        onnx_avg_conf = sum(d["confidence"] for d in onnx_dets) / len(onnx_dets)
        print(f"\nPyTorch avg confidence: {pytorch_avg_conf:.4f}")
        print(f"ONNX avg confidence:    {onnx_avg_conf:.4f}")
        print(f"Confidence difference:  {pytorch_avg_conf - onnx_avg_conf:+.4f}")

    # Detailed per-card comparison
    print(f"\n--- Per-card Analysis ---")

    for card_id in sorted(expected_set):
        pytorch_det = next((d for d in pytorch_dets if d["card_id"] == card_id), None)
        onnx_det = next((d for d in onnx_dets if d["card_id"] == card_id), None)

        pt_status = f"conf={pytorch_det['confidence']:.3f}" if pytorch_det else "MISSED"
        onnx_status = f"conf={onnx_det['confidence']:.3f}" if onnx_det else "MISSED"

        print(f"  Card {card_id}: PyTorch={pt_status:15s} ONNX={onnx_status}")


def main():
    parser = argparse.ArgumentParser(description="Compare PyTorch and ONNX model inference")
    parser.add_argument("--image", type=str, help="Path to a real test image (optional)")
    parser.add_argument("--conf", type=float, default=CONFIDENCE_THRESHOLD, help="Confidence threshold")
    args = parser.parse_args()

    print("=" * 60)
    print("ONNX Model Test - PyTorch vs ONNX Comparison")
    print("=" * 60)

    # Check models exist
    if not PYTORCH_MODEL_PATH.exists():
        print(f"ERROR: PyTorch model not found at {PYTORCH_MODEL_PATH}")
        return 1

    if not ONNX_MODEL_PATH.exists():
        print(f"ERROR: ONNX model not found at {ONNX_MODEL_PATH}")
        return 1

    print(f"\nPyTorch model: {PYTORCH_MODEL_PATH}")
    print(f"ONNX model:    {ONNX_MODEL_PATH}")

    # Inspect ONNX model
    print("\n--- ONNX Model Info ---")
    model_info = inspect_onnx_model(ONNX_MODEL_PATH)
    for inp in model_info["inputs"]:
        print(f"  Input:  name='{inp['name']}', shape={inp['shape']}, type={inp['type']}")
    for out in model_info["outputs"]:
        print(f"  Output: name='{out['name']}', shape={out['shape']}, type={out['type']}")

    # Generate or load test image
    if args.image:
        image_path = Path(args.image)
        if not image_path.exists():
            print(f"ERROR: Image not found at {image_path}")
            return 1
        image = Image.open(image_path).convert("RGB")
        expected_cards = []  # Unknown for real images
        print(f"\nUsing real image: {image_path}")
    else:
        print("\nGenerating synthetic test image...")
        output_path = BACKEND_DIR / "test_grid.jpg"
        image, expected_cards = generate_test_image(output_path)
        print(f"Expected cards: {expected_cards}")

    # Run PyTorch inference
    print("\nRunning PyTorch inference...")
    pytorch_results = run_pytorch_inference(image, PYTORCH_MODEL_PATH)
    print_results("PyTorch Results", pytorch_results)

    # Run ONNX inference (manual preprocessing - like frontend)
    print("\nRunning ONNX inference (manual preprocessing)...")
    onnx_results = run_onnx_inference(image, ONNX_MODEL_PATH)
    print_results("ONNX Results (manual)", onnx_results)

    # Run ONNX via YOLO API (correct preprocessing)
    print("\nRunning ONNX via YOLO API (correct preprocessing)...")
    onnx_yolo_results = run_onnx_via_yolo(image, ONNX_MODEL_PATH)
    print_results("ONNX via YOLO", onnx_yolo_results)

    # Compare
    if expected_cards:
        compare_results(pytorch_results, onnx_results, expected_cards)
    else:
        print(f"\n--- Comparison (real image, expected cards unknown) ---")
        print(f"PyTorch: {len(pytorch_results)} detections")
        print(f"ONNX:    {len(onnx_results)} detections")

        pytorch_cards = [d["card_id"] for d in pytorch_results]
        onnx_cards = [d["card_id"] for d in onnx_results]

        print(f"\nPyTorch cards: {pytorch_cards}")
        print(f"ONNX cards:    {onnx_cards}")

        matching = set(pytorch_cards) & set(onnx_cards)
        print(f"\nMatching cards: {len(matching)} / max({len(pytorch_cards)}, {len(onnx_cards)})")

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
