import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import {
  updatePlayer,
  deletePlayer,
  exportGames,
  getModelInfo,
  updateSettings,
  getSettings,
  downloadModel,
  type ModelInfo,
} from '../services/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { PlayerWithStats, PlayerOrderMode, OfflineMode, DetectionModel } from '../types';
import { modelStorage } from '../services/modelStorage';

const PLAYER_COLORS = [
  '#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA',
  '#00ACC1', '#FFB300', '#6D4C41', '#EC407A', '#5C6BC0',
];

const ORDER_OPTIONS: { value: PlayerOrderMode; label: string }[] = [
  { value: 'alphabetical', label: 'Alphabétique' },
  { value: 'manual', label: 'Manuel' },
  { value: 'most_played', label: 'Les plus fréquents' },
  { value: 'last_played', label: 'Derniers à avoir joué' },
];

const OFFLINE_OPTIONS: { value: OfflineMode; label: string; description: string }[] = [
  { value: 'never', label: 'Jamais', description: 'Toujours utiliser le serveur' },
  { value: 'fallback', label: 'Serveur indisponible', description: 'Local si serveur hors ligne' },
  { value: 'always', label: 'Toujours', description: 'Toujours utiliser le local' },
];

const MODEL_OPTIONS: { value: DetectionModel; label: string; description: string }[] = [
  { value: 'openvino', label: 'OpenVINO', description: 'Serveur (~7s)' },
  { value: 'pytorch', label: 'PyTorch', description: 'Mac M4 (~1s, si disponible)' },
];

