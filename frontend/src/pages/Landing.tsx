import { useGame } from '../context/GameContext';

export function Landing() {
  const { setStep } = useGame();

  return (
    <div className="flex flex-col items-center justify-center h-dvh p-6 text-center overflow-hidden">
      <div className="max-w-md">
        <h1 className="text-4xl font-bold text-gold mb-8">Chato Combourg</h1>

        <div className="bg-dark-lighter rounded-2xl p-8 mb-8 shadow-lg border border-gold/20">
          <p className="text-xl text-white/90 leading-relaxed">
            Retire toutes les clés et pièces présentes sur les cartes
          </p>
        </div>

        <button
          onClick={() => setStep('camera')}
          className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                     hover:bg-gold-light active:bg-gold-dark transition-colors
                     shadow-lg shadow-gold/20"
        >
          Commencer
        </button>
      </div>
    </div>
  );
}
