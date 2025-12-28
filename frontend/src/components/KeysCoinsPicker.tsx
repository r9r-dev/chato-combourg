interface PickerProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

function Picker({ label, value, onChange, min = 0, max = 99 }: PickerProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/70 text-sm w-16">{label}</span>
      <div className="flex items-center bg-dark-card rounded-lg overflow-hidden">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-10 h-10 flex items-center justify-center text-xl font-bold
                     text-gold hover:bg-dark disabled:text-white/30 disabled:hover:bg-transparent
                     transition-colors"
        >
          -
        </button>
        <span className="w-10 text-center text-lg font-semibold text-white">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-10 h-10 flex items-center justify-center text-xl font-bold
                     text-gold hover:bg-dark disabled:text-white/30 disabled:hover:bg-transparent
                     transition-colors"
        >
          +
        </button>
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
    <div className="flex justify-center gap-6 p-4 bg-dark-lighter border-b border-gold/20">
      <Picker label="Clés" value={keys} onChange={onKeysChange} />
      <Picker label="Pièces" value={coins} onChange={onCoinsChange} />
    </div>
  );
}
