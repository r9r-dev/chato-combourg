/**
 * Simule des tours complets
 */

import type { PlayGameState, PlayCard, AILevel } from '../../../../types/play';
import { cloneState } from './clone';

/**
 * Simule le tour complet d'un joueur
 *
 * Utilise l'IA du joueur (ou l'IA temporaire si humain).
 */
export async function simulateTurn(
  state: PlayGameState,
  _cards: Map<string, PlayCard>,
  _referenceAILevel: AILevel = 'normal'
): Promise<PlayGameState> {
  // Clone l'etat pour ne pas affecter l'original
  const simState = cloneState(state);

  // TODO: Implementer la simulation de tour complet
  // Pour l'instant, retourne l'etat inchange

  return simState;
}

/**
 * Simule N tours complets (tous les joueurs jouent N fois)
 */
export async function simulateRounds(
  state: PlayGameState,
  rounds: number,
  cards: Map<string, PlayCard>,
  referenceAILevel: AILevel = 'normal'
): Promise<PlayGameState> {
  let currentState = cloneState(state);
  const playersCount = state.players.length;
  const totalTurns = rounds * playersCount;

  for (let i = 0; i < totalTurns; i++) {
    currentState = await simulateTurn(currentState, cards, referenceAILevel);

    // Verifier si la partie est terminee
    if (currentState.phase === 'ended') {
      break;
    }
  }

  return currentState;
}

/**
 * Simule jusqu'a la fin de la partie
 */
export async function simulateToEnd(
  state: PlayGameState,
  cards: Map<string, PlayCard>,
  referenceAILevel: AILevel = 'normal'
): Promise<PlayGameState> {
  let currentState = cloneState(state);
  const maxIterations = 100; // Securite anti-boucle infinie
  let iterations = 0;

  while (currentState.phase !== 'ended' && iterations < maxIterations) {
    currentState = await simulateTurn(currentState, cards, referenceAILevel);
    iterations++;
  }

  if (iterations >= maxIterations) {
    console.warn('[Simulator] Max iterations reached, stopping simulation');
  }

  return currentState;
}

/**
 * Prepare un etat pour la simulation
 * Remplace les humains par des IA temporaires
 */
export function prepareSimulation(
  state: PlayGameState,
  referenceAILevel: AILevel = 'normal'
): PlayGameState {
  const simState = cloneState(state);

  // Marquer tous les humains comme IA temporaires
  simState.players = simState.players.map(player => {
    if (!player.isAI) {
      return {
        ...player,
        isAI: true,
        aiLevel: referenceAILevel,
      };
    }
    return player;
  });

  return simState;
}
