import { useState } from 'react';
import type { PlayerWithFullStats } from '../types';

interface PlayerStatsListProps {
  players: PlayerWithFullStats[];
  loading?: boolean;
}

type SortKey = 'name' | 'games_count' | 'wins_count' | 'win_percentage';
type SortDirection = 'asc' | 'desc';

export function PlayerStatsList({ players, loading }: PlayerStatsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('win_percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Handle column click for sorting
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Sort players
  const sortedPlayers = [...players].sort((a, b) => {
    let comparison = 0;
    switch (sortKey) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'games_count':
        comparison = a.games_count - b.games_count;
        break;
      case 'wins_count':
        comparison = a.wins_count - b.wins_count;
        break;
      case 'win_percentage':
        comparison = a.win_percentage - b.win_percentage;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Sort indicator
  const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return (
      <span className="ml-1 text-gold">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/60">Chargement...</div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="text-white/40 text-lg mb-2">Aucun joueur</p>
        <p className="text-white/30 text-sm">
          Créez des joueurs pour commencer
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <table className="w-full table-fixed">
        {/* Header */}
        <thead>
          <tr className="border-b border-white/10">
            <th
              className="p-2 text-left text-white/60 text-sm font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('name')}
            >
              Joueur
              <SortIndicator columnKey="name" />
            </th>
            <th
              className="p-2 w-14 text-center text-white/60 text-xs font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('games_count')}
            >
              <span className="hidden sm:inline">Parties</span>
              <span className="sm:hidden">P</span>
              <SortIndicator columnKey="games_count" />
            </th>
            <th
              className="p-2 w-14 text-center text-white/60 text-xs font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('wins_count')}
            >
              <span className="hidden sm:inline">Victoires</span>
              <span className="sm:hidden">V</span>
              <SortIndicator columnKey="wins_count" />
            </th>
            <th
              className="p-2 w-20 text-center text-white/60 text-xs font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort('win_percentage')}
            >
              Taux
              <SortIndicator columnKey="win_percentage" />
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {sortedPlayers.map((player) => (
            <tr
              key={player.id}
              className="border-b border-white/5 hover:bg-white/5"
            >
              {/* Player name with avatar */}
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white font-medium text-sm truncate">
                    {player.name}
                  </span>
                </div>
              </td>

              {/* Games count */}
              <td className="p-2 text-center text-white/80 font-mono text-sm">
                {player.games_count}
              </td>

              {/* Wins count */}
              <td className="p-2 text-center text-gold font-mono font-medium text-sm">
                {player.wins_count}
              </td>

              {/* Win percentage */}
              <td className="p-2 text-center">
                <span
                  className="font-mono text-sm"
                  style={{
                    color:
                      player.win_percentage >= 50
                        ? '#d4af37' // gold
                        : player.win_percentage >= 25
                        ? '#f59e0b' // amber
                        : '#ef4444', // red
                  }}
                >
                  {player.win_percentage.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
