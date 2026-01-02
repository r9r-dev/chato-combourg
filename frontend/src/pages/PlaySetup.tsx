/**
 * PlaySetup - Configuration d'une partie en mode Jouer
 *
 * Permet de :
 * - Ajouter des joueurs humains ou IA
 * - Choisir le niveau de difficulte des IA
 * - Configurer les couleurs
 * - Lancer la partie
 */

import { useState } from 'react';
import { usePlay } from '../context/PlayContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { AILevel } from '../types/play';

const PLAYER_COLORS = [
  '#e74c3c', // Rouge
  '#3498db', // Bleu
  '#2ecc71', // Vert
  '#f39c12', // Orange
  '#9b59b6', // Violet
];

const AI_LEVELS: { value: AILevel; label: string; description: string }[] = [
  { value: 'easy', label: 'Facile', description: 'Choix aleatoires' },
  { value: 'normal', label: 'Normal', description: 'Heuristiques basiques' },
  { value: 'hard', label: 'Difficile', description: 'MCTS strategique' },
];

interface PlayerSetup {
  name: string;
  color: string;
  isAI: boolean;
  aiLevel?: AILevel;
}

export function PlaySetup() {
  const { state, startGame, reset } = usePlay();
  const [players, setPlayers] = useState<PlayerSetup[]>([
    { name: 'Joueur 1', color: PLAYER_COLORS[0], isAI: false },
    { name: 'IA Normale', color: PLAYER_COLORS[1], isAI: true, aiLevel: 'normal' },
  ]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const getNextColor = (): string => {
    const usedColors = players.map(p => p.color);
    const available = PLAYER_COLORS.filter(c => !usedColors.includes(c));
    return available[0] ?? PLAYER_COLORS[0];
  };

  const handleAddHuman = () => {
    if (players.length >= 5) return;
    const humanCount = players.filter(p => !p.isAI).length + 1;
    setPlayers([
      ...players,
      { name: `Joueur ${humanCount}`, color: getNextColor(), isAI: false },
    ]);
    setShowAddMenu(false);
  };

  const handleAddAI = (level: AILevel) => {
    if (players.length >= 5) return;
    const levelLabel = AI_LEVELS.find(l => l.value === level)?.label ?? 'IA';
    setPlayers([
      ...players,
      { name: `IA ${levelLabel}`, color: getNextColor(), isAI: true, aiLevel: level },
    ]);
    setShowAddMenu(false);
  };

  const handleRemovePlayer = (index: number) => {
    if (players.length <= 2) return;
    const newPlayers = [...players];
    newPlayers.splice(index, 1);
    setPlayers(newPlayers);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingName(players[index].name);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const newPlayers = [...players];
    newPlayers[editingIndex] = { ...newPlayers[editingIndex], name: editingName.trim() || newPlayers[editingIndex].name };
    setPlayers(newPlayers);
    setEditingIndex(null);
    setEditingName('');
  };

  const handleChangeAILevel = (index: number, level: AILevel) => {
    const newPlayers = [...players];
    const levelLabel = AI_LEVELS.find(l => l.value === level)?.label ?? 'IA';
    newPlayers[index] = {
      ...newPlayers[index],
      aiLevel: level,
      name: `IA ${levelLabel}`,
    };
    setPlayers(newPlayers);
  };

  const handleStartGame = async () => {
    // Construire le config et le passer directement a startGame
    const config = {
      players: players.map(p => ({
        name: p.name,
        color: p.color,
        isAI: p.isAI,
        aiLevel: p.aiLevel,
      })),
    };
    await startGame(config);
  };

  const handleQuit = () => {
    setShowQuitConfirm(true);
  };

  const confirmQuit = () => {
    reset();
  };

  const hasHuman = players.some(p => !p.isAI);
  const canStart = players.length >= 2 && hasHuman;

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={handleQuit} className="text-white/60 hover:text-white">
          Retour
        </button>
        <h1 className="text-lg font-semibold text-white">Jouer avec IA</h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <p className="text-center text-white/60 mb-4">
          Configurez les joueurs (2 a 5)
        </p>

        {/* Players list */}
        <div className="space-y-3 mb-4">
          {players.map((player, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-xl bg-dark-lighter border border-white/10"
            >
              {/* Color badge */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: player.color }}
              >
                {player.isAI ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <span className="text-white font-bold">{player.name.charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Name or edit field */}
              <div className="flex-1 min-w-0">
                {editingIndex === index ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    className="w-full px-2 py-1 rounded bg-dark text-white border border-gold focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => handleStartEdit(index)}
                    className="text-left w-full"
                  >
                    <span className="text-white font-medium truncate block">{player.name}</span>
                    {player.isAI && (
                      <span className="text-white/40 text-xs">
                        {AI_LEVELS.find(l => l.value === player.aiLevel)?.description}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* AI level selector */}
              {player.isAI && (
                <select
                  value={player.aiLevel}
                  onChange={(e) => handleChangeAILevel(index, e.target.value as AILevel)}
                  className="px-2 py-1 rounded bg-dark text-white border border-white/20 text-sm"
                >
                  {AI_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Remove button */}
              {players.length > 2 && (
                <button
                  onClick={() => handleRemovePlayer(index)}
                  className="p-2 text-white/40 hover:text-red-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add player */}
        {players.length < 5 && (
          <div className="relative">
            {!showAddMenu ? (
              <button
                onClick={() => setShowAddMenu(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl
                           border-2 border-dashed border-white/20 text-white/60
                           hover:border-gold hover:text-gold transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un joueur
              </button>
            ) : (
              <div className="bg-dark-card rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={handleAddHuman}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors border-b border-white/10"
                >
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-white">Joueur humain</span>
                </button>

                <div className="p-2 border-b border-white/10">
                  <p className="text-white/40 text-xs px-2 mb-2">Ajouter une IA</p>
                  <div className="flex gap-2">
                    {AI_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => handleAddAI(level.value)}
                        className="flex-1 py-2 px-3 rounded-lg bg-dark-lighter hover:bg-white/10 transition-colors"
                      >
                        <span className="text-white text-sm block">{level.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowAddMenu(false)}
                  className="w-full p-3 text-white/40 hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        )}

        {/* Warning if no human */}
        {!hasHuman && (
          <div className="mt-4 p-3 rounded-xl bg-orange-900/30 border border-orange-500/30">
            <p className="text-orange-300 text-sm text-center">
              Ajoutez au moins un joueur humain
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="p-4 border-t border-white/10">
        <button
          onClick={handleStartGame}
          disabled={!canStart || state.isLoading}
          className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                     hover:bg-gold-light active:bg-gold-dark transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isLoading ? 'Chargement...' : `Commencer (${players.length} joueurs)`}
        </button>
      </footer>

      {/* Quit confirmation */}
      <ConfirmDialog
        isOpen={showQuitConfirm}
        title="Quitter ?"
        message="Voulez-vous vraiment quitter la configuration ?"
        confirmLabel="Quitter"
        cancelLabel="Annuler"
        onConfirm={confirmQuit}
        onCancel={() => setShowQuitConfirm(false)}
      />
    </div>
  );
}
