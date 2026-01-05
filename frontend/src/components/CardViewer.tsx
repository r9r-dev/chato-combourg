/**
 * CardViewer - Affichage plein ecran d'une carte
 *
 * Modal simple pour visualiser une carte en grand.
 */

import { useEffect } from 'react';
import { getCardImageUrl } from '../services/api';

interface CardViewerProps {
  cardId: string;
  cardName?: string;
  onClose: () => void;
}

export function CardViewer({ cardId, cardName, onClose }: CardViewerProps) {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={cardName || `Carte ${cardId}`}
    >
      {/* Bouton fermer */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center
          text-white/70 hover:text-white bg-white/10 hover:bg-white/20
          rounded-full transition-colors z-10"
        aria-label="Fermer"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Carte et nom */}
      <div
        className="flex flex-col items-center gap-3 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image de la carte */}
        <img
          src={getCardImageUrl(cardId)}
          alt={cardName || `Carte ${cardId}`}
          className="max-w-[90vw] max-h-[70vh] object-contain rounded-lg shadow-2xl"
          style={{ WebkitTouchCallout: 'none' }}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* Nom de la carte (en dessous) */}
        {cardName && (
          <p className="text-white text-lg font-medium text-center px-4">{cardName}</p>
        )}
      </div>

      {/* Indicateur de fermeture */}
      <p className="absolute bottom-4 text-white/40 text-sm">
        Cliquez n'importe où pour fermer
      </p>
    </div>
  );
}
