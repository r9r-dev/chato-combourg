import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { NumberPad } from './NumberPad';
import { ConfirmDialog } from './ConfirmDialog';
import { PlayerBadge } from './PlayerBadge';

interface NumericInputPageProps {
  /** Titre de la page */
  title: string;
  /** Question affichée sous le titre */
  question: string;
  /** Valeur actuelle */
  value: number;
  /** Callback de modification */
  onChange: (value: number) => void;
  /** Callback pour passer à l'étape suivante */
  onNext: () => void;
}

/**
 * Page générique pour la saisie d'une valeur numérique (clés, pièces, etc.).
 *
 * Affiche :
 * - Le joueur courant avec badge
 * - Un titre et une question
 * - Un pavé numérique
 * - Boutons Quitter / Suivant
 */
export function NumericInputPage({
  title,
  question,
  value,
  onChange,
  onNext,
}: NumericInputPageProps) {
  const { state, reset, getCurrentPlayer } = useGame();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const currentPlayer = getCurrentPlayer();
  const playerIndex = state.currentPlayerIndex + 1;
  const totalPlayers = state.selectedPlayers.length;

  const handleQuit = () => {
    setShowExitConfirm(true);
  };

  const confirmQuit = () => {
    reset();
  };

  return (
    <div className="flex flex-col h-dvh p-6 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-8">
        {currentPlayer && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <PlayerBadge player={currentPlayer}>
              {playerIndex}
            </PlayerBadge>
            <span className="text-white font-medium">{currentPlayer.name}</span>
            <span className="text-white/40 text-sm">({playerIndex}/{totalPlayers})</span>
          </div>
        )}
        <h1 className="text-3xl font-bold text-gold mb-2">{title}</h1>
        <p className="text-white/60">{question}</p>
      </div>

      {/* NumberPad - centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xs">
          <NumberPad value={value} onChange={onChange} />
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={handleQuit}
          className="flex-1 py-4 px-6 bg-dark-card text-white/70 font-semibold rounded-xl
                     hover:bg-dark-lighter hover:text-white transition-colors"
        >
          Quitter
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-4 px-6 bg-gold text-dark font-semibold rounded-xl
                     hover:bg-gold-light active:bg-gold-dark transition-colors
                     shadow-lg shadow-gold/20"
        >
          Suivant
        </button>
      </div>

      {/* Exit confirmation dialog */}
      {showExitConfirm && (
        <ConfirmDialog
          title="Quitter la partie ?"
          message="La partie en cours sera perdue."
          confirmLabel="Quitter"
          cancelLabel="Continuer"
          onConfirm={confirmQuit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
