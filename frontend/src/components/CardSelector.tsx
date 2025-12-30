import { useState, useEffect } from 'react';
import { getCardImageUrl, getCards } from '../services/api';
import type { CardMatch, Card, CardScoreDetail } from '../types';

interface CardSelectorProps {
  position: number;
  currentCardId: string;
  alternatives: CardMatch[];
  scoreDetail: CardScoreDetail | null;
  onSelect: (cardId: string) => void;
  onClose: () => void;
}

export function CardSelector({
  position,
  currentCardId,
  alternatives,
  scoreDetail,
  onSelect,
  onClose,
}: CardSelectorProps) {
  // Show search directly if no alternatives (empty position)
  const [showSearch, setShowSearch] = useState(alternatives.length === 0);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load all cards when search is opened
  useEffect(() => {
    if (showSearch && allCards.length === 0) {
      setIsLoading(true);
      getCards()
        .then(setAllCards)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [showSearch, allCards.length]);

  // Filter cards for search
  const filteredCards = allCards.filter(
    (card) =>
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.id.includes(searchQuery)
  );

  // Position labels
  const positionLabels = [
    'Haut-Gauche',
    'Haut-Centre',
    'Haut-Droite',
    'Milieu-Gauche',
    'Centre',
    'Milieu-Droite',
    'Bas-Gauche',
    'Bas-Centre',
    'Bas-Droite',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85dvh] bg-dark-lighter rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gold/20 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {positionLabels[position]}
            </h2>
            {scoreDetail && (
              <p className="text-sm text-gold">
                {scoreDetail.score} points
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white
                       hover:bg-dark-card rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Score explanation */}
        {scoreDetail && (
          <div className="p-4 bg-dark-card border-b border-gold/20">
            <p className="text-white/80 text-sm whitespace-pre-line">{scoreDetail.explanation}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!showSearch ? (
            <>
              {/* Suggestions */}
              <div className="mb-4">
                <p className="text-white/50 text-xs uppercase mb-2">Suggestions</p>
                <div className="grid grid-cols-3 gap-2">
                  {alternatives.slice(0, 6).map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => onSelect(alt.id)}
                      disabled={alt.id === currentCardId}
                      className={`
                        relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all
                        ${alt.id === currentCardId
                          ? 'border-gold opacity-50 cursor-not-allowed'
                          : 'border-transparent hover:border-gold hover:scale-105'
                        }
                      `}
                    >
                      <img
                        src={getCardImageUrl(alt.id)}
                        alt={`Carte ${alt.id}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Search button */}
              <button
                onClick={() => setShowSearch(true)}
                className="w-full py-3 px-4 bg-dark-card text-white/70 rounded-xl
                           hover:bg-dark hover:text-white transition-colors"
              >
                Chercher une autre carte
              </button>
            </>
          ) : (
            <div className="flex flex-col h-full -m-4">
              {/* Search input - sticky at top */}
              <div className="sticky top-0 z-10 p-4 bg-dark-lighter border-b border-gold/20">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher"
                  className="w-full px-4 py-3 bg-dark-card text-white rounded-xl
                             border border-gold/30 focus:border-gold focus:outline-none
                             placeholder:text-white/30"
                  autoFocus
                />
              </div>

              {/* Search results - scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <div className="text-center text-white/50 py-8">Chargement...</div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {filteredCards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => {
                          onSelect(card.id);
                          setShowSearch(false);
                        }}
                        className="relative aspect-[2/3] rounded-lg overflow-hidden border-2
                                   border-transparent hover:border-gold transition-all hover:scale-105"
                      >
                        <img
                          src={getCardImageUrl(card.id)}
                          alt={card.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Back button - sticky at bottom (only if there are alternatives) */}
              {alternatives.length > 0 && (
                <div className="sticky bottom-0 p-4 bg-dark-lighter border-t border-gold/20">
                  <button
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="w-full py-3 px-4 bg-dark-card text-white/70 rounded-xl
                               hover:bg-dark hover:text-white transition-colors"
                  >
                    Retour aux suggestions
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