export function Settings() {
  const { setStep, setLegacyMode } = useGame();
  const {
    playersWithStats,
    playerOrder,
    manualPlayerOrder,
    refreshPlayers,
    setPlayerOrder: setPlayerOrderContext,
  } = useAuth();

  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [manualOrder, setManualOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit player state
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithStats | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Delete confirmation
  const [deletingPlayer, setDeletingPlayer] = useState<PlayerWithStats | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Detection settings state
  const [offlineMode, setOfflineMode] = useState<OfflineMode>('never');
  const [detectionModel, setDetectionModel] = useState<DetectionModel>('openvino');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [localModelInfo, setLocalModelInfo] = useState<{ version: string; variant: string; storedAt: string } | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>('fp16');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  // Sync from context
  useEffect(() => {
    setPlayers(playersWithStats);
    setManualOrder(manualPlayerOrder);
    setLoading(false);
  }, [playersWithStats, manualPlayerOrder]);

  // Load detection settings and model info
  useEffect(() => {
    const loadDetectionSettings = async () => {
      try {
        // Load settings from backend
        const settings = await getSettings();
        if (settings.offline_mode) {
          setOfflineMode(settings.offline_mode as OfflineMode);
        }
        if (settings.detection_model) {
          setDetectionModel(settings.detection_model as DetectionModel);
        }
        if (settings.model_variant) {
          setSelectedVariant(settings.model_variant);
        }

        // Load server model info
        const info = await getModelInfo();
        setModelInfo(info);

        // Load local model info
        const localInfo = await modelStorage.getModelInfo();
        setLocalModelInfo(localInfo);

        // If we have a local model, use its variant as selected
        if (localInfo?.variant) {
          setSelectedVariant(localInfo.variant);
        }
      } catch (err) {
        console.warn('Failed to load model info:', err);
      }
    };
    loadDetectionSettings();
  }, []);

  // Save player order setting
  const handleOrderChange = async (order: PlayerOrderMode) => {
    await setPlayerOrderContext(order);
  };

  // Edit player
  const startEditPlayer = (player: PlayerWithStats) => {
    setEditingPlayer(player);
    setEditName(player.name);
    setEditColor(player.color);
  };

  const savePlayer = async () => {
    if (!editingPlayer) return;
    try {
      await updatePlayer(editingPlayer.id, { name: editName, color: editColor });
      setPlayers(players.map(p =>
        p.id === editingPlayer.id ? { ...p, name: editName, color: editColor } : p
      ));
      setEditingPlayer(null);
      refreshPlayers();
    } catch (err) {
      console.error('Failed to update player:', err);
    }
  };

  // Delete player
  const confirmDeletePlayer = async () => {
    if (!deletingPlayer) return;
    setDeleteError(null);
    try {
      await deletePlayer(deletingPlayer.id);
      setPlayers(players.filter(p => p.id !== deletingPlayer.id));
      setDeletingPlayer(null);
      refreshPlayers();
    } catch (err) {
      console.error('Failed to delete player:', err);
      // Extract error message from API response
      if (err instanceof Error && err.message.includes('partie')) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Impossible de supprimer ce joueur');
      }
    }
  };

  // Manual order (drag would be better, but simple arrows for now)
  const movePlayer = async (playerId: number, direction: 'up' | 'down') => {
    const currentOrder = manualOrder.length > 0 ? manualOrder : players.map(p => p.id);
    const idx = currentOrder.indexOf(playerId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    await setPlayerOrderContext('manual', newOrder);
  };

  // Export
  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const blob = await exportGames(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chato-parties-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // Force update PWA
  const forceUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.unregister());
      });
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
      window.location.reload();
    }
  };

  // Handle offline mode change
  const handleOfflineModeChange = async (mode: OfflineMode) => {
    setOfflineMode(mode);
    try {
      await updateSettings({ offline_mode: mode });
    } catch (err) {
      console.error('Failed to save offline mode:', err);
    }
  };

  // Handle detection model change
  const handleDetectionModelChange = async (model: DetectionModel) => {
    setDetectionModel(model);
    try {
      await updateSettings({ detection_model: model });
    } catch (err) {
      console.error('Failed to save detection model:', err);
    }
  };

  // Download model for offline use
  const handleDownloadModel = async () => {
    const variant = modelInfo?.variants.find(v => v.variant === selectedVariant);
    if (!variant?.available) return;

    setModelError(null);
    setDownloadProgress(0);

    try {
      const data = await downloadModel(selectedVariant, (loaded, total) => {
        if (total > 0) {
          setDownloadProgress(Math.round((loaded / total) * 100));
        }
      });

      await modelStorage.saveModel(data, modelInfo!.version, selectedVariant, variant.sha256);

      // Save variant preference to server
      await updateSettings({ model_variant: selectedVariant });

      const localInfo = await modelStorage.getModelInfo();
      setLocalModelInfo(localInfo);
      setDownloadProgress(null);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : 'Erreur de téléchargement');
      setDownloadProgress(null);
    }
  };

  // Delete local model
  const handleDeleteModel = async () => {
    try {
      await modelStorage.deleteModel();
      setLocalModelInfo(null);
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-white/60">Chargement...</div>
      </div>
    );
  }

  // Sort players for display
  const sortedPlayers = [...players].sort((a, b) => {
    switch (playerOrder) {
      case 'alphabetical':
        return a.name.localeCompare(b.name);
      case 'most_played':
        return b.games_count - a.games_count;
      case 'last_played':
        if (!a.last_played_at) return 1;
        if (!b.last_played_at) return -1;
        return new Date(b.last_played_at).getTime() - new Date(a.last_played_at).getTime();
      case 'manual': {
        const orderMap = new Map(manualOrder.map((id, i) => [id, i]));
        return (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999);
      }
      default:
        return 0;
    }
  });

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={() => setStep('landing')} className="text-white/60 hover:text-white">
          Retour
        </button>
        <h1 className="text-lg font-semibold text-white">Paramètres</h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Section: Joueurs */}
        <section className="p-4 border-b border-white/10">
          <h2 className="text-gold font-semibold mb-3">Joueurs</h2>
          <div className="space-y-2">
            {sortedPlayers.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 bg-dark-lighter rounded-xl"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{player.name}</div>
                  <div className="text-white/40 text-xs">
                    {player.games_count} partie{player.games_count !== 1 ? 's' : ''}
                  </div>
                </div>
                {playerOrder === 'manual' && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => movePlayer(player.id, 'up')}
                      disabled={idx === 0}
                      className="text-white/40 hover:text-white disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => movePlayer(player.id, 'down')}
                      disabled={idx === sortedPlayers.length - 1}
                      className="text-white/40 hover:text-white disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                )}
                <button
                  onClick={() => startEditPlayer(player)}
                  className="p-2 text-white/40 hover:text-white"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setDeletingPlayer(player)}
                  className="p-2 text-white/40 hover:text-red-400"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Jeu */}
        <section className="p-4 border-b border-white/10">
          <h2 className="text-gold font-semibold mb-3">Jeu</h2>

          {/* Ordre des joueurs */}
          <div>
            <div className="mb-2 text-white/60 text-sm">Ordre des joueurs</div>
            <div className="grid grid-cols-2 gap-2">
              {ORDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleOrderChange(opt.value)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all ${
                    playerOrder === opt.value
                      ? 'bg-gold text-dark'
                      : 'bg-dark-lighter text-white/70 hover:bg-dark-card'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Detection */}
        <section className="p-4 border-b border-white/10">
          <h2 className="text-gold font-semibold mb-3">Détection</h2>

          {/* Modèle serveur */}
          <div className="mb-4">
            <div className="mb-2 text-white/60 text-sm">Modèle</div>
            <div className="grid grid-cols-2 gap-2">
              {MODEL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleDetectionModelChange(opt.value)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all ${
                    detectionModel === opt.value
                      ? 'bg-gold text-dark'
                      : 'bg-dark-lighter text-white/70 hover:bg-dark-card'
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-2 text-white/40 text-xs">
              {MODEL_OPTIONS.find(o => o.value === detectionModel)?.description}
            </div>
          </div>

          {/* Mode offline */}
          <div className="mb-4">
            <div className="mb-2 text-white/60 text-sm">
              Mode offline <span className="text-red-400">(expérimental)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {OFFLINE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleOfflineModeChange(opt.value)}
                  disabled={opt.value !== 'never' && !localModelInfo}
                  className={`p-3 rounded-xl text-sm font-medium transition-all ${
                    offlineMode === opt.value
                      ? 'bg-gold text-dark'
                      : 'bg-dark-lighter text-white/70 hover:bg-dark-card disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model variant selection */}
          {modelInfo && modelInfo.variants.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-white/60 text-sm">Taille du modèle local</div>
              <div className="grid grid-cols-3 gap-2">
                {modelInfo.variants.map(variant => (
                  <button
                    key={variant.variant}
                    onClick={() => setSelectedVariant(variant.variant)}
                    disabled={!variant.available}
                    className={`p-2 rounded-xl text-xs font-medium transition-all ${
                      selectedVariant === variant.variant
                        ? 'bg-gold text-dark'
                        : 'bg-dark-lighter text-white/70 hover:bg-dark-card disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                    title={variant.description}
                  >
                    {variant.name.split(' ')[0]}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-white/40 text-xs">
                {modelInfo.variants.find(v => v.variant === selectedVariant)?.recommended_for}
              </div>
            </div>
          )}

          {/* Model status */}
          <div className="p-3 bg-dark-lighter rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-sm">Modèle local</span>
              {localModelInfo ? (
                <span className="text-green-400 text-xs">Disponible</span>
              ) : (
                <span className="text-white/40 text-xs">Non téléchargé</span>
              )}
            </div>

            {localModelInfo ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Version</span>
                  <span className="text-white/70">{localModelInfo.version}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Variante</span>
                  <span className="text-white/70">{localModelInfo.variant.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Téléchargé le</span>
                  <span className="text-white/70">
                    {new Date(localModelInfo.storedAt).toLocaleDateString()}
                  </span>
                </div>
                {modelInfo && (localModelInfo.version !== modelInfo.version || localModelInfo.variant !== selectedVariant) && (
                  <div className="text-orange-400 text-xs">
                    {localModelInfo.version !== modelInfo.version
                      ? `Nouvelle version disponible (${modelInfo.version})`
                      : `Variante différente sélectionnée (${selectedVariant.toUpperCase()})`}
                  </div >
                )}
                <div className="flex gap-2 mt-2">
                  {modelInfo && (localModelInfo.version !== modelInfo.version || localModelInfo.variant !== selectedVariant) && (
                    <button
                      onClick={handleDownloadModel}
                      disabled={downloadProgress !== null}
                      className="flex-1 p-2 bg-gold/20 text-gold rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      {downloadProgress !== null ? `${downloadProgress}%` : localModelInfo.variant !== selectedVariant ? 'Changer' : 'Mettre a jour'}
                    </button>
                  )}
                  <button
                    onClick={handleDeleteModel}
                    className="p-2 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {modelInfo?.variants.find(v => v.variant === selectedVariant)?.available ? (
                  <>
                    <div className="text-white/40 text-xs">
                      {modelInfo.variants.find(v => v.variant === selectedVariant)?.size_mb.toFixed(1)} MB - Version {modelInfo.version}
                    </div>
                    <button
                      onClick={handleDownloadModel}
                      disabled={downloadProgress !== null}
                      className="w-full p-2 bg-gold/20 text-gold rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {downloadProgress !== null
                        ? `Telechargement... ${downloadProgress}%`
                        : 'Telecharger le modele'}
                    </button>
                  </>
                ) : (
                  <div className="text-white/40 text-xs">
                    Modèle non disponible sur le serveur
                  </div>
                )}
                {modelError && (
                  <div className="text-red-400 text-xs">{modelError}</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Section: Données */}
        <section className="p-4 border-b border-white/10">
          <h2 className="text-gold font-semibold mb-3">Données</h2>
          <div className="space-y-2">
            <button
              onClick={() => {
                setLegacyMode(true);
                setStep('players');
              }}
              className="w-full p-3 bg-dark-lighter rounded-xl text-white/70 hover:bg-dark-card text-left"
            >
              Ajouter une partie manuellement
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('json')}
                disabled={exporting}
                className="flex-1 p-3 bg-dark-lighter rounded-xl text-white/70 hover:bg-dark-card disabled:opacity-50"
              >
                Exporter JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="flex-1 p-3 bg-dark-lighter rounded-xl text-white/70 hover:bg-dark-card disabled:opacity-50"
              >
                Exporter CSV
              </button>
            </div>
          </div>
        </section>

        {/* Section: À propos */}
        <section className="p-4">
          <h2 className="text-gold font-semibold mb-3">À propos</h2>
          <div className="space-y-2">
            <button
              onClick={() => setStep('license')}
              className="w-full p-3 bg-dark-lighter rounded-xl text-left hover:bg-dark-card"
            >
              <div className="text-white/40 text-xs">Version</div>
              <div className="text-white">{__APP_VERSION__}</div>
            </button>
            <button
              onClick={forceUpdate}
              className="w-full p-3 bg-dark-lighter rounded-xl text-white/70 hover:bg-dark-card text-left"
            >
              Forcer la mise à jour
            </button>
          </div>
        </section>
      </div>

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditingPlayer(null)} />
          <div className="relative w-full max-w-sm bg-dark-lighter rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Modifier le joueur</h3>

            <div className="mb-4">
              <label className="text-white/60 text-sm mb-1 block">Nom</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-3 bg-dark-card rounded-xl text-white border border-white/10 focus:border-gold focus:outline-none"
              />
            </div>

            <div className="mb-6">
              <label className="text-white/60 text-sm mb-2 block">Couleur</label>
              <div className="grid grid-cols-5 gap-2">
                {PLAYER_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setEditColor(color)}
                    className={`w-10 h-10 rounded-full ${editColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-lighter' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingPlayer(null)}
                className="flex-1 p-3 bg-dark-card rounded-xl text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={savePlayer}
                className="flex-1 p-3 bg-gold rounded-xl text-dark font-semibold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingPlayer}
        title="Supprimer le joueur ?"
        message={
          deleteError
            ? deleteError
            : deletingPlayer?.games_count && deletingPlayer.games_count > 0
            ? `${deletingPlayer.name} a ${deletingPlayer.games_count} partie(s) enregistrée(s) et ne peut pas être supprimé.`
            : `${deletingPlayer?.name} sera supprimé définitivement.`
        }
        confirmLabel={deletingPlayer?.games_count && deletingPlayer.games_count > 0 ? undefined : "Supprimer"}
        cancelLabel={deletingPlayer?.games_count && deletingPlayer.games_count > 0 ? "Fermer" : "Annuler"}
        onConfirm={deletingPlayer?.games_count && deletingPlayer.games_count > 0 ? undefined : confirmDeletePlayer}
        onCancel={() => { setDeletingPlayer(null); setDeleteError(null); }}
      />
    </div>
  );
}
