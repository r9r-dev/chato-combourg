interface ScoreDisplayProps {
  totalScore: number | null;
  keysBonus: number;
  cardsScore: number;
}

export function ScoreDisplay({ totalScore, keysBonus, cardsScore }: ScoreDisplayProps) {
  if (totalScore === null) {
    return (
      <div className="p-4 text-center">
        <div className="text-white/50">Calcul du score...</div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-dark-lighter border-t border-gold/20">
      <div className="flex justify-center items-baseline gap-4">
        <div className="text-center">
          <div className="text-5xl font-bold text-gold">{totalScore}</div>
          <div className="text-white/50 text-sm">points</div>
        </div>
      </div>

      <div className="flex justify-center gap-6 mt-3 text-sm">
        <div className="text-white/70">
          Cartes: <span className="text-white font-semibold">{cardsScore}</span>
        </div>
        <div className="text-white/70">
          Clés: <span className="text-white font-semibold">+{keysBonus}</span>
        </div>
      </div>
    </div>
  );
}
