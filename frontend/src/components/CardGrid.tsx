import { getCardImageUrl } from '../services/api';
import { CoinStack } from './Icons';
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
    <div className="h-full p-2 flex items-center justify-center">
      <div className="grid grid-cols-3 gap-1.5 w-full max-w-sm" style={{ aspectRatio: '3/4.5' }}>
        {sortedCards.map((card) => {
          const score = getScoreForPosition(card.position);
          const isLowConfidence = card.confidence < 0.75;

          return (
            <button
              key={card.position}
              onClick={() => onCardClick(card.position)}
              className={`
                relative rounded-lg overflow-hidden
                border-2 transition-all
                ${isLowConfidence ? 'border-red-500/50' : 'border-gold/30'}
                hover:border-gold hover:scale-[1.02]
                active:scale-95
              `}
            >
              {/* Card image */}
              {card.cardId ? (
                <img
                  src={getCardImageUrl(card.cardId)}
                  alt={`Carte ${card.cardId}`}
                  className="w-full h-full object-cover"
                  style={{ WebkitTouchCallout: 'none' }}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                <div className="w-full h-full bg-dark-card flex items-center justify-center">
                  <span className="text-white/30 text-2xl">?</span>
                </div>
              )}

              {/* Coins on card */}
              {score && (score.coins ?? 0) > 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none"
                  style={{ paddingBottom: '25%' }}
                >
                  <CoinStack count={score.coins ?? 0} seed={card.position} className="scale-75" />
                </div>
              )}

              {/* Score badge */}
              {score && (
                <div
                  className={`
                    absolute bottom-0.5 right-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold
                    ${score.score > 0 ? 'bg-gold text-dark' : 'bg-dark-card text-white/50'}
                  `}
                >
                  {score.score}
                </div>
              )}

              {/* Low confidence indicator */}
              {isLowConfidence && (
                <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
