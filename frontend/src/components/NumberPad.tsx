interface NumberPadProps {
  value: number;
  onChange: (value: number) => void;
}

export function NumberPad({ value, onChange }: NumberPadProps) {
  const tens = Math.floor(value / 10);
  const unit = value % 10;

  const handleUnitChange = (newUnit: number) => {
    onChange(tens * 10 + newUnit);
  };

  const handleTensChange = (delta: number) => {
    const newValue = Math.max(0, Math.min(99, value + delta));
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Current value display */}
      <div className="text-center">
        <span className="text-7xl font-bold text-gold tabular-nums">
          {value}
        </span>
      </div>

      {/* Number pad grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Row 1: 1 2 3 */}
        {[1, 2, 3].map((num) => (
          <button
            key={num}
            onClick={() => handleUnitChange(num)}
            className={`
              aspect-square text-2xl font-semibold rounded-xl transition-all
              ${unit === num
                ? 'bg-gold text-dark'
                : 'bg-dark-card text-white hover:bg-dark-lighter'
              }
            `}
          >
            {num}
          </button>
        ))}
        {/* Row 2: 4 5 6 */}
        {[4, 5, 6].map((num) => (
          <button
            key={num}
            onClick={() => handleUnitChange(num)}
            className={`
              aspect-square text-2xl font-semibold rounded-xl transition-all
              ${unit === num
                ? 'bg-gold text-dark'
                : 'bg-dark-card text-white hover:bg-dark-lighter'
              }
            `}
          >
            {num}
          </button>
        ))}
        {/* Row 3: 7 8 9 */}
        {[7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleUnitChange(num)}
            className={`
              aspect-square text-2xl font-semibold rounded-xl transition-all
              ${unit === num
                ? 'bg-gold text-dark'
                : 'bg-dark-card text-white hover:bg-dark-lighter'
              }
            `}
          >
            {num}
          </button>
        ))}
        {/* Row 4: -10 0 +10 */}
        <button
          onClick={() => handleTensChange(-10)}
          disabled={value < 10}
          className="aspect-square text-xl font-semibold rounded-xl transition-all
                     bg-dark-card text-white hover:bg-dark-lighter
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          -10
        </button>
        <button
          onClick={() => handleUnitChange(0)}
          className={`
            aspect-square text-2xl font-semibold rounded-xl transition-all
            ${unit === 0
              ? 'bg-gold text-dark'
              : 'bg-dark-card text-white hover:bg-dark-lighter'
            }
          `}
        >
          0
        </button>
        <button
          onClick={() => handleTensChange(10)}
          disabled={value >= 90}
          className="aspect-square text-xl font-semibold rounded-xl transition-all
                     bg-dark-card text-white hover:bg-dark-lighter
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +10
        </button>
      </div>
    </div>
  );
}
