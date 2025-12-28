interface GridOverlayProps {
  identifiedCount: number;
}

export function GridOverlay({ identifiedCount }: GridOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Grid lines */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="border border-gold/50"
          />
        ))}
      </div>

      {/* Corner indicators */}
      <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-gold rounded-tl-lg" />
      <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-gold rounded-tr-lg" />
      <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-gold rounded-bl-lg" />
      <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-gold rounded-br-lg" />

      {/* Progress indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-dark/80 px-4 py-2 rounded-full">
        <span className="text-gold font-semibold">{identifiedCount}/9</span>
        <span className="text-white/70 ml-2">cartes identifiées</span>
      </div>
    </div>
  );
}
