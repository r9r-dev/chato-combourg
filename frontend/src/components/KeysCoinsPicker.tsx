interface PickerProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  showLargeButtons?: boolean;
}

function Picker({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  showLargeButtons = false,
}: PickerProps) {
  const decrement = (amount: number) => onChange(Math.max(min, value - amount));
  const increment = (amount: number) => onChange(Math.min(max, value + amount));

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/70 text-sm w-12">{label}</span>
      <div className="flex items-center gap-1">
        {showLargeButtons && (
          <button
            onClick={() => decrement(5)}
            disabled={value <= min}
            className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded
                       bg-dark-card text-gold/70 hover:bg-dark hover:text-gold
                       disabled:text-white/20 disabled:hover:bg-dark-card transition-colors"
          >
            -5
          </button>
        )}
        <div className="flex items-center bg-dark-card rounded-lg overflow-hidden">
          <button
            onClick={() => decrement(1)}
            disabled={value <= min}
            className="w-8 h-8 flex items-center justify-center text-lg font-bold
                       text-gold hover:bg-dark disabled:text-white/30 disabled:hover:bg-transparent
                       transition-colors"
          >
            -
          </button>
          <span className="w-8 text-center text-base font-semibold text-white">
            {value}
          </span>
          <button
            onClick={() => increment(1)}
            disabled={value >= max}
            className="w-8 h-8 flex items-center justify-center text-lg font-bold
                       text-gold hover:bg-dark disabled:text-white/30 disabled:hover:bg-transparent
                       transition-colors"
          >
            +
          </button>
        </div>
        {showLargeButtons && (
          <button
            onClick={() => increment(5)}
            disabled={value >= max}
            className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded
                       bg-dark-card text-gold/70 hover:bg-dark hover:text-gold
                       disabled:text-white/20 disabled:hover:bg-dark-card transition-colors"
          >
            +5
          </button>
        )}
      </div>
    </div>
  );
}

interface KeysCoinsPickerProps {
  keys: number;
  coins: number;
  onKeysChange: (keys: number) => void;
  onCoinsChange: (coins: number) => void;
}

export function KeysCoinsPicker({
  keys,
  coins,
  onKeysChange,
  onCoinsChange,
}: KeysCoinsPickerProps) {
  return (
    <div className="flex justify-center gap-4 p-3 bg-dark-lighter border-b border-gold/20">
      <Picker label="Cles" value={keys} onChange={onKeysChange} />
      <Picker
        label="Pieces"
        value={coins}
        onChange={onCoinsChange}
        showLargeButtons
      />
    </div>
  );
}
