import type { BoundingBox } from '../types';

interface GridOverlayProps {
  /** Set of identified card positions (0-8) */
  identifiedPositions: Set<number>;
  /** Detected bounding boxes by position */
  detectedBboxes: Map<number, BoundingBox>;
}

export function GridOverlay({ identifiedPositions, detectedBboxes }: GridOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Detection rectangles - cyan overlay for detected cards */}
      {Array.from(detectedBboxes.entries()).map(([position, bbox]) => {
        const isIdentified = identifiedPositions.has(position);
        return (
          <div
            key={`bbox-${position}`}
            className={`absolute border-2 rounded-sm transition-colors ${
              isIdentified
                ? 'border-cyan-400 bg-cyan-400/20'
                : 'border-white/30 bg-white/10'
            }`}
            style={{
              left: `${bbox.x}%`,
              top: `${bbox.y}%`,
              width: `${bbox.width}%`,
              height: `${bbox.height}%`,
            }}
          />
        );
      })}

      {/* Grid with numbered badges */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => {
          const isIdentified = identifiedPositions.has(i);
          return (
            <div key={i} className="relative border border-gold/50 flex items-center justify-center">
              {/* Numbered badge */}
              <div
                className={`
                  w-12 h-12 rounded-full
                  flex items-center justify-center
                  text-xl font-bold transition-colors
                  ${isIdentified
                    ? 'bg-green-500/80 text-white'
                    : 'bg-dark/50 text-white/40 border-2 border-white/20'
                  }
                `}
              >
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Corner indicators */}
      <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-gold rounded-tl-lg" />
      <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-gold rounded-tr-lg" />
      <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-gold rounded-bl-lg" />
      <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-gold rounded-br-lg" />
    </div>
  );
}
