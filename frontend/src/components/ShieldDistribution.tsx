/**
 * ShieldDistribution - Répartition des blasons dans le jeu
 *
 * Affiche un tableau avec :
 * - Colonnes : une par couleur de blason
 * - Lignes : Château, Village, Σ (somme)
 */

import { useState, useEffect, useMemo } from 'react';
import { ShieldIcon } from './Icons';
import { LoadingSpinner } from './LoadingSpinner';
import type { CardAttributes, Shield } from '../types';

type ShieldColor = 'blue' | 'pink' | 'green' | 'red' | 'orange' | 'yellow';

const COLOR_ORDER: ShieldColor[] = ['blue', 'pink', 'green', 'red', 'orange', 'yellow'];

interface ShieldDistributionProps {
  onClose: () => void;
}

interface CategoryCounts {
  castle: Record<ShieldColor, number>;
  village: Record<ShieldColor, number>;
}

function createEmptyCounts(): Record<ShieldColor, number> {
  return { blue: 0, pink: 0, green: 0, red: 0, orange: 0, yellow: 0 };
}

export function ShieldDistribution({ onClose }: ShieldDistributionProps) {
  const [attributes, setAttributes] = useState<Record<string, CardAttributes> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les attributs des cartes
  useEffect(() => {
    let cancelled = false;

    async function loadAttributes() {
      try {
        const response = await fetch('/api/cards/attributes');
        if (!response.ok) throw new Error('Erreur lors du chargement');
        const data = await response.json();
        if (!cancelled) setAttributes(data);
      } catch (err) {
        if (!cancelled) setError('Impossible de charger les données');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAttributes();
    return () => { cancelled = true; };
  }, []);

  // Calculer la distribution des blasons par catégorie
  const distribution = useMemo<CategoryCounts>(() => {
    if (!attributes) {
      return { castle: createEmptyCounts(), village: createEmptyCounts() };
    }

    const counts: CategoryCounts = {
      castle: createEmptyCounts(),
      village: createEmptyCounts(),
    };

    // Parcourir toutes les cartes
    Object.values(attributes).forEach((card) => {
      const category = card.category as 'castle' | 'village' | null;
      if (!category) return;

      card.shields?.forEach((shield: Shield) => {
        const color = shield.color as ShieldColor;
        if (color in counts[category]) {
          counts[category][color] += shield.count;
        }
      });
    });

    return counts;
  }, [attributes]);

  // Calculer les totaux par couleur
  const totals = useMemo(() => {
    const result = createEmptyCounts();
    COLOR_ORDER.forEach((color) => {
      result[color] = distribution.castle[color] + distribution.village[color];
    });
    return result;
  }, [distribution]);

  // Total général par ligne
  const rowTotals = useMemo(() => ({
    castle: COLOR_ORDER.reduce((sum, color) => sum + distribution.castle[color], 0),
    village: COLOR_ORDER.reduce((sum, color) => sum + distribution.village[color], 0),
    total: COLOR_ORDER.reduce((sum, color) => sum + totals[color], 0),
  }), [distribution, totals]);

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-dark">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">Répartition des blasons</h2>
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

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" text="Chargement..." />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Description */}
            <p className="text-white/60 text-sm text-center">
              Distribution des blasons parmi les 92 cartes du jeu
            </p>

            {/* Tableau */}
            <div className="bg-dark-card rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-3 text-left text-white/60 text-sm font-medium">
                      {/* Cellule vide pour l'en-tête des lignes */}
                    </th>
                    {COLOR_ORDER.map((color) => (
                      <th key={color} className="p-2 text-center">
                        <div className="flex justify-center">
                          <ShieldIcon color={color} className="w-6 h-6" />
                        </div>
                      </th>
                    ))}
                    <th className="p-2 text-center text-white/60 text-sm font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ligne Château */}
                  <tr className="border-b border-white/5">
                    <td className="p-3 text-castle font-medium">Château</td>
                    {COLOR_ORDER.map((color) => (
                      <td key={color} className="p-2 text-center text-white tabular-nums">
                        {distribution.castle[color]}
                      </td>
                    ))}
                    <td className="p-2 text-center text-white/70 tabular-nums font-medium">
                      {rowTotals.castle}
                    </td>
                  </tr>
                  {/* Ligne Village */}
                  <tr className="border-b border-white/10">
                    <td className="p-3 text-village font-medium">Village</td>
                    {COLOR_ORDER.map((color) => (
                      <td key={color} className="p-2 text-center text-white tabular-nums">
                        {distribution.village[color]}
                      </td>
                    ))}
                    <td className="p-2 text-center text-white/70 tabular-nums font-medium">
                      {rowTotals.village}
                    </td>
                  </tr>
                  {/* Ligne Somme */}
                  <tr className="bg-white/5">
                    <td className="p-3 text-gold font-semibold">Σ</td>
                    {COLOR_ORDER.map((color) => (
                      <td key={color} className="p-2 text-center text-gold tabular-nums font-semibold">
                        {totals[color]}
                      </td>
                    ))}
                    <td className="p-2 text-center text-gold tabular-nums font-bold">
                      {rowTotals.total}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
