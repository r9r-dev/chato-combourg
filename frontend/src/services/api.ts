import type {
  AnalyzeResponse,
  CalculateRequest,
  CalculateResponse,
  Card,
} from '../types';

const API_BASE = '/api';

export async function analyzeImage(imageBlob: Blob): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'capture.jpg');

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

  return response.json();
}

export function getCardImageUrl(cardId: string): string {
  return `/cards/carte_${cardId}.png`;
}
