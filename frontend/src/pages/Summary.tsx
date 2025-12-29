import { useEffect, useState, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { CardGrid } from '../components/CardGrid';
import { CardSelector } from '../components/CardSelector';
import { getCardImageUrl } from '../services/api';
import type { SelectedPlayer } from '../types';

export function Summary() {
  const { state, reset, saveGame } = useGame();

  const [viewingPlayer, setViewingPlayer] = useState<SelectedPlayer | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const hasSavedRef = useRef(false);

  // Sort players by score (highest first)
  const sortedPlayers = [...state.selectedPlayers].sort(
    (a, b) => (b.score?.total_score ?? 0) - (a.score?.total_score ?? 0)
  );

  // Save game automatically on mount
  useEffect(() => {
    if (!hasSavedRef.current && state.selectedPlayers.length >= 2) {
      hasSavedRef.current = true;
      saveGame();
    }
  }, [state.selectedPlayers, saveGame]);

  // Handle viewing a player's board
  const handleViewPlayer = useCallback((player: SelectedPlayer) => {
    setViewingPlayer(player);
  }, []);

  // Handle card click when viewing a player's board
  const handleCardClick = useCallback((position: number) => {
    setSelectedPosition(position);
  }, []);

  // Get selected card data for the viewing player
  const selectedCard = viewingPlayer && selectedPosition !== null
    ? viewingPlayer.cards.find((c) => c.position === selectedPosition)
    : null;

  // Get score detail for selected card
  const selectedScoreDetail = viewingPlayer && selectedPosition !== null && viewingPlayer.score
    ? viewingPlayer.score.details.find((d) => d.position === selectedPosition)
    : null;

  // If viewing a player's board
  if (viewingPlayer) {
    return (
      <div className="flex flex-col h-dvh bg-dark overflow-hidden">
        {/* Header with player info */}
        <div className="flex items-center justify-between p-4 bg-dark-lighter border-b border-white/10">
          <button
            onClick={() => setViewingPlayer(null)}
            className="text-white/60 hover:text-white"
          >
            Retour
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: viewingPlayer.color }}
            >
              {viewingPlayer.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-white font-medium">{viewingPlayer.name}</span>
          </div>
          <div className="w-16" />
        </div>

        {/* Keys and coins display */}
        <div className="flex justify-center gap-8 py-3 bg-dark-lighter border-b border-gold/20">
          <div className="flex items-center gap-2">
            <span className="text-white/60">Cles</span>
            <span className="text-xl font-bold text-gold">{viewingPlayer.keys}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/60">Pieces</span>
            <span className="text-xl font-bold text-gold">{viewingPlayer.coins}</span>
          </div>
        </div>

        {/* Card grid */}
        <div className="flex-1 min-h-0">
          <CardGrid
            cards={viewingPlayer.cards}
            scoreDetails={viewingPlayer.score?.details ?? null}
            onCardClick={handleCardClick}
          />
        </div>

        {/* Score display */}
        <div className="p-4 bg-dark-lighter border-t border-gold/20">
          <div className="text-center">
            <div className="text-3xl font-bold text-gold">
              {viewingPlayer.score?.total_score ?? 0} pts
            </div>
            <div className="text-white/40 text-sm mt-1">
              Cartes: {viewingPlayer.score?.cards_score ?? 0} + Cles: {viewingPlayer.score?.keys_bonus ?? 0}
            </div>
          </div>
        </div>

        {/* Card selector modal */}
        {selectedCard && (
          <CardSelector
            position={selectedCard.position}
            currentCardId={selectedCard.cardId}
            alternatives={selectedCard.alternatives}
            scoreDetail={selectedScoreDetail ?? null}
            onSelect={() => setSelectedPosition(null)} // Read-only
            onClose={() => setSelectedPosition(null)}
          />
        )}
      </div>
    );
  }

  // Main summary view with rankings
  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-dark-lighter border-b border-white/10">
        <h1 className="text-2xl font-bold text-gold text-center">Resultats</h1>
      </div>

      {/* Rankings */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const rank = index + 1;
            const isWinner = rank === 1;

            return (
              <button
                key={player.id}
                onClick={() => handleViewPlayer(player)}
                className={`w-full p-4 rounded-xl transition-all ${
                  isWinner
                    ? 'bg-gold/20 border-2 border-gold'
                    : 'bg-dark-lighter border border-white/10 hover:border-white/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank badge */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      isWinner
                        ? 'bg-gold text-dark'
                        : 'bg-dark-card text-white/60'
                    }`}
                  >
                    {rank}
                  </div>

                  {/* Player color and name */}
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    <span className={`font-medium ${isWinner ? 'text-gold' : 'text-white'}`}>
                      {player.name}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${isWinner ? 'text-gold' : 'text-white'}`}>
                      {player.score?.total_score ?? 0}
                    </div>
                    <div className="text-white/40 text-xs">pts</div>
                  </div>

                  {/* Mini cards preview */}
                  <div className="hidden sm:flex gap-0.5">
                    {player.cards
                      .sort((a, b) => a.position - b.position)
                      .slice(0, 3)
                      .map((card) => (
                        <img
                          key={card.position}
                          src={getCardImageUrl(card.cardId)}
                          alt=""
                          className="w-6 h-8 rounded-sm object-cover"
                        />
                      ))}
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-5 h-5 text-white/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-dark-lighter border-t border-white/10">
        <button
          onClick={reset}
          className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                     hover:bg-gold-light active:bg-gold-dark transition-colors"
        >
          Terminer
        </button>
      </div>
    </div>
  );
}
