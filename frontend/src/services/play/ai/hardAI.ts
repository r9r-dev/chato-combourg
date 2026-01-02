/**
 * Hard AI - IA Difficile (MCTS)
 *
 * Utilise Monte Carlo Tree Search pour trouver les meilleurs coups.
 * Optimise pour tourner sur le navigateur en limitant le nombre de simulations.
 *
 * Parametres:
 * - MAX_ITERATIONS: Nombre maximum de simulations MCTS
 * - MAX_TIME_MS: Temps maximum de reflexion
 * - EXPLORATION_CONSTANT: Balance exploration/exploitation (UCB1)
 */

import type {
  AIPlayer,
  AILevel,
  PlayGameState,
  GameAction,
  PlayPlayer,
} from '../../../types/play';
import { getValidPlacements } from '../../../types/play';
import {
  getCard,
  getAvailableCards,
  canAffordCard,
  getCurrentPlayer,
  executeAction,
} from '../gameEngine';

// =============================================================================
// Configuration MCTS
// =============================================================================

const MAX_ITERATIONS = 500;      // Limiter pour performances navigateur
const MAX_TIME_MS = 1000;        // 1 seconde max
const EXPLORATION_CONSTANT = 1.414; // sqrt(2) pour UCB1

// =============================================================================
// Types MCTS
// =============================================================================

interface MCTSNode {
  state: PlayGameState;
  action: GameAction | null;      // Action qui a mene a ce noeud
  parent: MCTSNode | null;
  children: MCTSNode[];
  wins: number;
  visits: number;
  untriedActions: GameAction[];
}

// =============================================================================
// Hard AI
// =============================================================================

export class HardAI implements AIPlayer {
  level: AILevel = 'hard';
  name = 'IA Difficile';

