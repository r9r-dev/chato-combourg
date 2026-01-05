/**
 * GameRules - Règles du jeu
 *
 * Placeholder pour les règles du jeu en mode Play.
 * Le contenu sera ajouté ultérieurement.
 */

import { useEffect } from 'react';
import { RulesIcon } from './Icons';

interface GameRulesProps {
  onClose: () => void;
}

export function GameRules({ onClose }: GameRulesProps) {
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
        <h2 className="text-lg font-semibold text-white">Règles du jeu</h2>
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

      {/* Contenu placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <RulesIcon className="w-16 h-16 text-white/20 mb-4" />
        <h3 className="text-xl font-semibold text-white/80 mb-2">Bientôt disponible</h3>
        <p className="text-white/50 text-center max-w-sm">
          Les règles du jeu seront ajoutées dans une prochaine mise à jour.
        </p>
      </div>
    </div>
  );
}
