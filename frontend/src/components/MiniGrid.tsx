interface MiniGridProps {
  position: number; // 0-8, position to highlight
  size?: number; // Size in pixels (default 24)
}

/**
 * Mini 3x3 grid icon showing a highlighted position.
 * Used in the score table to indicate card position.
 */
export function MiniGrid({ position, size = 24 }: MiniGridProps) {
  const cellSize = size / 3;
  const gap = 1;

  return (
    <div
      className="inline-grid grid-cols-3"
      style={{
        width: size,
        height: size,
        gap: `${gap}px`,
      }}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <div
          key={idx}
          className={`rounded-[1px] ${
            idx === position
              ? 'bg-gold'
              : 'bg-white/20'
          }`}
          style={{
            width: cellSize - gap,
            height: cellSize - gap,
          }}
        />
      ))}
    </div>
  );
}
