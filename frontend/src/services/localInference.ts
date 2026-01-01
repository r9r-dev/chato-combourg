/**
 * Local Inference Service
 *
 * Runs YOLO11 inference locally using ONNX Runtime Web.
 * Used for offline mode when server is unavailable.
 */

import * as ort from 'onnxruntime-web';
import { modelStorage } from './modelStorage';
import type { AnalyzeResponse, CardResult, CardMatch } from '../types';

// Model configuration
const INPUT_SIZE = 640;
const NUM_CLASSES = 92;
const CONFIDENCE_THRESHOLD = 0.3;
const IOU_THRESHOLD = 0.45;

// Class names are not used directly in inference, but kept for reference
// The card_id is computed from class_id: card_id = (class_id + 1).padStart(3, '0')

interface Detection {
  classId: number;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionWithGrid extends Detection {
  row: number;
  col: number;
}

class LocalInferenceService {
  private session: ort.InferenceSession | null = null;
  private isInitializing = false;

  /**
   * Check if local inference is available
   */
  async isAvailable(): Promise<boolean> {
    return await modelStorage.hasModel();
  }

  /**
   * Initialize the ONNX session
   */
  async initialize(): Promise<void> {
    if (this.session || this.isInitializing) return;

    this.isInitializing = true;
    try {
      const modelData = await modelStorage.loadModel();
      if (!modelData) {
        throw new Error('Model not found in storage');
      }

      // Create session with WebGL backend for GPU acceleration
      this.session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all',
      });

      console.log('Local inference session initialized');
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Pre-process image for YOLO inference
   */
  private async preprocessImage(imageBlob: Blob): Promise<ort.Tensor> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = INPUT_SIZE;
          canvas.height = INPUT_SIZE;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Calculate letterbox dimensions to maintain aspect ratio
          // Note: img.width/height are the displayed dimensions (EXIF-corrected by browser)
          const scale = Math.min(INPUT_SIZE / img.height, INPUT_SIZE / img.width);
          const newWidth = Math.round(img.width * scale);
          const newHeight = Math.round(img.height * scale);

          // Calculate padding (same formula as ultralytics LetterBox)
          const dw = INPUT_SIZE - newWidth;
          const dh = INPUT_SIZE - newHeight;
          const offsetX = Math.round(dw / 2 - 0.1);
          const offsetY = Math.round(dh / 2 - 0.1);

          // Fill with letterbox color (114, 114, 114) - same as YOLO training
          ctx.fillStyle = 'rgb(114, 114, 114)';
          ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

          // Draw resized image centered
          ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);

          // Get image data
          const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
          const pixels = imageData.data;

          // Convert to CHW format and normalize to 0-1
          const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
          for (let y = 0; y < INPUT_SIZE; y++) {
            for (let x = 0; x < INPUT_SIZE; x++) {
              const pixelIndex = (y * INPUT_SIZE + x) * 4;
              const tensorIndex = y * INPUT_SIZE + x;

              // RGB channels, normalized to 0-1
              float32Data[tensorIndex] = pixels[pixelIndex] / 255;                          // R
              float32Data[INPUT_SIZE * INPUT_SIZE + tensorIndex] = pixels[pixelIndex + 1] / 255;  // G
              float32Data[2 * INPUT_SIZE * INPUT_SIZE + tensorIndex] = pixels[pixelIndex + 2] / 255; // B
            }
          }

