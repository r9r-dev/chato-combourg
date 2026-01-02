/**
 * Monte Carlo Tree Search (MCTS) pour l'IA Difficile
 *
 * Algorithme :
 * 1. Selection : Descendre l'arbre avec UCB1
 * 2. Expansion : Ajouter un noeud enfant
 * 3. Rollout : Simuler jusqu'a N tours
 * 4. Backpropagation : Mettre a jour les scores
 */

import type { PlayGameState } from '../../../../types/play';
import { NormalAI } from '../normalAI';
import type { MCTSAction } from './simulation';
import {
  cloneState,
  generateActions,
  executeSimulatedAction,
  rollout,
  isGameOver,
} from './simulation';
import { getNormalizedScore } from './scoring';

// =============================================================================
// Configuration
// =============================================================================

const UCB1_EXPLORATION = 1.414; // sqrt(2) - coefficient d'exploration
const ROLLOUT_DEPTH = 4; // Nombre de tours a simuler

// =============================================================================
// Noeud MCTS
// =============================================================================

interface MCTSNode {
  state: PlayGameState;
  action: MCTSAction | null;  // Action qui a mene a cet etat (null pour root)
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  totalScore: number;        // Somme des scores (pour calculer la moyenne)
  untriedActions: MCTSAction[];
  playerId: string;          // ID du joueur IA (pour le calcul du score)
}

/**
 * Cree un noeud racine
 */
function createRootNode(state: PlayGameState, playerId: string): MCTSNode {
  return {
    state: cloneState(state),
    action: null,
    parent: null,
    children: [],
    visits: 0,
    totalScore: 0,
    untriedActions: generateActions(state),
    playerId,
  };
}

/**
 * Cree un noeud enfant
 */
function createChildNode(
  parent: MCTSNode,
  state: PlayGameState,
  action: MCTSAction
): MCTSNode {
  return {
    state,
    action,
    parent,
    children: [],
    visits: 0,
    totalScore: 0,
    untriedActions: generateActions(state),
    playerId: parent.playerId,
  };
}

// =============================================================================
// UCB1 (Upper Confidence Bound)
// =============================================================================

/**
 * Calcule le score UCB1 d'un noeud
 * Equilibre exploitation (score moyen) et exploration (peu visite)
 */
function ucb1(node: MCTSNode, parentVisits: number): number {
  if (node.visits === 0) {
    return Infinity; // Noeud non visite = priorite maximale
  }

  const exploitation = node.totalScore / node.visits;
  const exploration = UCB1_EXPLORATION * Math.sqrt(Math.log(parentVisits) / node.visits);

  return exploitation + exploration;
}

/**
 * Selectionne le meilleur enfant selon UCB1
 */
function selectBestChild(node: MCTSNode): MCTSNode {
  let bestChild: MCTSNode | null = null;
  let bestScore = -Infinity;

  for (const child of node.children) {
    const score = ucb1(child, node.visits);
    if (score > bestScore) {
      bestScore = score;
      bestChild = child;
    }
  }

  return bestChild!;
}

// =============================================================================
// Phases MCTS
// =============================================================================

/**
 * Phase de selection : descendre l'arbre jusqu'a un noeud expansible
 */
function select(node: MCTSNode): MCTSNode {
  let current = node;

  while (current.untriedActions.length === 0 && current.children.length > 0) {
    current = selectBestChild(current);
  }

  return current;
}

/**
 * Phase d'expansion : ajouter un nouveau noeud enfant
 */
function expand(node: MCTSNode, normalAI: NormalAI): MCTSNode {
  if (node.untriedActions.length === 0) {
    return node; // Noeud terminal
  }

  // Choisir une action aleatoire parmi les non essayees
  const actionIndex = Math.floor(Math.random() * node.untriedActions.length);
  const action = node.untriedActions.splice(actionIndex, 1)[0];

  // Executer l'action pour obtenir le nouvel etat
  const newState = executeSimulatedAction(node.state, action, normalAI);

  // Creer le noeud enfant
  const child = createChildNode(node, newState, action);
  node.children.push(child);

  return child;
}

/**
 * Phase de simulation (rollout) : jouer aleatoirement jusqu'a N tours
 */
function simulate(node: MCTSNode, normalAI: NormalAI): number {
  // Si la partie est terminee, retourner le score final
  if (isGameOver(node.state)) {
    return getNormalizedScore(node.playerId, node.state.players);
  }

  // Simuler N tours
  const finalState = rollout(node.state, ROLLOUT_DEPTH, normalAI);

  // Retourner le score normalise
  return getNormalizedScore(node.playerId, finalState.players);
}

/**
 * Phase de backpropagation : mettre a jour les scores
 */
function backpropagate(node: MCTSNode, score: number): void {
  let current: MCTSNode | null = node;

  while (current !== null) {
    current.visits++;
    current.totalScore += score;
    current = current.parent;
  }
}

// =============================================================================
// Algorithme principal
// =============================================================================

