/**
 * Elagage de l'arbre de decisions
 */

import type { ActionNode, ActionTree } from '../types';

/**
 * Elague l'arbre selon plusieurs criteres
 */
export function pruneTree(
  tree: ActionTree,
  options: {
    minScore?: number;
    maxCost?: number;
    keepTopN?: number;
  } = {}
): void {
  if (options.minScore !== undefined) {
    pruneByScore(tree.root, options.minScore);
  }

  if (options.maxCost !== undefined) {
    pruneByCost(tree.root, options.maxCost);
  }

  if (options.keepTopN !== undefined) {
    pruneKeepTopN(tree.root, options.keepTopN);
  }
}

/**
 * Supprime les branches avec un score trop bas
 */
export function pruneByScore(node: ActionNode, minScore: number): void {
  node.children = node.children.filter(child => {
    // Garder si le score est suffisant ou si pas encore evalue
    return child.score === undefined || child.score >= minScore;
  });

  // Recursion
  for (const child of node.children) {
    pruneByScore(child, minScore);
  }
}

/**
 * Supprime les branches trop couteuses en or
 */
export function pruneByCost(node: ActionNode, maxGoldLoss: number): void {
  node.children = node.children.filter(child => {
    // Garder si la perte d'or est acceptable
    return child.consequences.goldDelta >= -maxGoldLoss;
  });

  // Recursion
  for (const child of node.children) {
    pruneByCost(child, maxGoldLoss);
  }
}

/**
 * Garde uniquement les N meilleurs enfants de chaque noeud
 */
export function pruneKeepTopN(node: ActionNode, n: number): void {
  if (node.children.length > n) {
    // Trier par score (les non-evalues a la fin)
    node.children.sort((a, b) => {
      const scoreA = a.score ?? -Infinity;
      const scoreB = b.score ?? -Infinity;
      return scoreB - scoreA;
    });

    // Garder les N premiers
    node.children = node.children.slice(0, n);
  }

  // Recursion
  for (const child of node.children) {
    pruneKeepTopN(child, n);
  }
}

/**
 * Supprime les branches similaires (meme score, meme configuration)
 */
export function pruneDuplicates(node: ActionNode): void {
  const seen = new Set<string>();

  node.children = node.children.filter(child => {
    const key = getNodeSignature(child);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // Recursion
  for (const child of node.children) {
    pruneDuplicates(child);
  }
}

/**
 * Cree une signature unique pour un noeud
 */
function getNodeSignature(node: ActionNode): string {
  const action = node.action;
  if (!action) return 'root';

  const parts = [
    action.type,
    action.cardId ?? '',
    action.position?.toString() ?? '',
    action.targetLocation ?? '',
    node.score?.toFixed(2) ?? 'na',
  ];

  return parts.join('|');
}

/**
 * Compte les noeuds apres elagage
 */
export function countRemainingNodes(node: ActionNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countRemainingNodes(child);
  }
  return count;
}
