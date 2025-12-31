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
  PlayerWithStats,
  FinalizeRequest,
  FinalizeResponse,
} from '../types';

const API_BASE = '/api';

export async function analyzeImage(imageBlob: Blob): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('photo', imageBlob, 'capture.jpg');

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analyze failed: ${response.statusText}`);
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
    throw new Error(`Calculate failed: ${response.statusText}`);
  }

  return response.json();
}

export async function getCards(): Promise<Card[]> {
  const response = await fetch(`${API_BASE}/cards`);

  if (!response.ok) {
    throw new Error(`Get cards failed: ${response.statusText}`);
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
    throw new Error(`Get user failed: ${response.statusText}`);
  }
  return response.json();
}

// Players API
export async function getPlayers(): Promise<Player[]> {
  const response = await fetch(`${API_BASE}/players`);
  if (!response.ok) {
    throw new Error(`Get players failed: ${response.statusText}`);
  }
  return response.json();
}

export async function createPlayer(name: string): Promise<Player> {
  const response = await fetch(`${API_BASE}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`Create player failed: ${response.statusText}`);
  }
  return response.json();
}

export async function deletePlayer(playerId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/players/${playerId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Delete player failed: ${response.statusText}`);
  }
}

// Games API
export async function getGames(limit = 20, offset = 0): Promise<GameListItem[]> {
  const response = await fetch(`${API_BASE}/games?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Get games failed: ${response.statusText}`);
  }
  return response.json();
}

export async function getGame(gameId: number): Promise<GameDetail> {
  const response = await fetch(`${API_BASE}/games/${gameId}`);
  if (!response.ok) {
    throw new Error(`Get game failed: ${response.statusText}`);
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
    throw new Error(`Create game failed: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteGame(gameId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/games/${gameId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Delete game failed: ${response.statusText}`);
  }
}

// Players with stats
export async function getPlayersWithStats(): Promise<PlayerWithStats[]> {
  const response = await fetch(`${API_BASE}/players?with_stats=true`);
  if (!response.ok) {
    throw new Error(`Get players failed: ${response.statusText}`);
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
    throw new Error(`Update player failed: ${response.statusText}`);
  }
  return response.json();
}

// Settings
export async function getSettings(): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/settings`);
  if (!response.ok) {
    throw new Error(`Get settings failed: ${response.statusText}`);
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
    throw new Error(`Update settings failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.settings;
}

// Export games
export async function exportGames(format: 'json' | 'csv'): Promise<Blob> {
  const response = await fetch(`${API_BASE}/games/export?format=${format}`);
  if (!response.ok) {
    throw new Error(`Export games failed: ${response.statusText}`);
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
    throw new Error(`Create manual game failed: ${response.statusText}`);
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
