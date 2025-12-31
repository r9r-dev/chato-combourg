import { useGame } from '../context/GameContext';
import type { SelectedPlayer, GameCard, CalculateResponse, CardScoreDetail } from '../types';

// Generate mock data for testing the score table
function generateMockPlayers(): SelectedPlayer[] {
  // Based on the original score sheet photo:
  // Players: Laure, Ronan, Mabel, Bruno, Nico
  // Scores per position and keys bonus

  const playerData = [
    {
      name: 'Laure',
      color: '#e74c3c',
      scores: [4, 9, 14, 6, 6, 14, 8, 8, 0],
      keysBonus: 14,
    },
    {
      name: 'Ronan',
      color: '#3498db',
      scores: [4, 10, 8, 5, 16, 6, 12, 14, 0],
      keysBonus: 2,
    },
    {
      name: 'Mabel',
      color: '#9b59b6',
      scores: [10, 17, 9, 3, 8, 12, 10, 7, 8],
      keysBonus: 17,
    },
    {
      name: 'Bruno',
      color: '#2ecc71',
      scores: [6, 10, 8, 6, 0, 10, 4, 6, 8],
      keysBonus: 3,
    },
    {
      name: 'Nico',
      color: '#f39c12',
      scores: [0, 10, 6, 9, 8, 5, 9, 10, 6],
      keysBonus: 3,
    },
  ];

  return playerData.map((data, playerIndex) => {
    // Create mock cards (just need position and cardId for display)
    const cards: GameCard[] = Array.from({ length: 9 }).map((_, position) => ({
      position,
      cardId: String(position + 1 + playerIndex * 9).padStart(3, '0'), // Fake card IDs
      confidence: 1.0,
      alternatives: [],
    }));

    // Create score details
    const details: CardScoreDetail[] = data.scores.map((score, position) => ({
      position,
      card_id: cards[position].cardId,
      score,
      explanation: `Score de la carte en position ${position + 1}`,
    }));

    const cardsScore = data.scores.reduce((sum, s) => sum + s, 0);
    const totalScore = cardsScore + data.keysBonus;

    const score: CalculateResponse = {
      total_score: totalScore,
      keys_bonus: data.keysBonus,
      cards_score: cardsScore,
      details,
    };

    return {
      id: playerIndex + 1,
      name: data.name,
      color: data.color,
      keys: data.keysBonus,
      coins: 0,
      cards,
      score,
      captureId: undefined,
      originalCards: undefined,
    };
  });
}

export function Developer() {
  const { setStep, state } = useGame();

  const handleTestScoreTable = () => {
    // Inject mock players into game state and go to summary
    const mockPlayers = generateMockPlayers();

    // We need to manually set the state - use a workaround via window
    // Store mock data in sessionStorage for Summary to pick up
    sessionStorage.setItem('devMockPlayers', JSON.stringify(mockPlayers));
    setStep('summary');
  };

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-red-900/50 bg-red-950/30">
        <button
          onClick={() => setStep('landing')}
          className="text-white/60 hover:text-white"
        >
          Retour
        </button>
        <h1 className="text-lg font-semibold text-red-400">Développeur</h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {/* Section: UI Testing */}
          <div className="bg-dark-lighter rounded-xl p-4 border border-red-900/30">
            <h2 className="text-white font-semibold mb-4">Tests UI</h2>

            <button
              onClick={handleTestScoreTable}
              className="w-full py-3 px-4 bg-red-900/50 text-white rounded-lg
                         hover:bg-red-800/50 transition-colors border border-red-700/50
                         text-left"
            >
              <div className="font-medium">Tableau des scores</div>
              <div className="text-sm text-white/50 mt-1">
                Affiche le Summary avec 5 joueurs fictifs
              </div>
            </button>
          </div>

          {/* Debug info */}
          <div className="bg-dark-lighter rounded-xl p-4 border border-white/10">
            <h2 className="text-white/60 font-semibold mb-2 text-sm">Debug Info</h2>
            <div className="text-white/40 text-xs font-mono space-y-1">
              <div>Step: {state.step}</div>
              <div>Players: {state.selectedPlayers.length}</div>
              <div>Current index: {state.currentPlayerIndex}</div>
              <div>Cards: {state.cards.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
