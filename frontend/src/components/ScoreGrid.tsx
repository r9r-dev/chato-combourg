import { useState } from 'react';
import { NumberPad } from './NumberPad';

interface ScoreGridProps {
  scores: number[];
  onChange: (scores: number[]) => void;
}

export function ScoreGrid({ scores, onChange }: ScoreGridProps) {
  const [editingPosition, setEditingPosition] = useState<number | null>(null);

  const handleScoreChange = (position: number, value: number) => {
    const newScores = [...scores];
    newScores[position] = value;
    onChange(newScores);
  };

  const total = scores.reduce((sum, s) => sum + s, 0);

  // Position labels for the 3x3 grid
  const positionLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  if (editingPosition !== null) {
    // Show NumberPad for editing
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <span className="text-white/60 text-sm">
            Score carte {positionLabels[editingPosition]}
          </span>
        </div>
        <NumberPad
          value={scores[editingPosition]}
          onChange={(value) => handleScoreChange(editingPosition, value)}
        />
        <button
          onClick={() => setEditingPosition(null)}
          className="py-3 px-6 bg-gold text-dark font-semibold rounded-xl
                     hover:bg-gold-light transition-colors"
        >
          Valider
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-2">
        {scores.map((score, position) => (
          <button
            key={position}
            onClick={() => setEditingPosition(position)}
            className="aspect-square bg-dark-card rounded-xl flex flex-col items-center justify-center
                       hover:bg-dark-lighter transition-colors border-2 border-transparent
                       hover:border-gold/30"
          >
            <span className="text-white/40 text-xs mb-1">
              {positionLabels[position]}
            </span>
            <span className="text-2xl font-bold text-gold tabular-nums">
              {score}
            </span>
          </button>
        ))}
      </div>

      {/* Total display */}
      <div className="bg-dark-card rounded-xl p-4 flex items-center justify-between">
        <span className="text-white/60">Total cartes</span>
        <span className="text-3xl font-bold text-gold tabular-nums">
          {total}
        </span>
      </div>
    </div>
  );
}
