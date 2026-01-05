/**
 * Algorithme Minimax avec elagage Alpha-Beta
 *
 * Anticipe les reponses des adversaires.
 */

import type { GameAction, PlayCard } from '../../../../types/play';
import type { ActionTree, ActionNode } from '../types';
import { evaluateState } from '../evaluator/scorer';

/**
 * Selectionne la meilleure action avec Minimax + Alpha-Beta
 */
export function minimaxSelect(
  tree: ActionTree,
  depth: number,
  cards: Map<string, PlayCard>
): GameAction | null {
  if (tree.root.children.length === 0) return null;

  let bestAction: GameAction | null = null;
  let bestScore = -Infinity;
  const alpha = -Infinity;
  const beta = Infinity;

  for (const child of tree.root.children) {
    const score = minimax(child, depth - 1, alpha, beta, false, tree.playerId, cards);

    if (score > bestScore) {
      bestScore = score;
      bestAction = child.action;
    }
  }

  return bestAction;
}

/**
 * Algorithme Minimax recursif avec elagage Alpha-Beta
 */
function minimax(
  node: ActionNode,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  playerId: string,
  cards: Map<string, PlayCard>
): number {
  // Cas terminal
  if (depth === 0 || node.isTerminal || node.children.length === 0) {
    return evaluate(node, playerId, cards);
  }

  if (isMaximizing) {
    // Mon tour : je maximise
    let maxEval = -Infinity;
    let currentAlpha = alpha;

    for (const child of node.children) {
      const evalScore = minimax(child, depth - 1, currentAlpha, beta, false, playerId, cards);
      maxEval = Math.max(maxEval, evalScore);
      currentAlpha = Math.max(currentAlpha, evalScore);

      // Elagage Beta
      if (beta <= currentAlpha) break;
    }

    return maxEval;
  } else {
    // Tour adversaire : il minimise mon score
    let minEval = Infinity;
    let currentBeta = beta;

    for (const child of node.children) {
      const evalScore = minimax(child, depth - 1, alpha, currentBeta, true, playerId, cards);
      minEval = Math.min(minEval, evalScore);
      currentBeta = Math.min(currentBeta, evalScore);

      // Elagage Alpha
      if (currentBeta <= alpha) break;
    }

    return minEval;
  }
}

/**
 * Evalue un noeud
 */
function evaluate(
  node: ActionNode,
  playerId: string,
  cards: Map<string, PlayCard>
): number {
  // Utiliser le score cache si disponible
  if (node.score !== undefined) {
    return node.score;
  }

  // Construire un etat fictif pour l'evaluation
  const state = {
    players: node.contextAfter.players,
    currentPlayerIndex: 0,
    turnNumber: node.contextAfter.turnNumber,
    turnPhase: node.contextAfter.turnPhase,
    keyUsedThisTurn: node.contextAfter.keyUsedThisTurn,
    lockUsedThisTurn: node.contextAfter.lockUsedThisTurn,
    purchasedCard: node.contextAfter.purchasedCard,
    purchasedCardCost: 0,
    board: node.contextAfter.board,
    actionHistory: [],
    phase: 'playing' as const,
    gameId: 'minimax',
  };

  const score = evaluateState(state, playerId, cards);
  node.score = score; // Cache pour eviter les recalculs
  return score;
}
