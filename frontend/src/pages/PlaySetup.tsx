/**
 * PlaySetup - Configuration d'une partie en mode Jouer
 *
 * Interface unifiee avec la selection de joueurs standard,
 * avec la possibilite d'ajouter des IA.
 */

import { useState } from 'react';
import { usePlay } from '../context/PlayContext';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AIEasyIcon, AINormalIcon, AIHardIcon, AIExtremeIcon } from '../components/Icons';
import type { Player } from '../types';
import type { AILevel } from '../types/play';

/** Retourne le composant d'icone pour un niveau d'IA */
function AIIcon({ level, className = 'w-5 h-5 text-white' }: { level: AILevel; className?: string }) {
  switch (level) {
    case 'easy':
      return <AIEasyIcon className={className} />;
    case 'normal':
      return <AINormalIcon className={className} />;
    case 'hard':
      return <AIHardIcon className={className} />;
    case 'neural':
      return <AIExtremeIcon className={className} />;
    default:
      return <AINormalIcon className={className} />;
  }
}

const AI_COLORS = [
  '#6b7280', // Gris
  '#4b5563', // Gris fonce
  '#374151', // Gris tres fonce
];

const AI_LEVELS: { value: AILevel; label: string; description: string }[] = [
  { value: 'easy', label: 'Facile', description: '"Oh, elle est jolie cette carte !"' },
  { value: 'normal', label: 'Normale', description: '"Je connais bien les règles."' },
  { value: 'hard', label: 'Difficile', description: '"Je n\'ai aucune pitié."' },
  { value: 'neural', label: 'Extrême', description: '"Prie pour avoir de la chance."' },
];

interface AIPlayer {
  id: string;
  name: string;
  color: string;
  level: AILevel;
}

