/**
 * Simulation pour MCTS
 *
 * Gere :
 * - Le clonage profond de l'etat du jeu
 * - La generation des actions possibles
 * - Le rollout (simulation jusqu'a N tours)
 */

import type {
  PlayGameState,
  PlayPlayer,
  CentralBoard,
  PlacedCard,
  ShiftDirection,
} from '../../../../types/play';
import {
  getValidPlacements,
  getExternalZones,
} from '../../../../types/play';
import {
  executeAction,
  getAvailableCards,
  canAffordCard,
  refillLocations,
} from '../../gameEngine';
import { NormalAI } from '../normalAI';

// =============================================================================
// Types pour les actions MCTS
// =============================================================================

export interface MCTSAction {
  type: 'buy' | 'buy_flipped';
  cardId: string;
  position: number;
  shiftDirection?: ShiftDirection;
}

// =============================================================================
// Clonage profond de l'etat
// =============================================================================

/**
 * Clone profondement l'etat du jeu pour la simulation
 */
export function cloneState(state: PlayGameState): PlayGameState {
  return {
    gameId: state.gameId,
    phase: state.phase,
    players: state.players.map(clonePlayer),
    currentPlayerIndex: state.currentPlayerIndex,
    turnNumber: state.turnNumber,
    turnPhase: state.turnPhase,
    keyUsedThisTurn: state.keyUsedThisTurn,
    lockUsedThisTurn: state.lockUsedThisTurn,
    purchasedCard: state.purchasedCard,
    purchasedCardCost: state.purchasedCardCost,
    board: cloneCentralBoard(state.board),
    actionHistory: [], // On ne garde pas l'historique pour la simulation
  };
}

function clonePlayer(player: PlayPlayer): PlayPlayer {
  return {
    ...player,
    board: player.board.map(card => card ? { ...card } : null),
    lockedCards: new Map(player.lockedCards),
  };
}

function cloneCentralBoard(board: CentralBoard): CentralBoard {
  return {
    castleCards: [...board.castleCards],
    villageCards: [...board.villageCards],
    messengerLocation: board.messengerLocation,
    castleDeck: [...board.castleDeck],
    villageDeck: [...board.villageDeck],
    castleDiscard: [...board.castleDiscard],
    villageDiscard: [...board.villageDiscard],
  };
}

// =============================================================================
// Generation des actions possibles
// =============================================================================

/**
 * Genere toutes les actions possibles pour le joueur courant
 * Combine : (carte a acheter) x (position de placement avec/sans shift)
 */
export function generateActions(state: PlayGameState): MCTSAction[] {
  const player = state.players[state.currentPlayerIndex];
  const availableCards = getAvailableCards(state);
  const actions: MCTSAction[] = [];

  // Pour chaque carte disponible
  for (const cardId of availableCards) {
    const { canAfford } = canAffordCard(player, cardId);

    // Achat normal (si abordable)
    if (canAfford) {
      const placements = generatePlacements(player.board);
      for (const placement of placements) {
        actions.push({
          type: 'buy',
          cardId,
          position: placement.position,
          shiftDirection: placement.shiftDirection,
        });
      }
    }

    // Achat face cachee (toujours possible)
    const placements = generatePlacements(player.board);
    for (const placement of placements) {
      actions.push({
        type: 'buy_flipped',
        cardId,
        position: placement.position,
        shiftDirection: placement.shiftDirection,
      });
    }
  }

  return actions;
}

interface PlacementOption {
  position: number;
  shiftDirection?: ShiftDirection;
}

/**
 * Genere toutes les options de placement (avec et sans shift)
 * Inclut les zones externes (hors grille actuelle) avec decalage
 */
function generatePlacements(board: (PlacedCard | null)[]): PlacementOption[] {
  const placements: PlacementOption[] = [];

  // Placements directs (sans shift) - positions adjacentes aux cartes existantes
  const directPositions = getValidPlacements(board);
  for (const position of directPositions) {
    placements.push({ position });
  }

  // Placements externes avec shift (hors de la grille actuelle)
  // Ex: placer a gauche de la colonne 0 en decalant tout vers la droite
  const externalZones = getExternalZones(board);
  for (const zone of externalZones) {
    placements.push({
      position: zone.position,
      shiftDirection: zone.shiftDirection,
    });
  }

  return placements;
}

// =============================================================================
// Execution d'une action MCTS
// =============================================================================

/**
 * Execute une action MCTS et retourne le nouvel etat
 * Gere tout le tour : achat -> placement -> effet -> fin de tour
 */
