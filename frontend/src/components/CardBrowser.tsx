/**
 * CardBrowser - Navigateur de cartes
 *
 * Composant réutilisable pour :
 * - Rechercher une carte (toutes les cartes)
 * - Voir la défausse (cartes défaussées avec filtre village/château)
 */

import { useState, useEffect, useMemo } from 'react';
import { getCards, getCardImageUrl } from '../services/api';
import { LoadingSpinner } from './LoadingSpinner';
import { CardViewer } from './CardViewer';
import type { Card } from '../types';

type CategoryFilter = 'all' | 'castle' | 'village';

/**
 * Normalise une chaîne pour la recherche : minuscules et sans accents
 * "Dévot" -> "devot", "CHÂTEAU" -> "chateau"
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface CardBrowserProps {
  mode: 'search' | 'discard';
  discardedCards?: {
    castle: string[];
    village: string[];
  };
  onClose: () => void;
}

export function CardBrowser({ mode, discardedCards, onClose }: CardBrowserProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedCard, setSelectedCard] = useState<{ id: string; name: string } | null>(null);

  // Charger les cartes
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const cardsData = await getCards();
        if (!cancelled) setCards(cardsData);
      } catch (error) {
        console.error('Erreur lors du chargement des cartes:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  // Filtrer les cartes
  const filteredCards = useMemo(() => {
    let result = cards;

    // Mode defausse : ne garder que les cartes defaussees
    if (mode === 'discard' && discardedCards) {
      const allDiscarded = [
        ...discardedCards.castle,
        ...discardedCards.village,
      ];
      result = result.filter((card) => allDiscarded.includes(card.id));
    }

    // Filtre par categorie (seulement en mode defausse)
    if (mode === 'discard' && categoryFilter !== 'all' && discardedCards) {
      const categoryCards =
        categoryFilter === 'castle'
          ? discardedCards.castle
          : discardedCards.village;
      result = result.filter((card) => categoryCards.includes(card.id));
    }

    // Filtre par recherche (insensible aux accents)
    if (searchQuery) {
      const normalizedQuery = normalizeForSearch(searchQuery);
      result = result.filter(
        (card) =>
          normalizeForSearch(card.name).includes(normalizedQuery) ||
          card.id.includes(searchQuery)
      );
    }

    return result;
  }, [cards, mode, discardedCards, categoryFilter, searchQuery]);

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedCard) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedCard]);

  const title = mode === 'search' ? 'Rechercher une carte' : 'Défausse';
  const emptyMessage =
    mode === 'search'
      ? 'Aucune carte trouvée'
      : categoryFilter === 'all'
        ? 'Aucune carte défaussée'
        : `Aucune carte ${categoryFilter === 'castle' ? 'château' : 'village'} défaussée`;

  // Compter les cartes par categorie
  const discardCounts = useMemo(() => {
    if (!discardedCards) return { castle: 0, village: 0 };
    return {
      castle: discardedCards.castle.length,
      village: discardedCards.village.length,
    };
  }, [discardedCards]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-dark">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white
              hover:bg-white/10 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Barre de recherche */}
        <div className="p-4 border-b border-white/10 space-y-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou numéro..."
            className="w-full px-4 py-3 bg-dark-card text-white rounded-xl
              border border-white/20 focus:border-gold focus:outline-none
              placeholder:text-white/30"
            autoFocus
          />

          {/* Filtres catégorie (seulement en mode défausse) */}
          {mode === 'discard' && (
            <div className="flex gap-2">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                  ${categoryFilter === 'all'
                    ? 'bg-gold text-dark'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
              >
                Tout ({discardCounts.castle + discardCounts.village})
              </button>
              <button
                onClick={() => setCategoryFilter('castle')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                  ${categoryFilter === 'castle'
                    ? 'bg-castle text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
              >
                Château ({discardCounts.castle})
              </button>
              <button
                onClick={() => setCategoryFilter('village')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                  ${categoryFilter === 'village'
                    ? 'bg-village text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
              >
                Village ({discardCounts.village})
              </button>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Chargement des cartes..." />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-white/50">{emptyMessage}</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {filteredCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard({ id: card.id, name: card.name })}
                  className="relative aspect-[2/3] rounded-lg overflow-hidden
                    border-2 border-transparent hover:border-gold transition-all hover:scale-105"
                >
                  <img
                    src={getCardImageUrl(card.id)}
                    alt={card.name}
                    className="w-full h-full object-cover"
                    style={{ WebkitTouchCallout: 'none' }}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            {filteredCards.length} carte{filteredCards.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Modal de visualisation */}
      {selectedCard && (
        <CardViewer
          cardId={selectedCard.id}
          cardName={selectedCard.name}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  );
}
