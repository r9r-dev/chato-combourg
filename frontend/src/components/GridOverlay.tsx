interface GridOverlayProps {
  /** Set of identified card positions (0-8) */
  identifiedPositions: Set<number>;
}

export function GridOverlay({ identifiedPositions }: GridOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Grid with numbered badges */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => {
          const isIdentified = identifiedPositions.has(i);
          return (
            <div key={i} className="relative border border-gold/50">
              {/* Numbered badge */}
              <div
                className={`
                  absolute top-1 left-1 w-6 h-6 rounded-full
                  flex items-center justify-center
                  text-sm font-bold transition-colors
                  ${isIdentified
                    ? 'bg-green-500 text-white'
                    : 'bg-dark/70 text-white/50 border border-white/30'
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
