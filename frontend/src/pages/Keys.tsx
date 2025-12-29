import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { NumberPad } from '../components/NumberPad';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function Keys() {
  const { state, setKeys, setStep, reset } = useGame();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleNext = () => {
    setStep('coins');
  };

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
        <h1 className="text-3xl font-bold text-gold mb-2">Clés</h1>
        <p className="text-white/60">Combien de clés avez-vous ?</p>
      </div>

      {/* NumberPad - centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xs">
          <NumberPad value={state.keys} onChange={setKeys} />
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
