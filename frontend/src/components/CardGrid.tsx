import { getCardImageUrl } from '../services/api';
import type { GameCard, CardScoreDetail } from '../types';

interface CardGridProps {
  cards: GameCard[];
  scoreDetails: CardScoreDetail[] | null;
  onCardClick: (position: number) => void;
}

export function CardGrid({ cards, scoreDetails, onCardClick }: CardGridProps) {
  // Sort cards by position
  const sortedCards = [...cards].sort((a, b) => a.position - b.position);

  // Get score detail for a position
  const getScoreForPosition = (position: number): CardScoreDetail | undefined => {
    return scoreDetails?.find((d) => d.position === position);
  };

  return (
    <div className="grid grid-cols-3 gap-2 p-4 max-w-md mx-auto">
      {sortedCards.map((card) => {
        const score = getScoreForPosition(card.position);
        const isLowConfidence = card.confidence < 0.75;

        return (
          <button
            key={card.position}
            onClick={() => onCardClick(card.position)}
            className={`
              relative aspect-[2/3] rounded-lg overflow-hidden
              border-2 transition-all
              ${isLowConfidence ? 'border-red-500/50' : 'border-gold/30'}
              hover:border-gold hover:scale-105
              active:scale-95
            `}
          >
            {/* Card image */}
            {card.cardId ? (
              <img
                src={getCardImageUrl(card.cardId)}
                alt={`Carte ${card.cardId}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-dark-card flex items-center justify-center">
                <span className="text-white/30 text-2xl">?</span>
              </div>
            )}

            {/* Score badge */}
            {score && (
              <div
                className={`
                  absolute bottom-1 right-1 px-2 py-0.5 rounded-full text-xs font-bold
                  ${score.score > 0 ? 'bg-gold text-dark' : 'bg-dark-card text-white/50'}
                `}
              >
                {score.score}
              </div>
            )}

            {/* Low confidence indicator */}
            {isLowConfidence && (
              <div className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}
