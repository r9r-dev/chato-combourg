/**
 * Algorithme glouton (Greedy)
 *
 * Choisit l'action qui mene a la meilleure feuille.
 * Simple et rapide, mais ne considere pas les adversaires.
 */

import type { GameAction, PlayCard } from '../../../../types/play';
import type { ActionTree, ActionNode } from '../types';
import { getLeaves, getLevel1Actions } from '../tree/traverser';
import { evaluateState } from '../evaluator/scorer';

/**
 * Selectionne la meilleure action avec l'algorithme glouton
 */
export function greedySelect(
  tree: ActionTree,
  cards: Map<string, PlayCard>
): GameAction | null {
  // Evaluer toutes les feuilles
  evaluateAllLeaves(tree, cards);

  // Trouver la meilleure feuille
  const leaves = getLeaves(tree.root);
  if (leaves.length === 0) return null;

  let bestLeaf = leaves[0];
  let bestScore = bestLeaf.score ?? -Infinity;

  for (const leaf of leaves) {
    const score = leaf.score ?? -Infinity;
    if (score > bestScore) {
      bestScore = score;
      bestLeaf = leaf;
    }
  }

  // Remonter pour trouver l'action de niveau 1
  return getActionLeadingTo(tree, bestLeaf);
}

/**
 * Selectionne parmi les N meilleures actions (pour ajouter de l'aleatoire)
 */
export function greedySelectTopN(
  tree: ActionTree,
  n: number,
  cards: Map<string, PlayCard>
): GameAction | null {
  // Evaluer toutes les feuilles
  evaluateAllLeaves(tree, cards);

  // Trier les feuilles par score
  const leaves = getLeaves(tree.root);
  leaves.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));

  // Prendre au hasard parmi les N meilleures
  const topN = leaves.slice(0, Math.min(n, leaves.length));
  if (topN.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * topN.length);
  const selectedLeaf = topN[randomIndex];

  return getActionLeadingTo(tree, selectedLeaf);
}

/**
 * Evalue toutes les feuilles de l'arbre
 */
function evaluateAllLeaves(tree: ActionTree, cards: Map<string, PlayCard>): void {
  const leaves = getLeaves(tree.root);

  for (const leaf of leaves) {
    if (leaf.score === undefined) {
      // Construire un etat fictif pour l'evaluation
      const state = {
        players: leaf.contextAfter.players,
        currentPlayerIndex: 0,
        turnNumber: leaf.contextAfter.turnNumber,
        turnPhase: leaf.contextAfter.turnPhase,
        keyUsedThisTurn: leaf.contextAfter.keyUsedThisTurn,
        lockUsedThisTurn: leaf.contextAfter.lockUsedThisTurn,
        purchasedCard: leaf.contextAfter.purchasedCard,
        purchasedCardCost: 0,
        board: leaf.contextAfter.board,
        actionHistory: [],
        phase: 'playing' as const,
        gameId: 'eval',
      };

      leaf.score = evaluateState(state, tree.playerId, cards);
    }
  }
}

/**
 * Trouve l'action de niveau 1 qui mene a une feuille
 */
function getActionLeadingTo(tree: ActionTree, leaf: ActionNode): GameAction | null {
  // Parcourir les enfants de niveau 1 et chercher celui qui contient la feuille
  for (const level1Node of tree.root.children) {
    if (containsNode(level1Node, leaf)) {
      return level1Node.action;
    }
  }

  // Fallback: prendre l'action du meilleur enfant de niveau 1
  const level1Actions = getLevel1Actions(tree);
  if (level1Actions.length === 0) return null;

  // Evaluer les actions de niveau 1
  let bestNode = level1Actions[0];
  let bestScore = getBestScoreInSubtree(bestNode);

  for (const node of level1Actions) {
    const score = getBestScoreInSubtree(node);
    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode.action;
}

/**
 * Verifie si un noeud contient une feuille (ou est la feuille)
 */
function containsNode(node: ActionNode, target: ActionNode): boolean {
  if (node.id === target.id) return true;

  for (const child of node.children) {
    if (containsNode(child, target)) return true;
  }

  return false;
}

/**
 * Retourne le meilleur score dans un sous-arbre
 */
function getBestScoreInSubtree(node: ActionNode): number {
  if (node.children.length === 0) {
    return node.score ?? -Infinity;
  }

  let best = node.score ?? -Infinity;
  for (const child of node.children) {
    const childBest = getBestScoreInSubtree(child);
    if (childBest > best) {
      best = childBest;
    }
  }

  return best;
}
