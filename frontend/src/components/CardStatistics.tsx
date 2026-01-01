import { useState, useEffect } from 'react';
import { getCardImageUrl, getCards } from '../services/api';
import { useLongPress } from '../hooks/useLongPress';
import { CardPreview } from './CardPreview';
import type { Statistics, CardStatistic, PlayerCardStatistic } from '../types';

interface CardStatisticsProps {
  statistics: Statistics | null;
  loading?: boolean;
}

// Long press card wrapper
function LongPressCard({
  cardId,
  cardName,
  className,
  children,
  onPreviewChange,
}: {
  cardId: string;
  cardName?: string;
  className?: string;
  children: React.ReactNode;
  onPreviewChange: (preview: { cardId: string; cardName?: string } | null) => void;
}) {
  const longPressHandlers = useLongPress({
    onLongPress: () => onPreviewChange({ cardId, cardName }),
    onRelease: () => onPreviewChange(null),
  });

  return (
    <div className={className} {...longPressHandlers}>
      {children}
    </div>
  );
}

// Featured card component with runner-ups
function FeaturedCard({
  cards,
  title,
  subtitle,
  accent,
  showWinRate = false,
  cardNames,
  onPreviewChange,
}: {
  cards: CardStatistic[];
  title: string;
  subtitle: string;
  accent: 'gold' | 'red';
  showWinRate?: boolean;
  cardNames: Record<string, string>;
  onPreviewChange: (preview: { cardId: string; cardName?: string } | null) => void;
}) {
  if (cards.length === 0) return null;

  const mainCard = cards[0];
  const runnerUps = cards.slice(1, 3);

  const accentColor = accent === 'gold' ? 'border-gold/50 bg-gold/10' : 'border-red-500/50 bg-red-500/10';
  const textColor = accent === 'gold' ? 'text-gold' : 'text-red-400';

  return (
    <div className={`rounded-xl border p-3 ${accentColor}`}>
      <div className="text-center mb-2">
        <h3 className={`font-bold ${textColor}`}>{title}</h3>
        <p className="text-white/40 text-xs">{subtitle}</p>
      </div>
      {/* Main card */}
      <div className="flex justify-center">
        <LongPressCard
          cardId={mainCard.card_id}
          cardName={cardNames[mainCard.card_id]}
          className="w-16 rounded-lg overflow-hidden border border-white/20 cursor-pointer select-none"
          onPreviewChange={onPreviewChange}
        >
          <img
            src={getCardImageUrl(mainCard.card_id)}
            alt={cardNames[mainCard.card_id] || `Carte ${mainCard.card_id}`}
            className="w-full aspect-[630/880] object-cover pointer-events-none"
          />
        </LongPressCard>
      </div>
      <div className="text-center mt-2">
        <div className={`text-lg font-bold ${textColor}`}>
          {showWinRate ? `${mainCard.win_rate.toFixed(0)}%` : `${mainCard.play_count}x`}
        </div>
        <div className="text-white/40 text-xs">
          {showWinRate ? `${mainCard.play_count} parties` : `${mainCard.win_rate.toFixed(0)}% vic.`}
        </div>
      </div>
      {/* Runner-ups */}
      {runnerUps.length > 0 && (
        <div className="flex justify-center gap-2 mt-3 pt-3 border-t border-white/10">
          {runnerUps.map((card) => (
            <div key={card.card_id} className="flex flex-col">
              <LongPressCard
                cardId={card.card_id}
                cardName={cardNames[card.card_id]}
                className="w-10 rounded-lg overflow-hidden border border-white/10 cursor-pointer select-none"
                onPreviewChange={onPreviewChange}
              >
                <img
                  src={getCardImageUrl(card.card_id)}
                  alt={cardNames[card.card_id] || `Carte ${card.card_id}`}
                  className="w-full aspect-[630/880] object-cover pointer-events-none"
                />
              </LongPressCard>
              <div className="text-center py-0.5 text-xs text-white/40">
                {showWinRate ? `${card.win_rate.toFixed(0)}%` : `${card.play_count}x`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Player favorites - one card per player in a row
function PlayerFavorites({
  favorites,
  cardNames,
  onPreviewChange,
}: {
  favorites: PlayerCardStatistic[];
  cardNames: Record<string, string>;
  onPreviewChange: (preview: { cardId: string; cardName?: string } | null) => void;
}) {
  if (favorites.length === 0) return null;

  return (
    <div className="bg-dark-lighter rounded-xl border border-white/10 p-3">
      <h3 className="text-white/60 text-sm mb-3 text-center">Carte préférée par joueur</h3>
      <div className="flex flex-wrap justify-center gap-3">
        {favorites.map((playerFav) => {
          const topCard = playerFav.favorite_cards[0];
          if (!topCard) return null;

          return (
            <div key={playerFav.player_id} className="flex flex-col items-center">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs mb-1"
                style={{ backgroundColor: playerFav.player_color }}
                title={playerFav.player_name}
              >
                {playerFav.player_name.charAt(0).toUpperCase()}
              </div>
              <LongPressCard
                cardId={topCard.card_id}
                cardName={cardNames[topCard.card_id]}
                className="w-12 rounded-lg overflow-hidden border border-white/20 cursor-pointer select-none"
                onPreviewChange={onPreviewChange}
              >
                <img
                  src={getCardImageUrl(topCard.card_id)}
                  alt={cardNames[topCard.card_id] || `Carte ${topCard.card_id}`}
                  className="w-full aspect-[630/880] object-cover pointer-events-none"
                />
              </LongPressCard>
              <div className="text-white/40 text-xs mt-1">{topCard.play_count}x</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Card statistics table
function CardStatsTable({ cards, cardNames }: { cards: CardStatistic[]; cardNames: Record<string, string> }) {
  const [sortKey, setSortKey] = useState<'play_count' | 'win_rate' | 'avg_score_impact'>('play_count');
  const [sortAsc, setSortAsc] = useState(false);

  if (cards.length === 0) return null;

  const sortedCards = [...cards].sort((a, b) => {
    const multiplier = sortAsc ? 1 : -1;
    return (a[sortKey] - b[sortKey]) * multiplier;
  });

  const handleSort = (key: typeof sortKey) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ column }: { column: typeof sortKey }) => {
    if (column !== sortKey) return null;
    return <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-dark-lighter rounded-xl border border-white/10 overflow-hidden">
      <h3 className="text-white/60 text-sm p-3 text-center border-b border-white/10">
        Tableau des cartes
      </h3>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-dark-lighter">
            <tr className="text-white/40 text-xs">
              <th className="p-2 text-left">Carte</th>
              <th
                className="p-2 text-center cursor-pointer hover:text-white"
                onClick={() => handleSort('play_count')}
              >
                Joué<SortIcon column="play_count" />
              </th>
              <th
                className="p-2 text-center cursor-pointer hover:text-white"
                onClick={() => handleSort('win_rate')}
              >
                Vic.<SortIcon column="win_rate" />
              </th>
              <th
                className="p-2 text-center cursor-pointer hover:text-white"
                onClick={() => handleSort('avg_score_impact')}
              >
                Moy.<SortIcon column="avg_score_impact" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card) => (
              <tr key={card.card_id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={getCardImageUrl(card.card_id)}
                      alt={cardNames[card.card_id] || `Carte ${card.card_id}`}
                      className="w-8 h-11 rounded object-cover shrink-0"
                    />
                    <span className="text-white text-xs truncate">
                      {cardNames[card.card_id] || `#${card.card_id}`}
                    </span>
                  </div>
                </td>
                <td className="p-2 text-center text-white/80 text-sm font-mono">
                  {card.play_count}
                </td>
                <td className="p-2 text-center">
                  <span className={`text-sm font-mono ${
                    card.win_rate >= 50 ? 'text-gold' : 'text-red-400'
                  }`}>
                    {card.win_rate.toFixed(0)}%
                  </span>
                </td>
                <td className="p-2 text-center text-white/80 text-sm font-mono">
                  {card.avg_score_impact.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardStatistics({ statistics, loading }: CardStatisticsProps) {
  const [cardNames, setCardNames] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ cardId: string; cardName?: string } | null>(null);

  // Load card names
  useEffect(() => {
    getCards().then((cards) => {
      const names: Record<string, string> = {};
      cards.forEach((card) => {
        names[card.id] = card.name;
      });
      setCardNames(names);
    }).catch(() => {
      // Ignore errors
    });
  }, []);

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
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
        <div className="text-gold text-3xl font-bold text-center">
          {statistics.total_games}
        </div>
        <div className="text-white/60 text-sm text-center">
          parties jouées
        </div>
      </div>

      {/* Featured cards: 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        <FeaturedCard
          cards={statistics.win_correlated_cards.slice(0, 3)}
          title="L'élue"
          subtitle="Meilleur taux de victoire"
          accent="gold"
          showWinRate
          cardNames={cardNames}
          onPreviewChange={setPreview}
        />
        <FeaturedCard
          cards={statistics.loss_correlated_cards.slice(0, 3)}
          title="La maudite"
          subtitle="Pire taux de victoire"
          accent="red"
          showWinRate
          cardNames={cardNames}
          onPreviewChange={setPreview}
        />
        <FeaturedCard
          cards={statistics.most_played_cards.slice(0, 3)}
          title="La préférée"
          subtitle="La plus jouée"
          accent="gold"
          cardNames={cardNames}
          onPreviewChange={setPreview}
        />
        <FeaturedCard
          cards={statistics.least_played_cards.slice(0, 3)}
          title="La détestée"
          subtitle="La moins jouée"
          accent="red"
          cardNames={cardNames}
          onPreviewChange={setPreview}
        />
      </div>

      {/* Player favorites */}
      <PlayerFavorites
        favorites={statistics.player_favorites}
        cardNames={cardNames}
        onPreviewChange={setPreview}
      />

      {/* Card statistics table */}
      <CardStatsTable cards={statistics.most_played_cards} cardNames={cardNames} />

      {/* Card preview on long press */}
      <CardPreview
        cardId={preview?.cardId || ''}
        cardName={preview?.cardName}
        visible={preview !== null}
      />
    </div>
  );
}