          // Create tensor [1, 3, 640, 640]
          const tensor = new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
          resolve(tensor);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageBlob);
    });
  }

  /**
   * Post-process YOLO output to extract detections
   */
  private postprocessOutput(output: ort.Tensor): Detection[] {
    const data = output.data as Float32Array;
    const [, , numPredictions] = output.dims; // [1, 96, 8400]

    const detections: Detection[] = [];

    for (let i = 0; i < numPredictions; i++) {
      // Extract box coordinates (x, y, w, h are first 4 values)
      const x = data[0 * numPredictions + i];
      const y = data[1 * numPredictions + i];
      const w = data[2 * numPredictions + i];
      const h = data[3 * numPredictions + i];

      // Find best class and its confidence
      let bestClassId = 0;
      let bestConfidence = 0;

      for (let c = 0; c < NUM_CLASSES; c++) {
        const confidence = data[(4 + c) * numPredictions + i];
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestClassId = c;
        }
      }

      // Filter by confidence threshold
      if (bestConfidence >= CONFIDENCE_THRESHOLD) {
        detections.push({
          classId: bestClassId,
          confidence: bestConfidence,
          x: x / INPUT_SIZE,       // Normalize to 0-1
          y: y / INPUT_SIZE,
          width: w / INPUT_SIZE,
          height: h / INPUT_SIZE,
        });
      }
    }

    return detections;
  }

  /**
   * Apply Non-Maximum Suppression
   */
  private applyNMS(detections: Detection[]): Detection[] {
    // Sort by confidence (descending)
    detections.sort((a, b) => b.confidence - a.confidence);

    const kept: Detection[] = [];

    for (const det of detections) {
      let dominated = false;

      for (const kept_det of kept) {
        const iou = this.computeIoU(det, kept_det);
        if (iou > IOU_THRESHOLD) {
          dominated = true;
          break;
        }
      }

      if (!dominated) {
        kept.push(det);
      }
    }

    return kept;
  }

  /**
   * Compute Intersection over Union
   */
  private computeIoU(a: Detection, b: Detection): number {
    const ax1 = a.x - a.width / 2;
    const ay1 = a.y - a.height / 2;
    const ax2 = a.x + a.width / 2;
    const ay2 = a.y + a.height / 2;

    const bx1 = b.x - b.width / 2;
    const by1 = b.y - b.height / 2;
    const bx2 = b.x + b.width / 2;
    const by2 = b.y + b.height / 2;

    const interX1 = Math.max(ax1, bx1);
    const interY1 = Math.max(ay1, by1);
    const interX2 = Math.min(ax2, bx2);
    const interY2 = Math.min(ay2, by2);

    const interWidth = Math.max(0, interX2 - interX1);
    const interHeight = Math.max(0, interY2 - interY1);
    const interArea = interWidth * interHeight;

    const aArea = a.width * a.height;
    const bArea = b.width * b.height;
    const unionArea = aArea + bArea - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
  }

  /**
   * Assign detections to grid positions
   */
  private assignGridPositions(detections: Detection[]): DetectionWithGrid[] {
    if (detections.length === 0) return [];

    // Compute grid bounds from detections
    const xs = detections.map(d => d.x);
    const ys = detections.map(d => d.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const avgWidth = detections.reduce((sum, d) => sum + d.width, 0) / detections.length;
    const avgHeight = detections.reduce((sum, d) => sum + d.height, 0) / detections.length;

    // Expand bounds with margin
    const gridLeft = minX - avgWidth * 0.6;
    const gridRight = maxX + avgWidth * 0.6;
    const gridTop = minY - avgHeight * 0.6;
    const gridBottom = maxY + avgHeight * 0.6;

    const gridWidth = gridRight - gridLeft;
    const gridHeight = gridBottom - gridTop;

    // Assign grid positions and return as DetectionWithGrid
    const gridDetections: DetectionWithGrid[] = detections.map(det => {
      const col = Math.min(2, Math.max(0, Math.floor(((det.x - gridLeft) / gridWidth) * 3)));
      const row = Math.min(2, Math.max(0, Math.floor(((det.y - gridTop) / gridHeight) * 3)));
      return { ...det, row, col };
    });

    return gridDetections;
  }

  /**
   * Select best 9 cards (one per grid position)
   */
  private selectBest9(detections: DetectionWithGrid[]): DetectionWithGrid[] {
    if (detections.length <= 9) return detections;

    const grid = new Map<string, DetectionWithGrid>();

    for (const det of detections) {
      const key = `${det.row},${det.col}`;
      const existing = grid.get(key);
      if (!existing || det.confidence > existing.confidence) {
        grid.set(key, det);
      }
    }

    return Array.from(grid.values()).sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
  }

  /**
   * Convert class_id to card_id string
   */
  private classIdToCardId(classId: number): string {
    return String(classId + 1).padStart(3, '0');
  }

  /**
   * Run inference on an image
   */
  async analyze(imageBlob: Blob): Promise<AnalyzeResponse> {
    try {
      await this.initialize();

      if (!this.session) {
        throw new Error('Session not initialized');
      }

      // Pre-process image
      const inputTensor = await this.preprocessImage(imageBlob);

      // Run inference
      const feeds = { images: inputTensor };
      const results = await this.session.run(feeds);

      // Get output tensor (output0)
      const outputTensor = results['output0'];
      if (!outputTensor) {
        throw new Error('No output tensor found');
      }

      // Post-process
      const rawDetections = this.postprocessOutput(outputTensor);
      const nmsDetections = this.applyNMS(rawDetections);
      const gridDetections = this.assignGridPositions(nmsDetections);
      const best9 = this.selectBest9(gridDetections);

      // Convert to CardResult format
      const cards: CardResult[] = best9.map(det => {
        const cardId = this.classIdToCardId(det.classId);
        const matches: CardMatch[] = [
          { id: cardId, probability: det.confidence }
        ];

        // Add similar cards as alternatives (simplified - just adjacent class IDs)
        const altIds = [det.classId - 1, det.classId + 1].filter(id => id >= 0 && id < NUM_CLASSES);
        for (const altId of altIds.slice(0, 2)) {
          matches.push({
            id: this.classIdToCardId(altId),
            probability: Math.max(0, det.confidence - 0.1)
          });
        }

        return {
          position: [det.row, det.col] as [number, number],
          matches,
          method: 'local-onnx',
          bbox: {
            x: (det.x - det.width / 2) * 100,
            y: (det.y - det.height / 2) * 100,
            width: det.width * 100,
            height: det.height * 100,
          },
        };
      });

      return {
        success: true,
        cards,
        // No capture_id for local inference - captures are not saved
      };

    } catch (error) {
      console.error('Local inference error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Local inference failed',
        cards: [],
      };
    }
  }

  /**
   * Get the variant of the stored model (fp32, fp16, int8)
   */
  async getModelVariant(): Promise<string | null> {
    const info = await modelStorage.getModelInfo();
    return info?.variant ?? null;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      // ONNX Runtime Web sessions don't have a dispose method
      this.session = null;
    }
  }
}

export const localInference = new LocalInferenceService();
