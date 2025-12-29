import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';

export function Landing() {
  const { setStep } = useGame();
  const { user, loading } = useAuth();

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
              onClick={() => setStep('players')}
              disabled={loading}
              className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                         hover:bg-gold-light active:bg-gold-dark transition-colors
                         shadow-lg shadow-gold/20
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Nouvelle partie
            </button>

            <button
              onClick={() => setStep('games')}
              disabled={loading}
              className="w-full py-4 px-8 bg-dark-lighter text-white font-semibold text-lg rounded-xl
                         hover:bg-dark-card transition-colors border border-white/10
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mes parties
            </button>

            <button
              onClick={() => setStep('settings')}
              disabled={loading}
              className="w-full py-4 px-8 bg-dark-lighter text-white font-semibold text-lg rounded-xl
                         hover:bg-dark-card transition-colors border border-white/10
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Paramètres
            </button>
          </div>

          {/* User info */}
          {user && (
            <div className="mt-8 text-white/40 text-sm">
              Connecté en tant que {user.name || user.email || user.id}
            </div>
          )}
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
