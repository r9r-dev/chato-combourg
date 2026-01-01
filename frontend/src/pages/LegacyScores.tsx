import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { NumberPad } from '../components/NumberPad';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Step = 'card1' | 'card2' | 'card3' | 'card4' | 'card5' | 'card6' | 'card7' | 'card8' | 'card9' | 'keys' | 'recap';

const STEPS: Step[] = ['card1', 'card2', 'card3', 'card4', 'card5', 'card6', 'card7', 'card8', 'card9', 'keys', 'recap'];

export function LegacyScores() {
  const {
    state,
    setKeys,
    setLegacyCardScores,
    saveLegacyPlayerAndNext,
    getCurrentPlayer,
    reset,
  } = useGame();

  const [currentStep, setCurrentStep] = useState<Step>('card1');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<number | null>(null);

  const currentPlayer = getCurrentPlayer();
  const playerIndex = state.currentPlayerIndex + 1;
  const totalPlayers = state.selectedPlayers.length;

  // Initialize scores if not set
  const cardScores = state.legacyCardScores ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const totalCardScore = cardScores.reduce((sum, s) => sum + s, 0);
  const totalScore = totalCardScore + state.keys;

  const stepIndex = STEPS.indexOf(currentStep);
  const isCardStep = currentStep.startsWith('card');
  const cardNumber = isCardStep ? parseInt(currentStep.replace('card', '')) : 0;
  const cardPosition = cardNumber - 1; // 0-indexed

  const handleScoreChange = (value: number) => {
    if (isCardStep) {
      const newScores = [...cardScores];
      newScores[cardPosition] = value;
      setLegacyCardScores(newScores);
    } else if (currentStep === 'keys') {
      setKeys(value);
    }
  };

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleFinish = async () => {
    await saveLegacyPlayerAndNext();
    // Reset step for next player or navigation handled by GameContext
    setCurrentStep('card1');
  };

  const handleQuit = () => {
    setShowExitConfirm(true);
  };

  const confirmQuit = () => {
    reset();
  };

  const currentValue = isCardStep ? cardScores[cardPosition] : state.keys;

  // Position labels for the 3x3 grid
  const positionLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  // Recap view - show grid and allow editing
  if (currentStep === 'recap') {
    // If editing a specific position
    if (editingPosition !== null) {
      return (
        <div className="flex flex-col h-dvh p-6 overflow-hidden">
          <div className="text-center mb-8">
            {currentPlayer && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: currentPlayer.color }}
                >
                  {playerIndex}
                </div>
                <span className="text-white font-medium">{currentPlayer.name}</span>
              </div>
            )}
            <h1 className="text-3xl font-bold text-gold mb-2">Carte {editingPosition + 1}</h1>
            <p className="text-white/60">Modifier le score</p>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-xs">
              <NumberPad
                value={cardScores[editingPosition]}
                onChange={(value) => {
                  const newScores = [...cardScores];
                  newScores[editingPosition] = value;
                  setLegacyCardScores(newScores);
                }}
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setEditingPosition(null)}
              className="flex-1 py-4 px-6 bg-gold text-dark font-semibold rounded-xl
                         hover:bg-gold-light transition-colors"
            >
              Valider
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-dvh p-6 overflow-hidden">
        {/* Header */}
        <div className="text-center mb-4">
          {currentPlayer && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: currentPlayer.color }}
              >
                {playerIndex}
              </div>
              <span className="text-white font-medium">{currentPlayer.name}</span>
              <span className="text-white/40 text-sm">({playerIndex}/{totalPlayers})</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-gold mb-2">Recapitulatif</h1>
          <p className="text-white/60 text-sm">Cliquez sur une case pour modifier</p>
        </div>

        {/* Grid recap */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-xs mx-auto">
            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {cardScores.map((score, position) => (
                <button
                  key={position}
                  onClick={() => setEditingPosition(position)}
                  className="aspect-square bg-dark-card rounded-xl flex flex-col items-center justify-center
                             hover:bg-dark-lighter transition-colors border-2 border-transparent
                             hover:border-gold/30"
                >
                  <span className="text-white/40 text-xs mb-1">
                    {positionLabels[position]}
                  </span>
                  <span className="text-2xl font-bold text-gold tabular-nums">
                    {score}
                  </span>
                </button>
              ))}
            </div>

            {/* Total cards */}
            <div className="bg-dark-card rounded-xl p-4 flex items-center justify-between mb-2">
              <span className="text-white/60">Total cartes</span>
              <span className="text-2xl font-bold text-white tabular-nums">
                {totalCardScore}
              </span>
            </div>

            {/* Keys */}
            <button
              onClick={() => setCurrentStep('keys')}
              className="w-full bg-dark-card rounded-xl p-4 flex items-center justify-between
                         hover:bg-dark-lighter transition-colors mb-2"
            >
              <span className="text-white/60">Cles</span>
              <span className="text-2xl font-bold text-gold tabular-nums">
                +{state.keys}
              </span>
            </button>

            {/* Total with keys */}
            <div className="bg-gold/20 rounded-xl p-4 flex items-center justify-between">
              <span className="text-gold font-medium">Score total</span>
              <span className="text-3xl font-bold text-gold tabular-nums">
                {totalScore}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={handleBack}
            className="flex-1 py-4 px-6 bg-dark-card text-white/70 font-semibold rounded-xl
                       hover:bg-dark-lighter hover:text-white transition-colors"
          >
            Retour
          </button>
          <button
            onClick={handleFinish}
            className="flex-1 py-4 px-6 bg-gold text-dark font-semibold rounded-xl
                       hover:bg-gold-light active:bg-gold-dark transition-colors
                       shadow-lg shadow-gold/20"
          >
            {playerIndex < totalPlayers ? 'Joueur suivant' : 'Terminer'}
          </button>
        </div>

        {/* Exit confirmation dialog */}
        {showExitConfirm && (
          <ConfirmDialog
            title="Quitter la saisie ?"
            message="Les donnees saisies seront perdues."
            confirmLabel="Quitter"
            cancelLabel="Continuer"
            onConfirm={confirmQuit}
            onCancel={() => setShowExitConfirm(false)}
          />
        )}
      </div>
    );
  }

  // Card or Keys input view
  const title = isCardStep ? `Carte ${cardNumber}` : 'Cles';
  const subtitle = isCardStep
    ? `Score de la carte en position ${cardNumber}`
    : 'Combien de cles restantes ?';

  return (
    <div className="flex flex-col h-dvh p-6 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-8">
        {currentPlayer && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: currentPlayer.color }}
            >
              {playerIndex}
            </div>
            <span className="text-white font-medium">{currentPlayer.name}</span>
            <span className="text-white/40 text-sm">({playerIndex}/{totalPlayers})</span>
          </div>
        )}
        <h1 className="text-3xl font-bold text-gold mb-2">{title}</h1>
        <p className="text-white/60">{subtitle}</p>

        {/* Progress indicator */}
        <div className="flex justify-center gap-1 mt-4">
          {STEPS.slice(0, -1).map((step, idx) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx < stepIndex ? 'bg-gold' : idx === stepIndex ? 'bg-gold' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* NumberPad */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xs">
          <NumberPad value={currentValue} onChange={handleScoreChange} />
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-4 mt-6">
        {stepIndex > 0 ? (
          <button
            onClick={handleBack}
            className="flex-1 py-4 px-6 bg-dark-card text-white/70 font-semibold rounded-xl
                       hover:bg-dark-lighter hover:text-white transition-colors"
          >
            Retour
          </button>
        ) : (
          <button
            onClick={handleQuit}
            className="flex-1 py-4 px-6 bg-dark-card text-white/70 font-semibold rounded-xl
                       hover:bg-dark-lighter hover:text-white transition-colors"
          >
            Quitter
          </button>
        )}
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
          title="Quitter la saisie ?"
          message="Les donnees saisies seront perdues."
          confirmLabel="Quitter"
          cancelLabel="Continuer"
          onConfirm={confirmQuit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
