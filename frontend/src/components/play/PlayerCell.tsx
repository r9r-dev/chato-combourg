/**
 * PlayerCell - Case du plateau joueur
 */

import { LockIcon } from '../Icons';
import type { PlacedCard } from '../../types/play';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PlayerCellProps {
  card: PlacedCard | null;
  isValid: boolean;
  isActive: boolean;
  hasKey: boolean;
  canUseKey: boolean;
  onClick: () => void;
  onKeyClick: () => void;
}

export function PlayerCell({
  card,
  isValid,
  isActive,
  hasKey,
  canUseKey,
  onClick,
  onKeyClick,
}: PlayerCellProps) {
  if (card) {
    return (
      <div className="relative aspect-[5/7] rounded-lg overflow-hidden border border-white/10">
        <img
          src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
          alt={`Carte ${card.cardId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Icone cadenas si la carte a une cle disponible */}
        {hasKey && (
          <button
            onClick={(e) => { e.stopPropagation(); onKeyClick(); }}
            disabled={!canUseKey}
            className={`absolute inset-0 flex items-center justify-center transition-all ${
              canUseKey
                ? 'bg-black/30 hover:bg-black/40 cursor-pointer'
                : 'bg-black/20 cursor-not-allowed'
            }`}
            title="Utiliser l'effet du cadenas"
          >
            <div className={`p-3 rounded-full ${
              canUseKey
                ? 'bg-blue-500 shadow-lg shadow-blue-500/50'
                : 'bg-blue-500/50'
            }`}>
              <LockIcon className="w-8 h-8 text-white" />
            </div>
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!isActive || !isValid}
      className={`aspect-[5/7] rounded-lg border-2 transition-all flex items-center justify-center ${
        isActive && isValid
          ? 'border-gold border-dashed bg-gold/10 hover:bg-gold/20 cursor-pointer'
          : 'border-white/10 bg-dark-lighter'
      }`}
    >
      {isActive && isValid && (
        <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
}
