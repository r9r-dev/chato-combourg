/**
 * Calcul du score d'un etat ou d'une action
 */

import type { PlayGameState, PlayPlayer, PlayCard } from '../../../../types/play';
import type { ActionNode } from '../types';
import { getTotalCoins, estimateScore } from '../context/helpers';
import { ScoreCache } from './cache';

// Cache global des scores
const scoreCache = new ScoreCache();

/**
 * Evalue le score d'un joueur dans un etat donne
 *
 * Utilise le cache si disponible, sinon calcule une estimation.
 * Pour un score exact, utiliser l'API /api/calculate.
 */
export function evaluateState(
  state: PlayGameState,
  playerId: string,
  cards: Map<string, PlayCard>,
  useCache: boolean = true
): number {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 0;

  // Verifier le cache
  if (useCache) {
    const cacheKey = getCacheKey(player);
    const cached = scoreCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  // Calculer le score estime
  const score = estimateScore(player, cards);

  // Mettre en cache
  if (useCache) {
    const cacheKey = getCacheKey(player);
    scoreCache.set(cacheKey, score);
  }

  return score;
}

/**
 * Evalue une action (score resultant)
 */
export function evaluateAction(
  node: ActionNode,
  playerId: string,
  cards: Map<string, PlayCard>
): number {
  const player = node.contextAfter.players.find(p => p.id === playerId);
  if (!player) return 0;

  return estimateScore(player, cards);
}

/**
 * Evalue tous les joueurs dans un etat
 */
export function evaluateAll(
  state: PlayGameState,
  cards: Map<string, PlayCard>
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const player of state.players) {
    scores.set(player.id, evaluateState(state, player.id, cards));
  }

  return scores;
}

/**
 * Calcule la cle de cache pour un joueur
 */
function getCacheKey(player: PlayPlayer): string {
  const cardIds = player.board.map(p => p?.cardId ?? 'X').join('-');
  const coins = getTotalCoins(player);
  return `${cardIds}-${player.keys}-${coins}`;
}

/**
 * Calcul du score exact via l'API (async)
 *
 * A utiliser pour les decisions finales importantes.
 */
export async function calculateExactScore(
  player: PlayPlayer,
  cards: Map<string, PlayCard>
): Promise<number> {
  try {
    // Construire les donnees pour l'API
    const cardsData = player.board.map(placed => {
      if (!placed) return null;
      return placed.cardId;
    });

    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cards: cardsData.filter(c => c !== null),
        keys: player.keys,
        coins: getTotalCoins(player),
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.total_score ?? 0;
  } catch (error) {
    console.error('[Evaluator] Failed to calculate exact score:', error);
    // Fallback sur l'estimation
    return estimateScore(player, cards);
  }
}

/**
 * Vide le cache des scores
 */
export function clearScoreCache(): void {
  scoreCache.clear();
}
