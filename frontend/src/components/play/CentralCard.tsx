/**
 * CentralCard - Carte du plateau central (achetable)
 */

import { useState } from 'react';
import { BuyIcon, HiddenIcon, CoinIcon, KeyIcon } from '../Icons';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface CentralCardProps {
  cardId: string;
  canAfford: boolean;
  cost: number;
  isActive: boolean;
  onBuy: () => void;
  onBuyFlipped: () => void;
}

export function CentralCard({
  cardId,
  canAfford,
  cost,
  isActive,
  onBuy,
  onBuyFlipped,
}: CentralCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleClick = () => {
    if (!isActive) return;
    setShowMenu(true);
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={!isActive}
        className={`relative w-full aspect-[5/7] rounded-lg overflow-hidden border-2 transition-all ${
          isActive
            ? canAfford
              ? 'border-gold hover:border-gold-light cursor-pointer'
              : 'border-white/30 hover:border-white/50 cursor-pointer'
            : 'border-transparent opacity-60'
        }`}
      >
        <img
          src={`${API_BASE}/cards/thumbs/carte_${cardId}.webp`}
          alt={`Carte ${cardId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </button>

      {/* Menu d'achat */}
      {showMenu && (
        <div className="absolute inset-0 bg-dark/90 rounded-lg flex flex-col items-center justify-center gap-2 z-10">
          <button
            onClick={() => { onBuy(); setShowMenu(false); }}
            disabled={!canAfford}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${
              canAfford
                ? 'bg-gold text-dark'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            <BuyIcon className="w-4 h-4" />
            <span>-{cost}</span>
            <CoinIcon className="w-4 h-4 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
          </button>
          <button
            onClick={() => { onBuyFlipped(); setShowMenu(false); }}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20 flex items-center gap-1.5"
          >
            <HiddenIcon className="w-4 h-4" />
            <span className="text-gold">+6</span>
            <CoinIcon className="w-4 h-4" />
            <span className="text-blue-400">+2</span>
            <KeyIcon className="w-4 h-4 text-blue-400" />
          </button>
          <button
            onClick={() => setShowMenu(false)}
            className="px-3 py-1.5 text-white/40 text-sm"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
