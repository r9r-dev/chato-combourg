import type { BoundingBox } from '../types';

interface DetectionResult {
  bbox: BoundingBox;
  confidence: number;
}

interface GridOverlayProps {
  /** Display mode: 'viewfinder' shows grid lines only, 'results' shows detection rectangles */
  mode: 'viewfinder' | 'results';
  /** Detection results with bounding boxes and confidence - only used in results mode */
  detections?: DetectionResult[];
}

const CONFIDENCE_THRESHOLD = 0.75;

export function GridOverlay({ mode, detections = [] }: GridOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {mode === 'viewfinder' ? (
        <>
          {/* Grid lines only (mire) */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-gold/50" />
            ))}
          </div>

          {/* Corner indicators */}
          <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-gold rounded-tl-lg" />
          <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-gold rounded-tr-lg" />
          <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-gold rounded-bl-lg" />
          <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-gold rounded-br-lg" />
        </>
      ) : (
        /* Results mode: detection rectangles */
        <>
          {detections.map((detection, index) => {
            const isHighConfidence = detection.confidence >= CONFIDENCE_THRESHOLD;
            return (
              <div
                key={index}
                className={`absolute border-2 rounded-sm ${
                  isHighConfidence
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-white bg-white/20'
                }`}
                style={{
                  left: `${detection.bbox.x}%`,
                  top: `${detection.bbox.y}%`,
                  width: `${detection.bbox.width}%`,
                  height: `${detection.bbox.height}%`,
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
