import type {
  AnalyzeResponse,
  CalculateRequest,
  CalculateResponse,
  Card,
  User,
  Player,
  GameListItem,
  GameDetail,
  GameCreate,
  LegacyGameCreate,
  PlayerWithStats,
  PlayerWithFullStats,
  Statistics,
  FinalizeRequest,
  FinalizeResponse,
} from '../types';

const API_BASE = '/api';

// =============================================================================
// API Error Handling
// =============================================================================

/**
 * Erreur API avec code et détail extraits de la réponse.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  /** Vérifie si c'est une erreur de ressource non trouvée */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Vérifie si c'est une erreur d'authentification */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Vérifie si c'est une erreur de validation */
  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

/**
 * Parse une réponse d'erreur API et lève une ApiError.
 */
async function handleApiError(response: Response, fallbackMessage: string): Promise<never> {
  let code = 'UNKNOWN_ERROR';
  let detail = fallbackMessage;

  try {
    const data = await response.json();
    if (data.code) code = data.code;
    if (data.detail) detail = data.detail;
  } catch {
    // Si le parsing JSON échoue, utiliser le message par défaut
    detail = response.statusText || fallbackMessage;
  }

  throw new ApiError(response.status, code, detail);
}

// =============================================================================
// API Functions
// =============================================================================

export async function analyzeImage(imageBlob: Blob): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('photo', imageBlob, 'capture.jpg');

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    await handleApiError(response, "Erreur lors de l'analyse");
  }

  return response.json();
}

export async function calculateScore(
  request: CalculateRequest
): Promise<CalculateResponse> {
  const response = await fetch(`${API_BASE}/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du calcul du score');
  }

  return response.json();
}

export async function getCards(): Promise<Card[]> {
  const response = await fetch(`${API_BASE}/cards`);

  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des cartes');
  }

  const data = await response.json();
  return data.cards;
}

export function getCardImageUrl(cardId: string): string {
  return `/cards/thumbs/carte_${cardId}.webp`;
}

export function preloadCardImages(): Promise<void[]> {
  // Preload all 92 card thumbnails (~1.4 MB total)
  const promises: Promise<void>[] = [];
  for (let i = 1; i <= 92; i++) {
    const cardId = i.toString().padStart(3, '0');
    const url = getCardImageUrl(cardId);
    promises.push(
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Don't fail on missing images
        img.src = url;
      })
    );
  }
  return Promise.all(promises);
}

// User API
export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE}/me`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement du profil');
  }
  return response.json();
}

// Players API
export async function getPlayers(): Promise<Player[]> {
  const response = await fetch(`${API_BASE}/players`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des joueurs');
  }
  return response.json();
}

export async function createPlayer(name: string, is_ai: boolean = false): Promise<Player> {
  const response = await fetch(`${API_BASE}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, is_ai }),
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la création du joueur');
  }
  return response.json();
}

export async function deletePlayer(playerId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/players/${playerId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la suppression du joueur');
  }
}

// Games API
export async function getGames(
  limit = 20,
  offset = 0,
  playerId?: number
): Promise<GameListItem[]> {
  let url = `${API_BASE}/games?limit=${limit}&offset=${offset}`;
  if (playerId !== undefined) {
    url += `&player_id=${playerId}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des parties');
  }
  return response.json();
}

export async function getGame(gameId: number): Promise<GameDetail> {
  const response = await fetch(`${API_BASE}/games/${gameId}`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement de la partie');
  }
  return response.json();
}

export async function createGame(data: GameCreate): Promise<GameDetail> {
  const response = await fetch(`${API_BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la sauvegarde de la partie');
  }
  return response.json();
}

export async function createLegacyGame(data: LegacyGameCreate): Promise<GameDetail> {
  const response = await fetch(`${API_BASE}/games/legacy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la sauvegarde de la partie');
  }
  return response.json();
}

export async function deleteGame(gameId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/games/${gameId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la suppression de la partie');
  }
}

// Players with stats
export async function getPlayersWithStats(): Promise<PlayerWithStats[]> {
  const response = await fetch(`${API_BASE}/players?with_stats=true`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des joueurs');
  }
  return response.json();
}

// Players with full stats (includes wins_count and win_percentage)
export async function getPlayersWithFullStats(): Promise<PlayerWithFullStats[]> {
  const response = await fetch(`${API_BASE}/players?with_stats=true`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des joueurs');
  }
  return response.json();
}

// Statistics
export async function getStatistics(): Promise<Statistics> {
  const response = await fetch(`${API_BASE}/statistics`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des statistiques');
  }
  return response.json();
}

export async function updatePlayer(playerId: number, data: { name?: string; color?: string }): Promise<Player> {
  const response = await fetch(`${API_BASE}/players/${playerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la mise à jour du joueur');
  }
  return response.json();
}

// Settings
export async function getSettings(): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/settings`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des paramètres');
  }
  const data = await response.json();
  return data.settings;
}

export async function updateSettings(settings: Record<string, string | null>): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la mise à jour des paramètres');
  }
  const data = await response.json();
  return data.settings;
}

// Export games
export async function exportGames(format: 'json' | 'csv'): Promise<Blob> {
  const response = await fetch(`${API_BASE}/games/export?format=${format}`);
  if (!response.ok) {
    await handleApiError(response, "Erreur lors de l'export des parties");
  }
  return response.blob();
}

// Manual game creation (simplified)
export interface ManualGamePlayer {
  player_id: number;
  score: number;
}

export interface ManualGameCreate {
  players: ManualGamePlayer[];
  played_at?: string;
  notes?: string;
}

export async function createManualGame(data: ManualGameCreate): Promise<GameDetail> {
  const response = await fetch(`${API_BASE}/games/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la sauvegarde de la partie');
  }
  return response.json();
}

// Capture finalization (for training data collection)
export async function finalizeCapture(
  captureId: string,
  request: FinalizeRequest
): Promise<FinalizeResponse> {
  const response = await fetch(`${API_BASE}/captures/${captureId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    // Don't throw - capture finalization is non-critical
    console.warn(`Finalize capture failed: ${response.statusText}`);
    return { success: false, message: response.statusText };
  }
  return response.json();
}

// Delete pending capture (when user quits without validating)
export async function deleteCapture(captureId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/captures/${captureId}`, {
      method: 'DELETE',
    });
  } catch {
    // Ignore errors - cleanup is non-critical
    console.warn(`Delete capture failed for ${captureId}`);
  }
}

// Model API for offline inference
export interface ModelVariantInfo {
  variant: string;
  name: string;
  description: string;
  recommended_for: string;
  size_mb: number;
  sha256: string;
  available: boolean;
}

export interface ModelInfo {
  version: string;
  format: string;
  input_size: number;
  num_classes: number;
  default_variant: string;
  variants: ModelVariantInfo[];
}

export interface ServerHealth {
  status: string;
  inference: {
    framework: string;
    available: string[];
  };
  cpu: string;
}

export async function getServerHealth(): Promise<ServerHealth> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors de la vérification du serveur');
  }
  return response.json();
}

export async function getModelInfo(): Promise<ModelInfo> {
  const response = await fetch(`${API_BASE}/model/info`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du chargement des informations du modèle');
  }
  return response.json();
}

export async function downloadModel(
  variant: string = 'fp16',
  onProgress?: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(`${API_BASE}/model/download?variant=${variant}`);
  if (!response.ok) {
    await handleApiError(response, 'Erreur lors du téléchargement du modèle');
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    return response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }

  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  return buffer.buffer;
}
