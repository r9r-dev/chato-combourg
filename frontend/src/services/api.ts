import type {
  AnalyzeResponse,
  CalculateRequest,
  CalculateResponse,
  Card,
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
