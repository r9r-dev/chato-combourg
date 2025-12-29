import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { getGames } from '../services/api';
import type { GameListItem } from '../types';

export function Games() {
  const { setStep } = useGame();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGames() {
      try {
        const data = await getGames();
        setGames(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load games:', err);
        setError('Impossible de charger les parties');
      } finally {
        setLoading(false);
      }
    }
    loadGames();
  }, []);

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

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={() => setStep('landing')}
          className="text-white/60 hover:text-white"
        >
          Retour
        </button>
        <h1 className="text-lg font-semibold text-white">Mes parties</h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white/60">Chargement...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400">{error}</div>
          </div>
        ) : games.length === 0 ? (
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
              Vos parties sauvegardées apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="p-4 rounded-xl bg-dark-lighter border border-white/10"
              >
                {/* Date */}
                <div className="text-white/40 text-sm mb-2">
                  {formatDate(game.played_at)}
                </div>

                {/* Players count and winner */}
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    {game.player_count} joueurs
                  </div>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
