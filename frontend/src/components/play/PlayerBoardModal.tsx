/**
 * PlayerBoardModal - Modal pour afficher le plateau d'un joueur en grand
 */

import { CoinIcon, KeyIcon, CoinStack } from '../Icons';
import type { PlayPlayer } from '../../types/play';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PlayerBoardModalProps {
  player: PlayPlayer;
  isNeighbor: boolean;
  onClose: () => void;
}

export function PlayerBoardModal({ player, isNeighbor, onClose }: PlayerBoardModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-dark-card rounded-2xl p-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: player.color }}
            >
              {player.isAI ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 7H7v6h6V7z" />
                  <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                </svg>
              ) : (
                player.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="text-white font-medium">{player.name}</div>
              <div className="flex gap-3 text-xs items-center">
                <span className="flex items-center gap-1 text-gold">
                  <CoinIcon className="w-4 h-4" />
                  {player.gold}
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <KeyIcon className="w-4 h-4" />
                  {player.keys}
                </span>
                {isNeighbor && <span className="text-white/40">Voisin</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {player.board.map((card, i) => (
            <div
              key={i}
              className={`aspect-[5/7] rounded-lg relative ${card ? '' : 'bg-dark/50 border border-white/10'}`}
            >
              {card && (
                <>
                  <img
                    src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
                    alt=""
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {card.coinsOnCard > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none rounded-lg" style={{ paddingBottom: '25%' }}>
                      <CoinStack count={card.coinsOnCard} seed={i} className="scale-75" />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