/**
 * Execute l'algorithme MCTS pendant un temps limite
 *
 * @param state Etat actuel du jeu
 * @param playerId ID du joueur IA
 * @param timeLimitMs Temps limite en millisecondes
 * @returns La meilleure action trouvee
 */
export function runMCTS(
  state: PlayGameState,
  playerId: string,
  timeLimitMs: number
): MCTSAction | null {
  const normalAI = new NormalAI();
  const root = createRootNode(state, playerId);

  // Si pas d'actions possibles, retourner null
  if (root.untriedActions.length === 0 && root.children.length === 0) {
    return null;
  }

  const startTime = Date.now();
  let iterations = 0;

  // Boucle principale MCTS
  while (Date.now() - startTime < timeLimitMs) {
    // 1. Selection
    let node = select(root);

    // 2. Expansion
    if (node.untriedActions.length > 0 && !isGameOver(node.state)) {
      node = expand(node, normalAI);
    }

    // 3. Simulation
    const score = simulate(node, normalAI);

    // 4. Backpropagation
    backpropagate(node, score);

    iterations++;
  }

  console.log(`[MCTS] ${iterations} iterations in ${Date.now() - startTime}ms`);

  // Choisir la meilleure action (celle avec le plus de visites)
  if (root.children.length === 0) {
    // Pas d'enfants = prendre une action non essayee
    if (root.untriedActions.length > 0) {
      // Utiliser NormalAI pour choisir parmi les actions non essayees
      return selectBestUntriedAction(root, normalAI);
    }
    return null;
  }

  let bestChild: MCTSNode | null = null;
  let bestVisits = -1;

  for (const child of root.children) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestChild = child;
    }
  }

  if (bestChild && bestChild.action) {
    const avgScore = bestChild.totalScore / bestChild.visits;
    console.log(
      `[MCTS] Best action: ${bestChild.action.type} ${bestChild.action.cardId} ` +
      `at pos ${bestChild.action.position} ` +
      `(${bestChild.visits} visits, avg score: ${avgScore.toFixed(3)})`
    );
  }

  return bestChild?.action ?? null;
}

/**
 * Selectionne la meilleure action non essayee en utilisant NormalAI
 */
function selectBestUntriedAction(node: MCTSNode, normalAI: NormalAI): MCTSAction {
  // Grouper les actions par carte
  const actionsByCard = new Map<string, MCTSAction[]>();
  for (const action of node.untriedActions) {
    const key = `${action.type}-${action.cardId}`;
    if (!actionsByCard.has(key)) {
      actionsByCard.set(key, []);
    }
    actionsByCard.get(key)!.push(action);
  }

  // Utiliser NormalAI pour choisir la carte
  const availableCards = [...new Set(node.untriedActions.map(a => a.cardId))];
  const buyDecision = normalAI.selectBuyAction(node.state, availableCards);

  // Filtrer les actions correspondantes
  const matchingType = buyDecision.flipped ? 'buy_flipped' : 'buy';
  const key = `${matchingType}-${buyDecision.cardId}`;
  const matchingActions = actionsByCard.get(key) ?? [];

  if (matchingActions.length > 0) {
    // Utiliser NormalAI pour choisir la position
    const validPositions = matchingActions.map(a => a.position);
    const bestPosition = normalAI.selectPlaceAction(
      node.state,
      buyDecision.cardId,
      validPositions
    );

    return matchingActions.find(a => a.position === bestPosition) ?? matchingActions[0];
  }

  // Fallback : premiere action
  return node.untriedActions[0];
}

// =============================================================================
// Calcul du temps alloue
// =============================================================================

/**
 * Calcule le temps alloue pour la recherche MCTS
 * - Temps de base avec variance : 2-3s (debut) a 7-10s (fin)
 * - Bonus par joueur : +1s par joueur a partir de 3
 *
 * @param cardCount Nombre de cartes deja placees
 * @param playerCount Nombre de joueurs dans la partie
 * @returns Temps en millisecondes
 */
export function getTimeLimit(cardCount: number, playerCount: number): number {
  // Temps de base avec variance aleatoire
  // Debut: 2000-3000ms, Fin: 7000-10000ms
  const minTimeBase = 2000;
  const minTimeVariance = 1000; // +0 a +1000ms
  const maxTimeBase = 7000;
  const maxTimeVariance = 3000; // +0 a +3000ms

  const progress = cardCount / 8;

  // Interpolation lineaire pour base et variance
  const baseTime = minTimeBase + (maxTimeBase - minTimeBase) * progress;
  const variance = minTimeVariance + (maxTimeVariance - minTimeVariance) * progress;

  // Ajouter variance aleatoire
  const randomVariance = Math.random() * variance;

  // Bonus par joueur (+1s par joueur a partir de 3)
  const playerBonus = Math.max(0, playerCount - 2) * 1000;

  return Math.round(baseTime + randomVariance + playerBonus);
}
