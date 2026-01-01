import { useState } from 'react';
import { getCardImageUrl } from '../services/api';
import type { Statistics, CardStatistic, PlayerCardStatistic } from '../types';

interface CardStatisticsProps {
  statistics: Statistics | null;
  loading?: boolean;
}

interface CardStatRowProps {
  cards: CardStatistic[];
  title: string;
  subtitle: string;
  showWinRate?: boolean;
  showScore?: boolean;
}

function CardStatRow({ cards, title, subtitle, showWinRate, showScore }: CardStatRowProps) {
  if (cards.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-white font-medium mb-1">{title}</h3>
      <p className="text-white/40 text-sm mb-3">{subtitle}</p>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {cards.map((card) => (
          <div
            key={card.card_id}
            className="shrink-0 w-20 bg-dark-lighter rounded-lg overflow-hidden border border-white/10"
          >
            <img
              src={getCardImageUrl(card.card_id)}
              alt={`Carte ${card.card_id}`}
              className="w-full aspect-[630/880] object-cover"
            />
            <div className="p-1.5 text-center">
              <div className="text-white/60 text-xs">
                {card.play_count}x
              </div>
              {showWinRate && (
                <div
                  className={`text-xs font-medium ${
                    card.win_rate >= 50 ? 'text-gold' : 'text-red-400'
                  }`}
                >
                  {card.win_rate.toFixed(0)}% vic.
                </div>
              )}
              {showScore && (
                <div className="text-gold text-xs font-medium">
                  ~{card.avg_score_impact.toFixed(0)} pts
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlayerFavoritesProps {
  favorites: PlayerCardStatistic[];
}

function PlayerFavorites({ favorites }: PlayerFavoritesProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (favorites.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-white font-medium mb-1">Cartes préférées par joueur</h3>
      <p className="text-white/40 text-sm mb-3">Les 3 cartes les plus jouées par chaque joueur</p>
      <div className="space-y-2">
        {favorites.map((playerFav) => (
          <div
            key={playerFav.player_id}
            className="bg-dark-lighter rounded-lg border border-white/10 overflow-hidden"
          >
            {/* Player header */}
            <button
              onClick={() => setExpanded(expanded === playerFav.player_id ? null : playerFav.player_id)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: playerFav.player_color }}
                >
                  {playerFav.player_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white font-medium">{playerFav.player_name}</span>
              </div>
              <svg
                className={`w-5 h-5 text-white/40 transition-transform ${
                  expanded === playerFav.player_id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Favorite cards (expanded) */}
            {expanded === playerFav.player_id && (
              <div className="flex gap-2 p-3 pt-0 border-t border-white/5">
                {playerFav.favorite_cards.map((card, index) => (
                  <div
                    key={card.card_id}
                    className="relative w-16 rounded-lg overflow-hidden border border-white/20"
                  >
                    <img
                      src={getCardImageUrl(card.card_id)}
                      alt={`Carte ${card.card_id}`}
                      className="w-full aspect-[630/880] object-cover"
                    />
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-gold text-dark text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-xs text-center py-0.5">
                      {card.play_count}x
                    </div>
                  </div>
                ))}
                {playerFav.favorite_cards.length === 0 && (
                  <p className="text-white/40 text-sm">Aucune donnee</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardStatistics({ statistics, loading }: CardStatisticsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/60">Chargement...</div>
      </div>
    );
  }

  if (!statistics || statistics.total_games === 0) {
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="text-white/40 text-lg mb-2">Pas encore de statistiques</p>
        <p className="text-white/30 text-sm">
          Jouez quelques parties pour voir les statistiques
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Summary */}
      <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-6">
        <div className="text-gold text-3xl font-bold text-center">
          {statistics.total_games}
        </div>
        <div className="text-white/60 text-sm text-center">
          parties jouées
        </div>
      </div>

      {/* Most played cards */}
      <CardStatRow
        cards={statistics.most_played_cards}
        title="Cartes les plus jouées"
        subtitle="Les cartes qui reviennent le plus souvent"
        showScore
      />

      {/* Least played cards */}
      <CardStatRow
        cards={statistics.least_played_cards}
        title="Cartes les moins jouées"
        subtitle="Les cartes les plus rares dans vos parties"
        showScore
      />

      {/* Win-correlated cards */}
      <CardStatRow
        cards={statistics.win_correlated_cards}
        title="Cartes porte-bonheur"
        subtitle="Les cartes avec le meilleur taux de victoire"
        showWinRate
      />

      {/* Loss-correlated cards */}
      <CardStatRow
        cards={statistics.loss_correlated_cards}
        title="Cartes maudites"
        subtitle="Les cartes avec le plus faible taux de victoire"
        showWinRate
      />

      {/* Player favorites */}
      <PlayerFavorites favorites={statistics.player_favorites} />
    </div>
  );
}
