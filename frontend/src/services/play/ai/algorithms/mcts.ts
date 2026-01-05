/**
 * Monte Carlo Tree Search (MCTS)
 *
 * Explore l'arbre de maniere aleatoire et converge vers les bonnes branches.
 * Utilise UCB1 pour balancer exploration et exploitation.
 */

import type { GameAction, PlayCard } from '../../../../types/play';
import type { ActionTree, ActionNode } from '../types';
import { evaluateState } from '../evaluator/scorer';

export interface MCTSOptions {
  maxIterations: number;
  maxTimeMs: number;
  explorationConstant: number; // C dans UCB1 (sqrt(2) par defaut)
}

const DEFAULT_OPTIONS: MCTSOptions = {
  maxIterations: 500,
  maxTimeMs: 3000,
  explorationConstant: Math.sqrt(2),
};

/**
 * Selectionne la meilleure action avec MCTS
 */
export function mctsSelect(
  tree: ActionTree,
  cards: Map<string, PlayCard>,
  options: Partial<MCTSOptions> = {}
): GameAction | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (tree.root.children.length === 0) return null;

  const startTime = Date.now();
  let iterations = 0;

  // Initialiser les compteurs de visites
  initializeVisits(tree.root);

  while (iterations < opts.maxIterations && Date.now() - startTime < opts.maxTimeMs) {
    // 1. Selection : descendre vers une feuille prometteuse (retourne le chemin)
    const path = select(tree.root, opts.explorationConstant);
    const selected = path[path.length - 1];

    // 2. Expansion : si possible, ajouter un enfant non explore
    // (L'arbre est deja construit, on ne fait pas d'expansion dynamique)

    // 3. Simulation : evaluer le noeud
    const score = simulate(selected, tree.playerId, cards);

    // 4. Backpropagation : remonter le score le long du chemin
    backpropagate(path, score);

    iterations++;
  }

  // Choisir l'action la plus visitee (plus robuste que le meilleur score moyen)
  return getBestVisitedAction(tree);
}

/**
 * Initialise les compteurs de visites
 */
function initializeVisits(node: ActionNode): void {
  if (node.visits === undefined) {
    node.visits = 0;
    node.score = 0;
  }

  for (const child of node.children) {
    initializeVisits(child);
  }
}

/**
 * Selection : descend vers une feuille prometteuse avec UCB1
 * Retourne le chemin complet de la racine a la feuille
 */
function select(node: ActionNode, explorationConstant: number, path: ActionNode[] = []): ActionNode[] {
  path.push(node);

  // Si c'est une feuille ou un noeud terminal, s'arreter
  if (node.children.length === 0 || node.isTerminal) {
    return path;
  }

  // Choisir le meilleur enfant selon UCB1
  let bestChild = node.children[0];
  let bestUCB = -Infinity;

  for (const child of node.children) {
    const ucb = calculateUCB1(child, node.visits ?? 1, explorationConstant);
    if (ucb > bestUCB) {
      bestUCB = ucb;
      bestChild = child;
    }
  }

  // Recursion
  return select(bestChild, explorationConstant, path);
}

/**
 * Calcule la valeur UCB1 d'un noeud
 *
 * UCB1 = moyenne + C * sqrt(ln(parent_visits) / visits)
 */
function calculateUCB1(
  node: ActionNode,
  parentVisits: number,
  explorationConstant: number
): number {
  const visits = node.visits ?? 0;

  // Si jamais visite, priorite maximale
  if (visits === 0) {
    return Infinity;
  }

  const exploitation = (node.score ?? 0) / visits;
  const exploration = explorationConstant * Math.sqrt(Math.log(parentVisits) / visits);

  return exploitation + exploration;
}

/**
 * Simulation : evalue le noeud (rollout simplifie)
 */
function simulate(
  node: ActionNode,
  playerId: string,
  cards: Map<string, PlayCard>
): number {
  // Pour simplifier, on evalue directement le noeud
  // Une version plus sophistiquee ferait un rollout aleatoire

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
    gameId: 'mcts',
  };

  return evaluateState(state, playerId, cards);
}

/**
 * Backpropagation : remonte le score vers la racine le long du chemin
 */
function backpropagate(path: ActionNode[], score: number): void {
  // Mettre a jour les statistiques de chaque noeud du chemin
  for (const node of path) {
    node.visits = (node.visits ?? 0) + 1;
    node.score = (node.score ?? 0) + score;
  }
}

/**
 * Retourne l'action la plus visitee
 */
function getBestVisitedAction(tree: ActionTree): GameAction | null {
  if (tree.root.children.length === 0) return null;

  let bestChild = tree.root.children[0];
  let bestVisits = bestChild.visits ?? 0;

  for (const child of tree.root.children) {
    const visits = child.visits ?? 0;
    if (visits > bestVisits) {
      bestVisits = visits;
      bestChild = child;
    }
  }

  return bestChild.action;
}

/**
 * Statistiques MCTS pour debug
 */
export interface MCTSStats {
  iterations: number;
  timeMs: number;
  bestActionVisits: number;
  totalVisits: number;
}

/**
 * Version avec statistiques pour debug
 */
export function mctsSelectWithStats(
  tree: ActionTree,
  cards: Map<string, PlayCard>,
  options: Partial<MCTSOptions> = {}
): { action: GameAction | null; stats: MCTSStats } {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (tree.root.children.length === 0) {
    return {
      action: null,
      stats: { iterations: 0, timeMs: 0, bestActionVisits: 0, totalVisits: 0 },
    };
  }

  const startTime = Date.now();
  let iterations = 0;

  initializeVisits(tree.root);

  while (iterations < opts.maxIterations && Date.now() - startTime < opts.maxTimeMs) {
    const path = select(tree.root, opts.explorationConstant);
    const selected = path[path.length - 1];
    const score = simulate(selected, tree.playerId, cards);
    backpropagate(path, score);
    iterations++;
  }

  const action = getBestVisitedAction(tree);

  const bestVisits = tree.root.children.reduce(
    (max, child) => Math.max(max, child.visits ?? 0),
    0
  );

  return {
    action,
    stats: {
      iterations,
      timeMs: Date.now() - startTime,
      bestActionVisits: bestVisits,
      totalVisits: tree.root.visits ?? 0,
    },
  };
}
