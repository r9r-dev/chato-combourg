import { useEffect, useState, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { CardGrid } from '../components/CardGrid';
import { CardSelector } from '../components/CardSelector';
import { ScoreTable } from '../components/ScoreTable';
import type { SelectedPlayer } from '../types';

export function Summary() {
  const { state, reset, saveGame } = useGame();

  const [viewingPlayer, setViewingPlayer] = useState<SelectedPlayer | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [mockPlayers, setMockPlayers] = useState<SelectedPlayer[] | null>(null);
  const hasSavedRef = useRef(false);

  // Check for mock data from developer mode
  useEffect(() => {
    const mockData = sessionStorage.getItem('devMockPlayers');
    if (mockData) {
      try {
        const players = JSON.parse(mockData) as SelectedPlayer[];
        setMockPlayers(players);
        sessionStorage.removeItem('devMockPlayers');
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Use mock players if available, otherwise use real game state
  const players = mockPlayers ?? state.selectedPlayers;
  const isDevMode = mockPlayers !== null;

  // Sort players by score (highest first)
  const sortedPlayers = [...players].sort(
    (a, b) => (b.score?.total_score ?? 0) - (a.score?.total_score ?? 0)
  );

  // Save game automatically on mount (only for real games)
  useEffect(() => {
    if (!isDevMode && !hasSavedRef.current && state.selectedPlayers.length >= 2) {
      hasSavedRef.current = true;
      saveGame();
    }
  }, [state.selectedPlayers, saveGame, isDevMode]);

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
            <span className="text-white/60">Clés</span>
            <span className="text-xl font-bold text-gold">{viewingPlayer.keys}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/60">Pièces</span>
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
              Cartes: {viewingPlayer.score?.cards_score ?? 0} + Clés: {viewingPlayer.score?.keys_bonus ?? 0}
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

  // Handle finish button
  const handleFinish = () => {
    if (isDevMode) {
      setMockPlayers(null);
      reset();
    } else {
      reset();
    }
  };

  // Main summary view with score table
  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
      {/* Header */}
      <div className={`p-4 border-b ${isDevMode ? 'bg-red-950/30 border-red-900/50' : 'bg-dark-lighter border-white/10'}`}>
        <h1 className={`text-2xl font-bold text-center ${isDevMode ? 'text-red-400' : 'text-gold'}`}>
          {isDevMode ? 'Test: Resultats' : 'Resultats'}
        </h1>
        <p className="text-white/50 text-sm text-center mt-1">
          Cliquez sur un joueur pour voir sa grille
        </p>
      </div>

      {/* Score Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className={`rounded-xl border overflow-hidden ${isDevMode ? 'bg-red-950/10 border-red-900/30' : 'bg-dark-lighter border-white/10'}`}>
          <ScoreTable
            players={sortedPlayers}
            onPlayerClick={handleViewPlayer}
          />
        </div>
      </div>

      {/* Footer */}
      <div className={`p-4 border-t ${isDevMode ? 'bg-red-950/30 border-red-900/50' : 'bg-dark-lighter border-white/10'}`}>
        <button
          onClick={handleFinish}
          className={`w-full py-4 px-8 font-semibold text-lg rounded-xl transition-colors ${
            isDevMode
              ? 'bg-red-900 text-white hover:bg-red-800 border border-red-700'
              : 'bg-gold text-dark hover:bg-gold-light active:bg-gold-dark'
          }`}
        >
          {isDevMode ? 'Retour' : 'Terminer'}
        </button>
      </div>
    </div>
  );
}
