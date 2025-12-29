import { useGame } from '../context/GameContext';

export function Landing() {
  const { setStep } = useGame();

  return (
    <div className="flex flex-col h-dvh p-6 overflow-hidden">
      {/* Main content - centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gold mb-2">Chato Combourg</h1>
          <p className="text-lg text-white/60 mb-12">Calculateur de score</p>

          {/* Menu buttons */}
          <div className="space-y-4">
            <button
              onClick={() => setStep('keys')}
              className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                         hover:bg-gold-light active:bg-gold-dark transition-colors
                         shadow-lg shadow-gold/20"
            >
              Nouvelle partie
            </button>

            <button
              disabled
              className="w-full py-4 px-8 bg-dark-lighter text-white/40 font-semibold text-lg rounded-xl
                         cursor-not-allowed border border-white/10"
            >
              Mes parties
            </button>

            <button
              disabled
              className="w-full py-4 px-8 bg-dark-lighter text-white/40 font-semibold text-lg rounded-xl
                         cursor-not-allowed border border-white/10"
            >
              Parametres
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-white/30 text-xs py-4">
        <p>v{__APP_VERSION__} - Ronan Lamour 2025</p>
        <p className="mt-1">Licence MIT - Illustrations Catch Up Games</p>
      </footer>
    </div>
  );
}
