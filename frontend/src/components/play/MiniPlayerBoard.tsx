/**
 * MiniPlayerBoard - Mini-grille d'un autre joueur
 */

import { CoinIcon, KeyIcon, CoinStack } from '../Icons';
import type { PlayPlayer } from '../../types/play';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface MiniPlayerBoardProps {
  player: PlayPlayer;
  isCurrentTurn: boolean;
  isNeighbor: boolean;
  onSelect: () => void;
}

export function MiniPlayerBoard({ player, isCurrentTurn, isNeighbor, onSelect }: MiniPlayerBoardProps) {
  return (
    <button
      onClick={onSelect}
      className={`p-2 rounded-xl text-left w-full ${isCurrentTurn ? 'bg-gold/20 border border-gold' : 'bg-dark-lighter'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: player.color }}
        >
          {player.isAI ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 7H7v6h6V7z" />
              <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
            </svg>
          ) : (
            player.name.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-white text-sm truncate">{player.name}</span>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {player.board.map((card, i) => (
          <div
            key={i}
            className={`aspect-[5/7] rounded relative ${card ? '' : 'bg-dark/50'}`}
          >
            {card && (
              <>
                <img
                  src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
                  alt=""
                  className="w-full h-full object-cover rounded"
                  loading="lazy"
                />
                {card.coinsOnCard > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none rounded" style={{ paddingBottom: '20%' }}>
                    <CoinStack count={card.coinsOnCard} seed={i} className="scale-[0.4]" />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center text-xs mt-1">
        <span className="text-white/40">{isNeighbor ? 'Voisin' : ''}</span>
        <div className="flex gap-2 items-center ml-auto mr-2">
          <span className="flex items-center gap-0.5 text-gold">
            <CoinIcon className="w-3 h-3" />
            {player.gold}
          </span>
          <span className="flex items-center gap-0.5 text-blue-400">
            <KeyIcon className="w-3 h-3" />
            {player.keys}
          </span>
        </div>
        <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </button>
  );
}
