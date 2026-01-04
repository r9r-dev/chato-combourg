/**
 * PlayerCell - Case du plateau joueur
 */

import { LockIcon, CoinStack } from '../Icons';
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
  // Props pour selection directe (sans modale)
  isHighlighted?: boolean;   // Carte eligible (surbrillance)
  isSelected?: boolean;      // Carte selectionnee (multi-selection)
  onSelect?: () => void;     // Handler de selection
}

export function PlayerCell({
  card,
  isValid,
  isActive,
  hasKey,
  canUseKey,
  onClick,
  onKeyClick,
  isHighlighted = false,
  isSelected = false,
  onSelect,
}: PlayerCellProps) {
  // Mode selection: la carte est cliquable pour selection (pas pour placement)
  const isSelectionMode = isHighlighted && onSelect;

  if (card) {
    const hasCoins = card.coinsOnCard > 0;

    // Classes pour l'etat de surbrillance/selection
    const highlightClasses = isHighlighted
      ? isSelected
        ? 'ring-2 ring-gold ring-offset-2 ring-offset-dark'
        : 'ring-2 ring-gold/60 ring-offset-1 ring-offset-dark animate-pulse'
      : '';

    return (
      <div
        onClick={isSelectionMode ? onSelect : undefined}
        role={isSelectionMode ? 'button' : undefined}
        tabIndex={isSelectionMode ? 0 : undefined}
        onKeyDown={isSelectionMode ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(); } : undefined}
        className={`relative aspect-[5/7] rounded-lg overflow-hidden border transition-all ${
          isHighlighted
            ? 'border-gold cursor-pointer hover:border-gold-light'
            : 'border-white/10'
        } ${highlightClasses}`}
      >
        <img
          src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
          alt={`Carte ${card.cardId}`}
          className="w-full h-full object-cover"
          style={{ WebkitTouchCallout: 'none' }}
          loading="lazy"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* Icone cadenas si la carte a une cle disponible */}
        {hasKey && !isSelectionMode && (
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
        {/* Pile de pieces si la carte bourse contient des pieces */}
        {hasCoins && !hasKey && !isSelectionMode && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none" style={{ paddingBottom: '25%' }}>
            <CoinStack count={card.coinsOnCard} seed={card.position} />
          </div>
        )}
        {/* Indicateur de selection */}
        {isSelected && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-gold rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
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
