/**
 * Execute des actions sur un etat clone
 *
 * Wrapper autour du gameEngine pour la simulation.
 */

import type { PlayGameState, GameAction } from '../../../../types/play';
import { executeAction } from '../../gameEngine';

/**
 * Execute une action sur un etat clone (simulation)
 *
 * @param state Etat clone (sera modifie)
 * @param action Action a executer
 * @returns Nouvel etat apres l'action
 */
export function executeSimulatedAction(
  state: PlayGameState,
  action: GameAction
): PlayGameState {
  // Le gameEngine modifie l'etat en place et le retourne
  // Comme on travaille sur un clone, c'est sans danger
  return executeAction(state, action);
}

/**
 * Verifie si une action est valide dans un etat donne
 */
export function isActionValid(
  state: PlayGameState,
  action: GameAction
): boolean {
  // TODO: Implementer la validation complete
  // Pour l'instant, on fait confiance au gameEngine qui valide en interne
  const player = state.players[state.currentPlayerIndex];

  if (action.playerId !== player.id) {
    return false;
  }

  return true;
}