  async selectAction(state: PlayGameState): Promise<GameAction> {
    const player = getCurrentPlayer(state);
    const playerId = player.id;

    // Pour les phases simples, utiliser des heuristiques
    if (state.turnPhase === 'effect') {
      return this.selectEffectAction(state, playerId);
    }

    if (state.turnPhase === 'post_action' || state.turnPhase === 'end') {
      return { type: 'end_turn', playerId };
    }

    // Pour l'achat et le placement, utiliser MCTS
    return this.runMCTS(state);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // ===========================================================================
  // MCTS Implementation
  // ===========================================================================

  private runMCTS(state: PlayGameState): GameAction {
    const startTime = Date.now();
    const root = this.createNode(state, null, null);

    let iterations = 0;
    while (iterations < MAX_ITERATIONS && Date.now() - startTime < MAX_TIME_MS) {
      // 1. Selection - Trouver un noeud a explorer
      let node = this.select(root);

      // 2. Expansion - Ajouter un enfant si possible
      if (node.untriedActions.length > 0 && !this.isTerminal(node.state)) {
        node = this.expand(node);
      }

      // 3. Simulation - Jouer aleatoirement jusqu'a la fin
      const result = this.simulate(node.state);

      // 4. Backpropagation - Mettre a jour les stats
      this.backpropagate(node, result);

      iterations++;
    }

    // Choisir le meilleur enfant (le plus visite)
    const bestChild = this.getBestChild(root, 0);
    if (!bestChild || !bestChild.action) {
      // Fallback: action aleatoire
      return this.getRandomAction(state);
    }

    return bestChild.action;
  }

  private createNode(
    state: PlayGameState,
    action: GameAction | null,
    parent: MCTSNode | null
  ): MCTSNode {
    return {
      state,
      action,
      parent,
      children: [],
      wins: 0,
      visits: 0,
      untriedActions: this.getLegalActions(state),
    };
  }

  private select(node: MCTSNode): MCTSNode {
    // Descendre dans l'arbre en selectionnant les meilleurs noeuds (UCB1)
    while (node.untriedActions.length === 0 && node.children.length > 0) {
      node = this.getBestChild(node, EXPLORATION_CONSTANT)!;
    }
    return node;
  }

  private expand(node: MCTSNode): MCTSNode {
    // Prendre une action non essayee
    const actionIndex = Math.floor(Math.random() * node.untriedActions.length);
    const action = node.untriedActions.splice(actionIndex, 1)[0];

    // Creer le nouvel etat
    const newState = executeAction(node.state, action);

    // Creer le noeud enfant
    const childNode = this.createNode(newState, action, node);
    node.children.push(childNode);

    return childNode;
  }

  private simulate(state: PlayGameState): number {
    // Simulation rapide: jouer aleatoirement jusqu'a la fin du tour
    // puis estimer le score
    let currentState = { ...state };
    let depth = 0;
    const maxDepth = 20; // Limiter la profondeur

    while (depth < maxDepth && !this.isTerminal(currentState)) {
      const actions = this.getLegalActions(currentState);
      if (actions.length === 0) break;

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      currentState = executeAction(currentState, randomAction);
      depth++;
    }

    // Evaluer l'etat final pour le joueur actuel
    return this.evaluateState(currentState, state.currentPlayerIndex);
  }

  private backpropagate(node: MCTSNode | null, result: number): void {
    while (node !== null) {
      node.visits++;
      node.wins += result;
      node = node.parent;
    }
  }

  private getBestChild(
    node: MCTSNode,
    explorationConstant: number
  ): MCTSNode | null {
    if (node.children.length === 0) return null;

    let bestScore = -Infinity;
    let bestChild: MCTSNode | null = null;

    for (const child of node.children) {
      if (child.visits === 0) {
        // Favoriser les noeuds non visites
        return child;
      }

      // UCB1 formula
      const exploitation = child.wins / child.visits;
      const exploration = Math.sqrt(Math.log(node.visits) / child.visits);
      const score = exploitation + explorationConstant * exploration;

      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }

    return bestChild;
  }

  private isTerminal(state: PlayGameState): boolean {
    // Un etat est terminal si le tour est termine
    return state.turnPhase === 'end' || state.turnPhase === 'post_action';
  }

  private evaluateState(state: PlayGameState, playerIndex: number): number {
    const player = state.players[playerIndex];

    let score = 0;

    // Compter les cartes
    const cardCount = player.board.filter(c => c !== null).length;
    score += cardCount * 5;

    // Ressources
    score += player.gold * 0.5;
    score += player.keys * 2;

    // Reductions (tres valuables)
    score += (player.reductionCastle + player.reductionVillage) * 8;

    // Synergies de boucliers
    score += this.evaluateShieldSynergies(player) * 2;

    // Normaliser entre 0 et 1
    return Math.max(0, Math.min(1, score / 100));
  }

  private evaluateShieldSynergies(player: PlayPlayer): number {
    let synergies = 0;

    // Compter les boucliers par ligne et colonne
    for (let i = 0; i < 3; i++) {
      const rowColors = new Map<string, number>();
      const colColors = new Map<string, number>();

      for (let j = 0; j < 3; j++) {
        // Ligne
        const rowCard = player.board[i * 3 + j];
        if (rowCard) {
          const card = getCard(rowCard.cardId);
          if (card) {
            for (const shield of card.shields) {
              rowColors.set(
                shield.color,
                (rowColors.get(shield.color) || 0) + shield.count
              );
            }
          }
        }

        // Colonne
        const colCard = player.board[j * 3 + i];
        if (colCard) {
          const card = getCard(colCard.cardId);
          if (card) {
            for (const shield of card.shields) {
              colColors.set(
                shield.color,
                (colColors.get(shield.color) || 0) + shield.count
              );
            }
          }
        }
      }

      // Bonus pour les concentrations de couleurs
      for (const count of rowColors.values()) {
        if (count >= 3) synergies += 3;
        else if (count >= 2) synergies += 1;
      }
      for (const count of colColors.values()) {
        if (count >= 3) synergies += 3;
        else if (count >= 2) synergies += 1;
      }
    }

    return synergies;
  }

  // ===========================================================================
  // Actions legales
  // ===========================================================================

  private getLegalActions(state: PlayGameState): GameAction[] {
    const player = getCurrentPlayer(state);
    const playerId = player.id;
    const actions: GameAction[] = [];

    switch (state.turnPhase) {
      case 'pre_action':
      case 'buy':
        // Actions d'achat
        const availableCards = getAvailableCards(state);
        for (const cardId of availableCards) {
          // Achat normal
          if (canAffordCard(player, cardId).canAfford) {
            actions.push({ type: 'buy_card', playerId, cardId });
          }
          // Achat face cachee (toujours possible)
          actions.push({ type: 'buy_card_flipped', playerId, cardId });
        }

        // Utilisation de cle (pre_action uniquement)
        if (state.turnPhase === 'pre_action' && player.keys > 0) {
          // Deplacer messager
          const otherLocation = state.board.messengerLocation === 'castle' ? 'village' : 'castle';
          actions.push({
            type: 'spend_key',
            playerId,
            targetLocation: otherLocation,
          });
          // Refresh lieu actuel
          actions.push({
            type: 'spend_key',
            playerId,
            targetLocation: state.board.messengerLocation,
          });
        }
        break;

      case 'place':
        const validPositions = getValidPlacements(player.board);
        for (const position of validPositions) {
          actions.push({ type: 'place_card', playerId, position });
        }
        break;

      case 'effect':
        actions.push({ type: 'choose_effect', playerId, choiceIndex: 0 });
        actions.push({ type: 'choose_effect', playerId, choiceIndex: 1 });
        break;

      case 'post_action':
      case 'end':
        actions.push({ type: 'end_turn', playerId });
        break;
    }

    return actions;
  }

  private getRandomAction(state: PlayGameState): GameAction {
    const actions = this.getLegalActions(state);
    if (actions.length === 0) {
      return { type: 'end_turn', playerId: getCurrentPlayer(state).id };
    }
    return actions[Math.floor(Math.random() * actions.length)];
  }

  private selectEffectAction(state: PlayGameState, playerId: string): GameAction {
    // Heuristique simple pour les choix d'effets
    const player = getCurrentPlayer(state);
    const cardCount = player.board.filter(c => c !== null).length;

    // En debut de partie, preferer l'or ; en fin, les cles
    const preferKeys = cardCount >= 6;

    return {
      type: 'choose_effect',
      playerId,
      choiceIndex: preferKeys ? 1 : 0,
    };
  }
}
