import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

/**
 * Page de sélection de la date de la partie.
 * Affichée uniquement en mode legacy, après la sélection des joueurs.
 */
export function GameDate() {
  const { state, setPlayedAt, setStep, reset } = useGame();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayedAt(e.target.value);
  };

  const handleNext = () => {
    setStep('legacy-scores');
  };

  const handleQuit = () => {
    setShowExitConfirm(true);
  };

  const confirmQuit = () => {
    reset();
  };

  // Formater la date pour l'affichage en français
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-dvh p-6 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gold mb-2">Date de la partie</h1>
        <p className="text-white/60">Quand cette partie a-t-elle eu lieu ?</p>
      </div>

      {/* Date picker */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-xs space-y-6">
          {/* Native date input */}
          <input
            type="date"
            value={state.playedAt}
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-4 rounded-xl bg-dark-lighter text-white text-center text-xl
                       border-2 border-white/20 focus:border-gold focus:outline-none
                       [color-scheme:dark]"
          />

          {/* Formatted date display */}
          {state.playedAt && (
            <p className="text-center text-white/80 text-lg capitalize">
              {formatDisplayDate(state.playedAt)}
            </p>
          )}
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
          onClick={handleNext}
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
