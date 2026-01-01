import { useGame } from '../context/GameContext';
import type {
  SelectedPlayer,
  GameCard,
  CalculateResponse,
  CardScoreDetail,
  GameListItem,
  GameDetail,
  PlayerWithFullStats,
  Statistics,
  CardStatistic,
  PlayerCardStatistic,
} from '../types';

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

// Generate mock data for testing the Games page
function generateMockGamesData() {
  const playerNames = ['Laure', 'Ronan', 'Mabel', 'Bruno', 'Nico'];
  const playerColors = ['#e74c3c', '#3498db', '#9b59b6', '#2ecc71', '#f39c12'];

  // Generate players with stats
  const players: PlayerWithFullStats[] = playerNames.map((name, i) => ({
    id: i + 1,
    name,
    color: playerColors[i],
    games_count: 10 + Math.floor(Math.random() * 20),
    wins_count: 2 + Math.floor(Math.random() * 8),
    win_percentage: 0,
    last_played_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
  // Calculate win percentage
  players.forEach((p) => {
    p.win_percentage = p.games_count > 0 ? Math.round((p.wins_count / p.games_count) * 100 * 10) / 10 : 0;
  });

  // Generate games
  const games: GameListItem[] = [];
  const gameDetails: Record<number, GameDetail> = {};

  for (let i = 1; i <= 15; i++) {
    const numPlayers = 2 + Math.floor(Math.random() * 4); // 2-5 players
    const gamePlayers = [...players].sort(() => Math.random() - 0.5).slice(0, numPlayers);
    const playedAt = new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000);

    // Generate scores for each player
    const playerScores = gamePlayers.map((p, idx) => {
      const score = 50 + Math.floor(Math.random() * 80);
      // Generate random card IDs (001-092)
      const cards = Array.from({ length: 9 }, () =>
        String(1 + Math.floor(Math.random() * 92)).padStart(3, '0')
      );
      return {
        id: i * 10 + idx,
        player_id: p.id,
        player_name: p.name,
        player_color: p.color,
        position: idx + 1,
        keys: Math.floor(Math.random() * 4),
        coins: Math.floor(Math.random() * 10),
        cards,
        card_scores: null,
        score,
        rank: 0,
        is_legacy: false,
      };
    });

    // Assign ranks
    playerScores.sort((a, b) => b.score - a.score);
    playerScores.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    const winner = playerScores[0];

    games.push({
      id: i,
      played_at: playedAt.toISOString(),
      notes: i % 3 === 0 ? 'Partie du dimanche' : null,
      player_count: numPlayers,
      winner_name: winner.player_name,
      winner_score: winner.score,
      is_legacy: false,
    });

    gameDetails[i] = {
      id: i,
      played_at: playedAt.toISOString(),
      notes: i % 3 === 0 ? 'Partie du dimanche' : null,
      players: playerScores,
    };
  }

  // Generate statistics
  const cardStats: CardStatistic[] = [];
  for (let i = 1; i <= 20; i++) {
    cardStats.push({
      card_id: String(i).padStart(3, '0'),
      play_count: 5 + Math.floor(Math.random() * 30),
      avg_score_impact: 40 + Math.floor(Math.random() * 60),
      win_rate: 20 + Math.floor(Math.random() * 60),
    });
  }

  const playerFavorites: PlayerCardStatistic[] = players.map((p) => ({
    player_id: p.id,
    player_name: p.name,
    player_color: p.color,
    favorite_cards: [
      String(1 + Math.floor(Math.random() * 92)).padStart(3, '0'),
      String(1 + Math.floor(Math.random() * 92)).padStart(3, '0'),
      String(1 + Math.floor(Math.random() * 92)).padStart(3, '0'),
    ],
  }));

  const statistics: Statistics = {
    total_games: games.length,
    most_played_cards: [...cardStats].sort((a, b) => b.play_count - a.play_count).slice(0, 10),
    least_played_cards: [...cardStats].sort((a, b) => a.play_count - b.play_count).slice(0, 10),
    win_correlated_cards: [...cardStats].sort((a, b) => b.win_rate - a.win_rate).slice(0, 10),
    loss_correlated_cards: [...cardStats].sort((a, b) => a.win_rate - b.win_rate).slice(0, 10),
    player_favorites: playerFavorites,
  };

  return { games, gameDetails, players, statistics };
}

export function Developer() {
  const { setStep, state } = useGame();

  const handleTestGamesPage = () => {
    const mockData = generateMockGamesData();
    sessionStorage.setItem('devMockGames', JSON.stringify(mockData));
    setStep('games');
  };

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
                         text-left mb-3"
            >
              <div className="font-medium">Tableau des scores</div>
              <div className="text-sm text-white/50 mt-1">
                Affiche le Summary avec 5 joueurs fictifs
              </div>
            </button>

            <button
              onClick={handleTestGamesPage}
              className="w-full py-3 px-4 bg-red-900/50 text-white rounded-lg
                         hover:bg-red-800/50 transition-colors border border-red-700/50
                         text-left"
            >
              <div className="font-medium">Page Mes parties</div>
              <div className="text-sm text-white/50 mt-1">
                Affiche la page Games avec données fictives (historique, joueurs, stats)
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
