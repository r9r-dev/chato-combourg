import { MiniGrid } from './MiniGrid';
import type { SelectedPlayer } from '../types';

interface ScoreTableProps {
  players: SelectedPlayer[];
  onPlayerClick?: (player: SelectedPlayer) => void;
}

/**
 * Score table displaying scores in a grid format matching the official score sheet.
 * Shows 9 card positions + keys bonus + total for each player.
 */
export function ScoreTable({ players, onPlayerClick }: ScoreTableProps) {
  // Sort players by score (highest first) and assign ranks
  const sortedPlayers = [...players].sort(
    (a, b) => (b.score?.total_score ?? 0) - (a.score?.total_score ?? 0)
  );

  // Find winner score to highlight ties
  const winnerScore = sortedPlayers[0]?.score?.total_score ?? 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse">
        {/* Header with player names */}
        <thead>
          <tr>
            <th className="p-2 w-10" />
            {sortedPlayers.map((player) => {
              const isWinner = player.score?.total_score === winnerScore;
              return (
                <th
                  key={player.id}
                  className={`p-2 text-center min-w-[60px] ${
                    onPlayerClick ? 'cursor-pointer hover:bg-white/5' : ''
                  }`}
                  onClick={() => onPlayerClick?.(player)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        isWinner ? 'ring-2 ring-gold' : ''
                      }`}
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`text-xs font-medium truncate max-w-[80px] ${
                        isWinner ? 'text-gold' : 'text-white/80'
                      }`}
                    >
                      {player.name}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {/* 9 card position rows */}
          {Array.from({ length: 9 }).map((_, position) => (
            <tr
              key={position}
              className={position % 2 === 0 ? 'bg-white/5' : ''}
            >
              <td className="p-2 border-r border-white/10">
                <MiniGrid position={position} size={20} />
              </td>
              {sortedPlayers.map((player) => {
                const detail = player.score?.details.find(
                  (d) => d.position === position
                );
                const score = detail?.score ?? 0;
                return (
                  <td
                    key={player.id}
                    className={`p-2 text-center font-mono text-white/90 ${
                      onPlayerClick ? 'cursor-pointer hover:bg-white/5' : ''
                    }`}
                    onClick={() => onPlayerClick?.(player)}
                  >
                    {score}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Keys bonus row */}
          <tr className="border-t border-gold/30 bg-gold/10">
            <td className="p-2 border-r border-white/10">
              <div className="flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-gold"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                </svg>
              </div>
            </td>
            {sortedPlayers.map((player) => (
              <td
                key={player.id}
                className={`p-2 text-center font-mono text-gold ${
                  onPlayerClick ? 'cursor-pointer hover:bg-white/5' : ''
                }`}
                onClick={() => onPlayerClick?.(player)}
              >
                {player.score?.keys_bonus ?? 0}
              </td>
            ))}
          </tr>

          {/* Total row */}
          <tr className="border-t-2 border-gold bg-gold/20">
            <td className="p-2 border-r border-white/10">
              <div className="flex items-center justify-center text-gold font-bold text-lg">
                &Sigma;
              </div>
            </td>
            {sortedPlayers.map((player) => {
              const isWinner = player.score?.total_score === winnerScore;
              return (
                <td
                  key={player.id}
                  className={`p-2 text-center font-mono font-bold text-xl ${
                    isWinner ? 'text-gold' : 'text-white'
                  } ${onPlayerClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
                  onClick={() => onPlayerClick?.(player)}
                >
                  {player.score?.total_score ?? 0}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