export function PlaySetup() {
  const { state, startGame, reset } = usePlay();
  const { setStep: setGameStep } = useGame();
  const { sortedPlayers, addPlayer, loading } = useAuth();

  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [aiPlayers, setAiPlayers] = useState<AIPlayer[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showAddAI, setShowAddAI] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const totalPlayers = selectedPlayers.length + aiPlayers.length;
  const canAddMore = totalPlayers < 5;
  const canStart = totalPlayers >= 2;

  const getNextAIColor = (): string => {
    const usedColors = aiPlayers.map(ai => ai.color);
    const available = AI_COLORS.filter(c => !usedColors.includes(c));
    return available[0] ?? AI_COLORS[0];
  };

  const togglePlayer = (player: Player) => {
    const isSelected = selectedPlayers.find((p) => p.id === player.id);
    if (isSelected) {
      setSelectedPlayers(selectedPlayers.filter((p) => p.id !== player.id));
    } else if (canAddMore) {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const handleCreatePlayer = async () => {
    if (!newPlayerName.trim() || isCreating || !canAddMore) return;
    setIsCreating(true);
    try {
      const player = await addPlayer(newPlayerName.trim());
      setSelectedPlayers([...selectedPlayers, player]);
      setNewPlayerName('');
      setShowAddPlayer(false);
    } catch (error) {
      console.error('Failed to create player:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddAI = (level: AILevel) => {
    if (!canAddMore) return;
    const levelLabel = AI_LEVELS.find(l => l.value === level)?.label ?? 'IA';
    const newAI: AIPlayer = {
      id: `ai-${Date.now()}`,
      name: `IA ${levelLabel}`,
      color: getNextAIColor(),
      level,
    };
    setAiPlayers([...aiPlayers, newAI]);
    setShowAddAI(false);
  };

  const handleRemoveAI = (aiId: string) => {
    setAiPlayers(aiPlayers.filter(ai => ai.id !== aiId));
  };

  const handleStartGame = async () => {
    if (!canStart) return;

    const config = {
      players: [
        // Joueurs humains selectionnes
        ...selectedPlayers.map(p => ({
          name: p.name,
          color: p.color,
          isAI: false,
          playerId: p.id,  // Stocker l'ID du joueur pour la sauvegarde
        })),
        // IA ajoutees
        ...aiPlayers.map(ai => ({
          name: ai.name,
          color: ai.color,
          isAI: true,
          aiLevel: ai.level,
        })),
      ],
    };
    await startGame(config);
  };

  const handleQuit = () => {
    setShowQuitConfirm(true);
  };

  const confirmQuit = () => {
    reset();
    setGameStep('landing');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-white/60">Chargement...</div>
      </div>
    );
  }

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
          Sélectionnez 2 à 5 joueurs ({totalPlayers}/5)
        </p>

        {/* Human players list */}
        <div className="space-y-2 mb-4">
          {sortedPlayers.map((player) => {
            const isSelected = selectedPlayers.find((p) => p.id === player.id);
            const order = isSelected
              ? selectedPlayers.findIndex((p) => p.id === player.id) + 1
              : 0;

            return (
              <button
                key={player.id}
                onClick={() => togglePlayer(player)}
                disabled={!isSelected && !canAddMore}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-gold/20 border-2 border-gold'
                    : canAddMore
                    ? 'bg-dark-lighter border-2 border-transparent hover:border-white/20'
                    : 'bg-dark-lighter border-2 border-transparent opacity-50 cursor-not-allowed'
                }`}
              >
                {/* Color badge */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ backgroundColor: player.color }}
                >
                  {isSelected ? order : player.name.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <span className="flex-1 text-left text-white font-medium">
                  {player.name}
                </span>

                {/* Check mark */}
                {isSelected && (
                  <svg
                    className="w-6 h-6 text-gold"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Add human player */}
        {canAddMore && (
          <>
            {!showAddPlayer ? (
              <button
                onClick={() => setShowAddPlayer(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl mb-4
                           border-2 border-dashed border-white/20 text-white/60
                           hover:border-gold hover:text-gold transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un joueur
              </button>
            ) : (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreatePlayer()}
                  placeholder="Nom du joueur"
                  className="flex-1 px-4 py-3 rounded-xl bg-dark-lighter text-white
                             border border-white/20 focus:border-gold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleCreatePlayer}
                  disabled={!newPlayerName.trim() || isCreating}
                  className="px-4 py-3 rounded-xl bg-gold text-dark font-semibold
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? '...' : 'OK'}
                </button>
                <button
                  onClick={() => {
                    setShowAddPlayer(false);
                    setNewPlayerName('');
                  }}
                  className="px-4 py-3 rounded-xl bg-dark-lighter text-white/60"
                >
                  X
                </button>
              </div>
            )}
          </>
        )}

        {/* AI players section */}
        {aiPlayers.length > 0 && (
          <div className="mb-4">
            <p className="text-white/40 text-sm mb-2 px-1">Intelligence artificielle</p>
            <div className="space-y-2">
              {aiPlayers.map((ai, index) => {
                const order = selectedPlayers.length + index + 1;
                const levelInfo = AI_LEVELS.find(l => l.value === ai.level);

                return (
                  <div
                    key={ai.id}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-gold/20 border-2 border-gold"
                  >
                    {/* AI badge */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: ai.color }}
                    >
                      <AIIcon level={ai.level} className="w-6 h-6 text-white" />
                    </div>

                    {/* Order badge */}
                    <div className="w-6 h-6 rounded-full bg-gold text-dark flex items-center justify-center text-sm font-bold">
                      {order}
                    </div>

                    {/* Name and level */}
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium block">{ai.name}</span>
                      <span className="text-white/40 text-xs">{levelInfo?.description}</span>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveAI(ai.id)}
                      className="p-2 text-white/40 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add AI button */}
        {canAddMore && (
          <>
            {!showAddAI ? (
              <button
                onClick={() => setShowAddAI(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl
                           border-2 border-dashed border-white/20 text-white/60
                           hover:border-blue-400 hover:text-blue-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Ajouter une IA
              </button>
            ) : (
              <div className="bg-dark-card rounded-xl border border-white/10 overflow-hidden">
                <p className="text-white/40 text-sm px-4 pt-3 pb-2">Choisir le niveau</p>
                <div className="flex flex-col gap-2 p-2">
                  {AI_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => handleAddAI(level.value)}
                      className="py-3 px-4 rounded-lg bg-dark-lighter hover:bg-white/10 transition-colors text-left flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <AIIcon level={level.value} className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white font-medium">{level.label}</span>
                      <span className="text-white/40 text-xs flex-1">{level.description}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAddAI(false)}
                  className="w-full p-3 text-white/40 hover:text-white transition-colors border-t border-white/10"
                >
                  Annuler
                </button>
              </div>
            )}
          </>
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
          {state.isLoading ? 'Chargement...' : `Commencer (${totalPlayers} joueurs)`}
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
