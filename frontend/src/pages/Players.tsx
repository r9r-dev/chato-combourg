import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { Player } from '../types';

export function Players() {
  const { setStep, setSelectedPlayersAndContinue } = useGame();
  const { sortedPlayers, addPlayer, loading } = useAuth();
  const [selected, setSelected] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const togglePlayer = (player: Player) => {
    if (selected.find((p) => p.id === player.id)) {
      setSelected(selected.filter((p) => p.id !== player.id));
    } else if (selected.length < 5) {
      setSelected([...selected, player]);
    }
  };

  const handleCreatePlayer = async () => {
    if (!newPlayerName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const player = await addPlayer(newPlayerName.trim());
      setSelected([...selected, player]);
      setNewPlayerName('');
      setShowAddPlayer(false);
    } catch (error) {
      console.error('Failed to create player:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleNext = () => {
    if (selected.length < 2) return;
    // This combined function reads isLegacyMode from the latest state
    // and navigates to 'legacy-scores' or 'keys' accordingly
    setSelectedPlayersAndContinue(selected);
  };

  const handleQuit = () => {
    setShowQuitConfirm(true);
  };

  const confirmQuit = () => {
    setStep('landing');
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Chargement des joueurs..." />;
  }

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={handleQuit} className="text-white/60 hover:text-white">
          Quitter
        </button>
        <h1 className="text-lg font-semibold text-white">Joueurs</h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <p className="text-center text-white/60 mb-4">
          Sélectionnez 2 à 5 joueurs ({selected.length}/5)
        </p>

        {/* Players list */}
        <div className="space-y-2 mb-4">
          {sortedPlayers.map((player) => {
            const isSelected = selected.find((p) => p.id === player.id);
            const order = selected.findIndex((p) => p.id === player.id) + 1;

            return (
              <button
                key={player.id}
                onClick={() => togglePlayer(player)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-gold/20 border-2 border-gold'
                    : 'bg-dark-lighter border-2 border-transparent hover:border-white/20'
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

        {/* Add player button */}
        {!showAddPlayer ? (
          <button
            onClick={() => setShowAddPlayer(true)}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl
                       border-2 border-dashed border-white/20 text-white/60
                       hover:border-gold hover:text-gold transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Ajouter un joueur
          </button>
        ) : (
          <div className="flex gap-2">
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
      </div>

      {/* Footer */}
      <footer className="p-4 border-t border-white/10">
        <button
          onClick={handleNext}
          disabled={selected.length < 2}
          className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                     hover:bg-gold-light active:bg-gold-dark transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuer ({selected.length} joueurs)
        </button>
      </footer>

      {/* Quit confirmation */}
      <ConfirmDialog
        isOpen={showQuitConfirm}
        title="Quitter ?"
        message="Voulez-vous vraiment quitter ? La sélection sera perdue."
        confirmLabel="Quitter"
        cancelLabel="Annuler"
        onConfirm={confirmQuit}
        onCancel={() => setShowQuitConfirm(false)}
      />
    </div>
  );
}
