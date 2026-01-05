/**
 * Parcours de l'arbre de decisions
 */

import type { ActionNode, ActionTree } from '../types';
import type { GameAction } from '../../../../types/play';

/**
 * Parcourt l'arbre et applique une fonction a chaque noeud
 */
export function traverseTree(
  node: ActionNode,
  callback: (node: ActionNode) => void
): void {
  callback(node);

  for (const child of node.children) {
    traverseTree(child, callback);
  }
}

/**
 * Retourne toutes les feuilles de l'arbre
 */
export function getLeaves(node: ActionNode): ActionNode[] {
  if (node.children.length === 0 || node.isTerminal) {
    return [node];
  }

  const leaves: ActionNode[] = [];
  for (const child of node.children) {
    leaves.push(...getLeaves(child));
  }

  return leaves;
}

/**
 * Retourne la meilleure feuille (score le plus haut)
 */
export function getBestLeaf(tree: ActionTree): ActionNode | null {
  const leaves = getLeaves(tree.root);

  if (leaves.length === 0) return null;

  let best = leaves[0];
  let bestScore = best.score ?? -Infinity;

  for (const leaf of leaves) {
    const score = leaf.score ?? -Infinity;
    if (score > bestScore) {
      bestScore = score;
      best = leaf;
    }
  }

  return best;
}

/**
 * Remonte de la feuille a la racine pour obtenir la premiere action
 */
export function getFirstAction(leaf: ActionNode | null): GameAction | null {
  if (!leaf) return null;

  // Remonter jusqu'a trouver l'action de niveau 1
  const path = getPathToRoot(leaf);

  // Le premier element avec une action est l'action de niveau 1
  for (const node of path) {
    if (node.action && node.depth === 1) {
      return node.action;
    }
  }

  // Si on n'a pas trouve d'action de niveau 1, prendre la premiere action disponible
  for (const node of path) {
    if (node.action) {
      return node.action;
    }
  }

  return null;
}

/**
 * Retourne le chemin de la feuille a la racine
 */
function getPathToRoot(leaf: ActionNode): ActionNode[] {
  // On ne peut pas remonter directement car les noeuds n'ont pas de parent
  // TODO: Ajouter un pointeur parent ou passer le chemin en parametre
  return [leaf];
}

/**
 * Retourne les N meilleures feuilles
 */
export function getTopLeaves(tree: ActionTree, n: number): ActionNode[] {
  const leaves = getLeaves(tree.root);

  // Trier par score decroissant
  leaves.sort((a, b) => {
    const scoreA = a.score ?? -Infinity;
    const scoreB = b.score ?? -Infinity;
    return scoreB - scoreA;
  });

  return leaves.slice(0, n);
}

/**
 * Trouve un noeud par son ID
 */
export function findNodeById(root: ActionNode, id: string): ActionNode | null {
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
}

/**
 * Calcule la profondeur moyenne des feuilles
 */
export function getAverageLeafDepth(tree: ActionTree): number {
  const leaves = getLeaves(tree.root);
  if (leaves.length === 0) return 0;

  const totalDepth = leaves.reduce((sum, leaf) => sum + leaf.depth, 0);
  return totalDepth / leaves.length;
}

/**
 * Retourne les enfants directs de la racine (actions de niveau 1)
 */
export function getLevel1Actions(tree: ActionTree): ActionNode[] {
  return tree.root.children;
}

/**
 * Filtre les noeuds selon un predicat
 */
export function filterNodes(
  node: ActionNode,
  predicate: (n: ActionNode) => boolean
): ActionNode[] {
  const result: ActionNode[] = [];

  if (predicate(node)) {
    result.push(node);
  }

  for (const child of node.children) {
    result.push(...filterNodes(child, predicate));
  }

  return result;
}
