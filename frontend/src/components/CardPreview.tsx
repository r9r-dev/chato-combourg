import { createPortal } from 'react-dom';
import { getCardImageUrl } from '../services/api';

interface CardPreviewProps {
  cardId: string;
  cardName?: string;
  visible: boolean;
}

export function CardPreview({ cardId, cardName, visible }: CardPreviewProps) {
  if (!visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card container */}
      <div className="relative animate-scale-in">
        <div className="w-56 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl">
          <img
            src={getCardImageUrl(cardId)}
            alt={cardName || `Carte ${cardId}`}
            className="w-full aspect-[630/880] object-cover"
            style={{ WebkitTouchCallout: 'none' }}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        {cardName && (
          <div className="text-center mt-3 text-white font-medium text-lg drop-shadow-lg">
            {cardName}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
