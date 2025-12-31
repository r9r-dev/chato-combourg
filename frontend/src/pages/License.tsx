import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { getSettings, updateSettings } from '../services/api';

export function License() {
  const { setStep } = useGame();
  const [developerMode, setDeveloperMode] = useState(false);

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

  const toggleDeveloperMode = async () => {
    const newMode = !developerMode;
    setDeveloperMode(newMode);
    try {
      await updateSettings({ developer_mode: newMode ? 'true' : 'false' });
    } catch {
      // Revert on error
      setDeveloperMode(!newMode);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={() => setStep('settings')} className="text-white/60 hover:text-white">
          Retour
        </button>
        <h1 className="text-lg font-semibold text-white">Licence</h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="prose prose-invert max-w-none">
          <h2 className="text-gold text-xl font-bold mb-4">GNU Affero General Public License v3.0</h2>

          <p className="text-white/80 text-sm mb-4">
            Chato Combourg - Image Processing for Chateau Combo boardgame
          </p>

          <p className="text-white/60 text-sm mb-4">
            Copyright (C) 2025 Ronan Lamour
          </p>

          <div className="bg-dark-lighter rounded-xl p-4 mb-6">
            <p className="text-white/70 text-sm mb-3">
              This program is free software: you can redistribute it and/or modify
              it under the terms of the GNU Affero General Public License as published by
              the Free Software Foundation, either version 3 of the License, or
              (at your option) any later version.
            </p>

            <p className="text-white/70 text-sm mb-3">
              This program is distributed in the hope that it will be useful,
              but WITHOUT ANY WARRANTY; without even the implied warranty of
              MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
              GNU Affero General Public License for more details.
            </p>

            <p className="text-white/70 text-sm">
              You should have received a copy of the GNU Affero General Public License
              along with this program. If not, see{' '}
              <a
                href="https://www.gnu.org/licenses/agpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                gnu.org/licenses/agpl-3.0
              </a>.
            </p>
          </div>

          <h3 className="text-white text-lg font-semibold mb-3">Permissions</h3>
          <ul className="text-white/60 text-sm space-y-1 mb-6">
            <li>- Utilisation, copie et distribution du logiciel</li>
            <li>- Modification et creation de versions derivees</li>
            <li>- Utilisation privee et commerciale</li>
          </ul>

          <h3 className="text-white text-lg font-semibold mb-3">Conditions</h3>
          <ul className="text-white/60 text-sm space-y-1 mb-6">
            <li>- Fournir le code source aux utilisateurs (y compris via reseau)</li>
            <li>- Conserver les notices de copyright et la licence</li>
            <li>- Distribuer les modifications sous la meme licence AGPL v3</li>
            <li>- Documenter les modifications apportees</li>
          </ul>

          <h3 className="text-white text-lg font-semibold mb-3">Limitations</h3>
          <ul className="text-white/60 text-sm space-y-1 mb-6">
            <li>- Aucune garantie fournie</li>
            <li>- Aucune responsabilite des auteurs</li>
          </ul>

          <div className="border-t border-white/10 pt-6">
            <a
              href="https://github.com/r9r-dev/chato-combourg"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full p-3 bg-dark-lighter rounded-xl text-center text-white/70 hover:bg-dark-card"
            >
              Voir le code source sur GitHub
            </a>
          </div>
        </div>

        {/* Developer mode toggle */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <button
            onClick={toggleDeveloperMode}
            className="w-full p-3 bg-dark-lighter rounded-xl flex items-center justify-between"
          >
            <span className="text-white/70 text-sm">Mode développeur</span>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                developerMode ? 'bg-gold' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  developerMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
          {developerMode && (
            <p className="text-white/40 text-xs text-center mt-2">
              Affiche les informations de debug dans la caméra
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