export function executeSimulatedAction(
  state: PlayGameState,
  action: MCTSAction,
  normalAI: NormalAI
): PlayGameState {
  let newState = cloneState(state);
  const player = newState.players[newState.currentPlayerIndex];

  // 1. Phase pre_action : utiliser une cle ? (delegue a NormalAI)
  if (newState.turnPhase === 'pre_action' && player.keys > 0) {
    const keyAction = normalAI.selectKeyAction(newState);
    if (keyAction) {
      newState = executeAction(newState, {
        type: 'spend_key',
        playerId: player.id,
        targetLocation: keyAction.targetLocation,
      });
    }
  }

  // 2. Passer en phase buy si necessaire
  if (newState.turnPhase === 'pre_action') {
    newState = { ...newState, turnPhase: 'buy' };
  }

  // 3. Acheter la carte
  newState = executeAction(newState, {
    type: action.type === 'buy' ? 'buy_card' : 'buy_card_flipped',
    playerId: player.id,
    cardId: action.cardId,
  });

  // 4. Placer la carte
  newState = executeAction(newState, {
    type: 'place_card',
    playerId: player.id,
    position: action.position,
    shiftDirection: action.shiftDirection,
  });

  // 5. Appliquer les effets (simplifie pour la simulation)
  // On skip les effets complexes et on passe directement a post_action
  newState = { ...newState, turnPhase: 'post_action' };

  // 6. Phase post_action : utiliser un cadenas ? (delegue a NormalAI)
  const updatedPlayer = newState.players[newState.currentPlayerIndex];
  const availableLocks = getAvailableLocks(updatedPlayer);
  if (availableLocks.length > 0 && updatedPlayer.keys > 0) {
    const lockPosition = normalAI.selectLockAction(newState, availableLocks);
    if (lockPosition !== null) {
      newState = executeAction(newState, {
        type: 'use_key_on_lock',
        playerId: player.id,
        lockPosition,
      });
    }
  }

  // 7. Fin du tour
  newState = executeAction(newState, {
    type: 'end_turn',
    playerId: player.id,
  });

  // 8. Refill des lieux
  newState = {
    ...newState,
    board: refillLocations(newState.board),
  };

  return newState;
}

/**
 * Retourne les positions des cadenas disponibles
 */
function getAvailableLocks(player: PlayPlayer): number[] {
  const locks: number[] = [];
  for (const [position, hasKey] of player.lockedCards) {
    if (hasKey) {
      locks.push(position);
    }
  }
  return locks;
}

// =============================================================================
// Rollout (simulation jusqu'a N tours)
// =============================================================================

/**
 * Simule la partie pendant N tours avec des coups aleatoires guides
 */
export function rollout(
  state: PlayGameState,
  maxTurns: number,
  normalAI: NormalAI
): PlayGameState {
  let currentState = cloneState(state);
  let turnsSimulated = 0;

  // Simuler jusqu'a maxTurns ou fin de partie
  while (
    currentState.phase !== 'ended' &&
    turnsSimulated < maxTurns * currentState.players.length
  ) {
    // Generer les actions possibles
    const actions = generateActions(currentState);

    if (actions.length === 0) {
      // Pas d'action possible, forcer fin de tour
      break;
    }

    // Choisir une action (guidee par heuristique simple)
    const action = selectRolloutAction(currentState, actions, normalAI);

    // Executer l'action
    currentState = executeSimulatedAction(currentState, action, normalAI);
    turnsSimulated++;
  }

  return currentState;
}

/**
 * Selectionne une action pour le rollout
 * Utilise une heuristique simple plutot qu'un choix purement aleatoire
 */
function selectRolloutAction(
  state: PlayGameState,
  actions: MCTSAction[],
  normalAI: NormalAI
): MCTSAction {
  // Utiliser l'IA normale pour choisir la carte
  const availableCards = getAvailableCards(state);
  const buyDecision = normalAI.selectBuyAction(state, availableCards);

  // Filtrer les actions qui correspondent a ce choix
  const matchingType = buyDecision.flipped ? 'buy_flipped' : 'buy';
  const matchingActions = actions.filter(
    a => a.cardId === buyDecision.cardId && a.type === matchingType
  );

  if (matchingActions.length > 0) {
    // Utiliser l'IA normale pour choisir la position
    const validPositions = matchingActions.map(a => a.position);
    const bestPosition = normalAI.selectPlaceAction(
      state,
      buyDecision.cardId,
      validPositions
    );

    const bestAction = matchingActions.find(a => a.position === bestPosition);
    if (bestAction) return bestAction;

    // Fallback : premiere action correspondante
    return matchingActions[0];
  }

  // Fallback : action aleatoire
  return actions[Math.floor(Math.random() * actions.length)];
}

// =============================================================================
// Utilitaires
// =============================================================================

/**
 * Compte le nombre de cartes placees par un joueur
 */
export function getCardCount(player: PlayPlayer): number {
  return player.board.filter(c => c !== null).length;
}

/**
 * Verifie si la partie est terminee
 */
export function isGameOver(state: PlayGameState): boolean {
  return state.phase === 'ended';
}
