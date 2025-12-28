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
    <div className="py-2 px-4 bg-dark-lighter border-t border-gold/20">
      <div className="flex justify-center items-center gap-4">
        <div className="text-4xl font-bold text-gold">{totalScore}</div>
        <div className="flex flex-col text-sm text-white/70">
          <span>Cartes: <span className="text-white font-semibold">{cardsScore}</span></span>
          <span>Cles: <span className="text-white font-semibold">+{keysBonus}</span></span>
        </div>
      </div>
    </div>
  );
}
