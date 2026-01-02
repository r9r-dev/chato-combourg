import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { getSettings } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function Landing() {
  const { setStep } = useGame();
  const { user, loading } = useAuth();
  const [developerMode, setDeveloperMode] = useState(false);

  // Random card for background decoration (1-92)
  const backgroundCardNumber = useMemo(() => {
    const num = Math.floor(Math.random() * 92) + 1;
    return num.toString().padStart(3, '0');
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getSettings();
        setDeveloperMode(settings.developer_mode === 'true');
      } catch {
        // Ignore
      }
    };
    loadSettings();
  }, []);

  return (
    <div className="flex flex-col h-dvh p-6 overflow-hidden relative">
      {/* Background card decoration */}
      <div
        className="absolute -bottom-20 -right-20 pointer-events-none select-none"
        style={{
          transform: 'rotate(-15deg) scale(2.5)',
          transformOrigin: 'center',
          opacity: 0.12,
          filter: 'sepia(100%) saturate(150%) brightness(0.8) hue-rotate(-10deg)',
        }}
      >
        <img
          src={`${API_BASE}/cards/thumbs/carte_${backgroundCardNumber}.webp`}
          alt=""
          className="w-[200px] h-[280px]"
          loading="lazy"
        />
      </div>

      {/* Main content - centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gold mb-2">Chato Combourg</h1>
          <p className="text-lg text-white/60 mb-12">Calculateur de score pour le jeu Château Combo</p>

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
              Enregistrer une partie
            </button>

            <button
              onClick={() => setStep('play')}
              disabled={loading}
              className="w-full py-4 px-8 bg-dark-lighter text-white font-semibold text-lg rounded-xl
                         hover:bg-dark-card transition-colors border border-gold/30
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 text-gold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 7H7v6h6V7z" />
                <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
              </svg>
              Jouer avec l'IA (version alpha)
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

            {developerMode && (
              <button
                onClick={() => setStep('developer')}
                className="w-full py-4 px-8 bg-red-900 text-white font-semibold text-lg rounded-xl
                           hover:bg-red-800 transition-colors border border-red-700"
              >
                Développeur
              </button>
            )}
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
        <p className="mt-1">Licence AGPL v3 - Illustrations Catch Up Games</p>
      </footer>
    </div>
  );
}
