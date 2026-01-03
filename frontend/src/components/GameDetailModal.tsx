import { useState, useEffect } from 'react';
import { MiniGrid } from './MiniGrid';
import { getCardImageUrl, calculateScore } from '../services/api';
import type { GameDetail, GamePlayerData, CardScoreDetail } from '../types';

interface GameDetailModalProps {
  game: GameDetail;
  onClose: () => void;
}

export function GameDetailModal({ game, onClose }: GameDetailModalProps) {
  const [viewingPlayer, setViewingPlayer] = useState<GamePlayerData | null>(null);
  const [playerScores, setPlayerScores] = useState<Map<number, CardScoreDetail[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Sort players by score (rank 1 first)
  const sortedPlayers = [...game.players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // Load score details for all players
  useEffect(() => {
    async function loadScoreDetails() {
      const scores = new Map<number, CardScoreDetail[]>();

      for (const player of game.players) {
        // For legacy games, use card_scores directly
        if (player.is_legacy && player.card_scores) {
          const details: CardScoreDetail[] = player.card_scores.map((score, position) => ({
            position,
            card_id: '',
            score,
            explanation: 'Score saisi manuellement',
          }));
          scores.set(player.id, details);
          continue;
        }

        // Skip players without cards (manual games without card_scores)
        if (!player.cards || player.cards.length === 0) continue;

        try {
          const result = await calculateScore({
            cards: player.cards,
            keys: player.keys,
            total_coins: player.coins,
          });
          scores.set(player.id, result.details);
        } catch {
          // Ignore errors - just won't show score details
        }
      }

      setPlayerScores(scores);
      setLoading(false);
    }

    loadScoreDetails();
  }, [game.players]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // If viewing a player's board
  if (viewingPlayer) {
    const details = playerScores.get(viewingPlayer.id) ?? [];
    const hasCards = viewingPlayer.cards && viewingPlayer.cards.length > 0;
    const isLegacy = viewingPlayer.is_legacy;

    return (
      <div className="fixed inset-0 z-50 bg-dark flex flex-col">
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
              style={{ backgroundColor: viewingPlayer.player_color }}
            >
              {viewingPlayer.player_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-white font-medium">{viewingPlayer.player_name}</span>
            {isLegacy && (
              <span className="px-2 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded">
                Legacy
              </span>
            )}
          </div>
          <div className="w-16" />
        </div>

        {/* Keys display (no coins for legacy) */}
        <div className="flex justify-center gap-8 py-3 bg-dark-lighter border-b border-gold/20">
          <div className="flex items-center gap-2">
            <span className="text-white/60">Cles</span>
            <span className="text-xl font-bold text-gold">{viewingPlayer.keys}</span>
          </div>
          {!isLegacy && (
            <div className="flex items-center gap-2">
              <span className="text-white/60">Pieces</span>
              <span className="text-xl font-bold text-gold">{viewingPlayer.coins}</span>
            </div>
          )}
        </div>

        {/* Card grid or Legacy score grid */}
        {hasCards ? (
          <div className="flex-1 min-h-0 p-2 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-1.5 w-full max-w-sm" style={{ aspectRatio: '3/4.5' }}>
              {viewingPlayer.cards.map((cardId, index) => {
                const detail = details.find((d) => d.position === index);
                return (
                  <div
                    key={index}
                    className="relative rounded-lg overflow-hidden border-2 border-gold/30"
                  >
                    <img
                      src={getCardImageUrl(cardId)}
                      alt={`Carte ${cardId}`}
                      className="w-full h-full object-cover"
                    />
                    {detail && (
                      <div
                        className={`
                          absolute bottom-0.5 right-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold
                          ${detail.score > 0 ? 'bg-gold text-dark' : 'bg-dark-card text-white/50'}
                        `}
                      >
                        {detail.score}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : isLegacy && details.length > 0 ? (
          <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
            <div className="w-full max-w-xs">
              {/* Legacy score grid - shows scores without cards */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {details.map((detail, index) => (
                  <div
                    key={index}
                    className="aspect-square bg-dark-card rounded-xl flex flex-col items-center justify-center border border-gold/20"
                  >
                    <span className="text-white/40 text-xs mb-1">{index + 1}</span>
                    <span className="text-2xl font-bold text-gold tabular-nums">
                      {detail.score}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-dark-card rounded-xl p-4 flex items-center justify-between border border-gold/20">
                <span className="text-white/60">Total cartes</span>
                <span className="text-2xl font-bold text-gold tabular-nums">
                  {details.reduce((sum, d) => sum + d.score, 0)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40">Partie manuelle (sans cartes)</p>
          </div>
        )}

        {/* Score display */}
        <div className="p-4 bg-dark-lighter border-t border-gold/20">
          <div className="text-center">
            <div className="text-3xl font-bold text-gold">
              {viewingPlayer.score} pts
            </div>
            {isLegacy && (
              <div className="text-white/40 text-sm mt-1">
                Cartes: {details.reduce((sum, d) => sum + d.score, 0)} + Cles: {viewingPlayer.keys}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main view with score table
  return (
    <div className="fixed inset-0 z-50 bg-dark flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-dark-lighter border-b border-white/10">
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white"
        >
          Fermer
        </button>
        <h1 className="text-lg font-semibold text-white">Détail de la partie</h1>
        <div className="w-16" />
      </div>

      {/* Date */}
      <div className="p-4 text-center border-b border-white/10">
        <p className="text-white/60 text-sm">{formatDate(game.played_at)}</p>
        {game.notes && (
          <p className="text-white/40 text-sm mt-1 italic">{game.notes}</p>
        )}
      </div>

      {/* Score table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-xl bg-dark-lighter border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-white/40">Chargement...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                {/* Header with player names */}
                <thead>
                  <tr>
                    <th className="p-2 w-10" />
                    {sortedPlayers.map((player) => {
                      const isWinner = player.rank === 1;
                      return (
                        <th
                          key={player.id}
                          className="p-2 text-center min-w-[60px] cursor-pointer hover:bg-white/5"
                          onClick={() => setViewingPlayer(player)}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                isWinner ? 'ring-2 ring-gold' : ''
                              }`}
                              style={{ backgroundColor: player.player_color }}
                            >
                              {player.player_name.charAt(0).toUpperCase()}
                            </div>
                            <span
                              className={`text-xs font-medium truncate max-w-[80px] ${
                                isWinner ? 'text-gold' : 'text-white/80'
                              }`}
                            >
                              {player.player_name}
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
                        const details = playerScores.get(player.id);
                        const detail = details?.find((d) => d.position === position);
                        const score = detail?.score ?? '-';
                        return (
                          <td
                            key={player.id}
                            className="p-2 text-center font-mono text-white/90"
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
                    {sortedPlayers.map((player) => {
                      // Keys bonus: 1 point per key
                      const keysBonus = player.keys;
                      return (
                        <td
                          key={player.id}
                          className="p-2 text-center font-mono text-gold"
                        >
                          {keysBonus}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Total row */}
                  <tr className="border-t-2 border-gold bg-gold/20">
                    <td className="p-2 border-r border-white/10">
                      <div className="flex items-center justify-center text-gold font-bold text-lg">
                        &Sigma;
                      </div>
                    </td>
                    {sortedPlayers.map((player) => {
                      const isWinner = player.rank === 1;
                      return (
                        <td
                          key={player.id}
                          className={`p-2 text-center font-mono font-bold text-xl ${
                            isWinner ? 'text-gold' : 'text-white'
                          }`}
                        >
                          {player.score}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Hint */}
        <p className="text-white/40 text-sm text-center mt-4">
          Cliquez sur un joueur pour voir son plateau
        </p>
      </div>
    </div>
  );
}
