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
