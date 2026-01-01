import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import {
  getGames,
  getGame,
  getPlayersWithFullStats,
  getStatistics,
} from '../services/api';
import { TabBar } from '../components/TabBar';
import { GameDetailModal } from '../components/GameDetailModal';
import { PlayerStatsList } from '../components/PlayerStatsList';
import { CardStatistics } from '../components/CardStatistics';
import type {
  GameListItem,
  GameDetail,
  PlayerWithFullStats,
  Statistics,
} from '../types';

type TabType = 'historique' | 'joueurs' | 'statistiques';

const TABS = [
  { id: 'historique', label: 'Historique' },
  { id: 'joueurs', label: 'Joueurs' },
  { id: 'statistiques', label: 'Statistiques' },
];

// Interface for mock data from developer mode
interface MockGamesData {
  games: GameListItem[];
  gameDetails: Record<number, GameDetail>;
  players: PlayerWithFullStats[];
  statistics: Statistics;
}

export function Games() {
  const { setStep } = useGame();

  // Check for mock data from developer mode
  const [mockData, setMockData] = useState<MockGamesData | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const mockDataStr = sessionStorage.getItem('devMockGames');
    if (mockDataStr) {
      try {
        const data = JSON.parse(mockDataStr) as MockGamesData;
        setMockData(data);
        setIsDevMode(true);
        sessionStorage.removeItem('devMockGames');
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>('historique');

  // Historique state
  const [games, setGames] = useState<GameListItem[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
  const [filterPlayerId, setFilterPlayerId] = useState<number | undefined>(undefined);

  // Joueurs state
  const [players, setPlayers] = useState<PlayerWithFullStats[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);

  // Statistiques state
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Load games
  const loadGames = useCallback(async () => {
    // Use mock data if available
    if (mockData) {
      let filteredGames = mockData.games;
      if (filterPlayerId !== undefined) {
        // Filter mock games by player (check gameDetails)
        filteredGames = mockData.games.filter((g) => {
          const detail = mockData.gameDetails[g.id];
          return detail?.players.some((p) => p.player_id === filterPlayerId);
        });
      }
      setGames(filteredGames);
      setGamesLoading(false);
      return;
    }

    setGamesLoading(true);
    try {
      const data = await getGames(50, 0, filterPlayerId);
      setGames(data);
      setGamesError(null);
    } catch (err) {
      console.error('Failed to load games:', err);
      setGamesError('Impossible de charger les parties');
    } finally {
      setGamesLoading(false);
    }
  }, [filterPlayerId, mockData]);

  // Load players (for filter and Joueurs tab)
  const loadPlayers = useCallback(async () => {
    // Use mock data if available
    if (mockData) {
      setPlayers(mockData.players);
      setPlayersLoaded(true);
      setPlayersLoading(false);
      return;
    }

    if (playersLoaded) return;
    setPlayersLoading(true);
    try {
      const data = await getPlayersWithFullStats();
      setPlayers(data);
      setPlayersLoaded(true);
    } catch (err) {
      console.error('Failed to load players:', err);
    } finally {
      setPlayersLoading(false);
    }
  }, [playersLoaded, mockData]);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    // Use mock data if available
    if (mockData) {
      setStatistics(mockData.statistics);
      setStatsLoaded(true);
      setStatsLoading(false);
      return;
    }

    if (statsLoaded) return;
    setStatsLoading(true);
    try {
      const data = await getStatistics();
      setStatistics(data);
      setStatsLoaded(true);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [statsLoaded, mockData]);

  // Load games on mount and when filter changes
  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Load players on mount (needed for filter)
  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'statistiques') {
      loadStatistics();
    }
  }, [activeTab, loadStatistics]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Handle game click
  const handleGameClick = async (gameId: number) => {
    // Use mock data if available
    if (mockData && mockData.gameDetails[gameId]) {
      setSelectedGame(mockData.gameDetails[gameId]);
      return;
    }

    try {
      const detail = await getGame(gameId);
      setSelectedGame(detail);
    } catch (err) {
      console.error('Failed to load game:', err);
    }
  };

  // Handle filter change
  const handleFilterChange = (playerId: number | undefined) => {
    setFilterPlayerId(playerId);
  };

  // Render historique tab
  const renderHistorique = () => {
    if (gamesLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-white/60">Chargement...</div>
        </div>
      );
    }

    if (gamesError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-400">{gamesError}</div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Player filter */}
        <div className="p-4 border-b border-white/10">
          <select
            value={filterPlayerId ?? ''}
            onChange={(e) => handleFilterChange(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full bg-dark-lighter border border-white/20 rounded-lg px-3 py-2 text-white focus:border-gold focus:outline-none"
          >
            <option value="">Tous les joueurs</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>

        {/* Games list */}
        <div className="flex-1 overflow-auto p-4">
          {games.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg
                className="w-16 h-16 text-white/20 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="text-white/40 text-lg mb-2">Aucune partie</p>
              <p className="text-white/30 text-sm">
                {filterPlayerId
                  ? 'Aucune partie pour ce joueur'
                  : 'Vos parties sauvegardées apparaîtront ici'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameClick(game.id)}
                  className="w-full text-left p-4 rounded-xl bg-dark-lighter border border-white/10 hover:border-gold/50 transition-colors"
                >
                  {/* Date and Legacy badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white/40 text-sm">
                      {formatDate(game.played_at)}
                    </span>
                    {game.is_legacy && (
                      <span className="px-2 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded">
                        Legacy
                      </span>
                    )}
                  </div>

                  {/* Players and winner */}
                  <div className="flex items-center justify-between">
                    {/* All player names on the left */}
                    <div className="text-white text-sm">
                      {game.players.map(p => p.player_name).join(', ')}
                    </div>

                    {/* Winner on the right */}
                    {game.winner_name && (
                      <div className="flex items-center gap-2">
                        <span className="text-gold font-medium">
                          {game.winner_name}
                        </span>
                        <span className="px-2 py-1 rounded bg-gold/20 text-gold text-sm font-bold">
                          {game.winner_score} pts
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {game.notes && (
                    <div className="text-white/40 text-sm mt-2 italic">
                      {game.notes}
                    </div>
                  )}

                  {/* Click hint */}
                  <div className="flex items-center justify-end mt-2">
                    <svg
                      className="w-5 h-5 text-white/30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render joueurs tab
  const renderJoueurs = () => {
    return (
      <div className="h-full overflow-auto">
        <PlayerStatsList players={players} loading={playersLoading} />
      </div>
    );
  };

  // Render statistiques tab
  const renderStatistiques = () => {
    return (
      <div className="h-full overflow-auto">
        <CardStatistics statistics={statistics} loading={statsLoading} />
      </div>
    );
  };

  // Handle close in dev mode
  const handleClose = () => {
    if (isDevMode) {
      setMockData(null);
      setIsDevMode(false);
    }
    setStep('landing');
  };

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className={`flex items-center justify-between p-4 border-b ${
        isDevMode ? 'bg-red-950/30 border-red-900/50' : 'border-white/10'
      }`}>
        <button
          onClick={handleClose}
          className="text-white/60 hover:text-white"
        >
          Retour
        </button>
        <h1 className={`text-lg font-semibold ${isDevMode ? 'text-red-400' : 'text-white'}`}>
          {isDevMode ? 'Test: Mes parties' : 'Mes parties'}
        </h1>
        <div className="w-16" />
      </header>

      {/* Tabs */}
      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabType)}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'historique' && renderHistorique()}
        {activeTab === 'joueurs' && renderJoueurs()}
        {activeTab === 'statistiques' && renderStatistiques()}
      </div>

      {/* Game detail modal */}
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}
