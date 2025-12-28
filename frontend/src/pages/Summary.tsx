import { useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { KeysCoinsPicker } from '../components/KeysCoinsPicker';
import { CardGrid } from '../components/CardGrid';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { CardSelector } from '../components/CardSelector';

export function Summary() {
  const {
    state,
    setKeys,
    setCoins,
    updateCard,
    recalculateScore,
    reset,
  } = useGame();

  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);

  // Calculate score on mount and when cards/keys change
  useEffect(() => {
    if (state.cards.length === 9) {
      recalculateScore();
    }
  }, [state.cards, state.keys, recalculateScore]);

  // Handle card selection
  const handleCardClick = useCallback((position: number) => {
    setSelectedPosition(position);
  }, []);

  // Handle card change from selector
  const handleCardSelect = useCallback(
    (cardId: string) => {
      if (selectedPosition !== null) {
        updateCard(selectedPosition, cardId);
        setSelectedPosition(null);
      }
    },
    [selectedPosition, updateCard]
  );

  // Get selected card data
  const selectedCard = selectedPosition !== null
    ? state.cards.find((c) => c.position === selectedPosition)
    : null;

  // Get score detail for selected card
  const selectedScoreDetail = selectedPosition !== null && state.score
    ? state.score.details.find((d) => d.position === selectedPosition)
    : null;

  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
      {/* Keys and coins picker */}
      <KeysCoinsPicker
        keys={state.keys}
        coins={state.coins}
        onKeysChange={setKeys}
        onCoinsChange={setCoins}
      />

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto">
        <CardGrid
          cards={state.cards}
          scoreDetails={state.score?.details ?? null}
          onCardClick={handleCardClick}
        />
      </div>

      {/* Score display */}
      <ScoreDisplay
        totalScore={state.score?.total_score ?? null}
        keysBonus={state.score?.keys_bonus ?? 0}
        cardsScore={state.score?.cards_score ?? 0}
      />

      {/* Restart button */}
      <div className="p-4 bg-dark-lighter">
        <button
          onClick={reset}
          className="w-full py-3 px-6 bg-dark-card text-white/70 rounded-xl
                     hover:bg-dark hover:text-white transition-colors
                     border border-gold/20 hover:border-gold/50"
        >
          Recommencer
        </button>
      </div>

      {/* Card selector modal */}
      {selectedCard && (
        <CardSelector
          position={selectedCard.position}
          currentCardId={selectedCard.cardId}
          alternatives={selectedCard.alternatives}
          scoreDetail={selectedScoreDetail ?? null}
          onSelect={handleCardSelect}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </div>
  );
}
