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
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  PlayGameState,
  GameAction,
  PlayPlayer,
  DiscardChoice,
  ReplaceLocationChoice,
  AdjacentCardChoice,
  PurseSelectionChoice,
  Location,
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

  // ===========================================================================
  // Actions obligatoires
  // ===========================================================================

  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const player = getCurrentPlayer(state);

    // Generer toutes les actions d'achat possibles
    const buyActions: GameAction[] = [];
    for (const cardId of availableCards) {
      if (canAffordCard(player, cardId).canAfford) {
        buyActions.push({ type: 'buy_card', playerId: player.id, cardId });
      }
      buyActions.push({ type: 'buy_card_flipped', playerId: player.id, cardId });
    }

    // Utiliser MCTS pour trouver la meilleure action
    const bestAction = this.runMCTSForActions(state, buyActions);

    if (bestAction && bestAction.cardId) {
      return {
        cardId: bestAction.cardId,
        flipped: bestAction.type === 'buy_card_flipped',
      };
    }

    // Fallback: carte la moins chere face cachee
    const sortedByValue = [...availableCards].sort((a, b) => {
      const cardA = getCard(a);
      const cardB = getCard(b);
      return (cardA?.value ?? 0) - (cardB?.value ?? 0);
    });
    return { cardId: sortedByValue[0], flipped: true };
  }

  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    const player = getCurrentPlayer(state);

    if (validPositions.length === 0) {
      return 4; // Centre par defaut
    }

    if (validPositions.length === 1) {
      return validPositions[0];
    }

    // Generer toutes les actions de placement possibles
    const placeActions: GameAction[] = validPositions.map(position => ({
      type: 'place_card' as const,
      playerId: player.id,
      position,
    }));

    // Utiliser MCTS pour trouver la meilleure position
    const bestAction = this.runMCTSForActions(state, placeActions);

    if (bestAction && bestAction.position !== undefined) {
      return bestAction.position;
    }

    // Fallback: meilleure position par heuristique
    return this.evaluateBestPosition(state, cardId, validPositions);
  }

  // ===========================================================================
  // Actions facultatives
  // ===========================================================================

  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    const player = getCurrentPlayer(state);

    // Compter les cartes abordables dans chaque lieu
    const castleCards = state.board.castleCards;
    const villageCards = state.board.villageCards;

    const castleAffordable = castleCards.filter(
      cardId => canAffordCard(player, cardId).canAfford
    ).length;

    const villageAffordable = villageCards.filter(
      cardId => canAffordCard(player, cardId).canAfford
    ).length;

    const currentLocation = state.board.messengerLocation;
    const currentAffordable = currentLocation === 'castle' ? castleAffordable : villageAffordable;
    const otherAffordable = currentLocation === 'castle' ? villageAffordable : castleAffordable;

    // Si l'autre lieu a plus de cartes abordables interessantes
    if (currentAffordable === 0 && otherAffordable > 0) {
      return {
        type: 'move_messenger',
        targetLocation: currentLocation === 'castle' ? 'village' : 'castle',
      };
    }

    // Evaluer si un refresh serait benefique
    if (currentAffordable === 0 && player.gold >= 3) {
      return {
        type: 'refresh',
        targetLocation: currentLocation,
      };
    }

    return null;
  }

  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    const player = getCurrentPlayer(state);
    const cardCount = player.board.filter(c => c !== null).length;

    // Utiliser les cadenas plus strategiquement
    if (availableLocks.length === 0) {
      return null;
    }

    // En fin de partie, utiliser les cadenas
    if (cardCount >= 5) {
      // Choisir le cadenas qui donne le meilleur effet
      let bestLock = availableLocks[0];
      let bestScore = 0;

      for (const lockPos of availableLocks) {
        const placed = player.board[lockPos];
        if (!placed) continue;

        const card = getCard(placed.cardId);
        if (!card || !card.lock_effect) continue;

        // Evaluer l'effet du cadenas
        let score = 0;
        const effect = card.lock_effect;
        if (effect.type.includes('gold')) {
          score += (effect.amount ?? 1) * 2;
        }
        if (effect.type.includes('keys')) {
          score += (effect.amount ?? 1) * 3;
        }

        if (score > bestScore) {
          bestScore = score;
          bestLock = lockPos;
        }
      }

      return bestLock;
    }

    return null;
  }

  // ===========================================================================
  // Choix d'effets
  // ===========================================================================

  selectEffectOption(state: PlayGameState, options: AIEffectOption[]): number {
    if (options.length === 0) return 0;

    const player = getCurrentPlayer(state);
    const cardCount = player.board.filter(c => c !== null).length;

    // Analyser les descriptions des options pour faire un choix intelligent
    for (let i = 0; i < options.length; i++) {
      const desc = options[i].description.toLowerCase();

      // En fin de partie, preferer les cles
      if (cardCount >= 6) {
        if (desc.includes('clé') || desc.includes('cle')) {
          return i;
        }
      } else {
        // En debut de partie, preferer l'or
        if (desc.includes('or') || desc.includes('pièce')) {
          return i;
        }
      }
    }

    // Sinon, preferer la premiere option (souvent or)
    return 0;
  }

  selectLocation(state: PlayGameState, choice: ReplaceLocationChoice): Location {
    // Choisir le lieu qui maximise le gain
    const keysPerCard = choice.keysPerCard ?? 0;

    const countKeysForLocation = (location: Location): number => {
      const cards = location === 'castle'
        ? state.board.castleCards
        : state.board.villageCards;

      let keys = 0;
      for (const cardId of cards) {
        const card = getCard(cardId);
        if (!card) continue;

        if (choice.effectType === 'replace_location_gain_keys_per_feature') {
          if (choice.feature === 'price_reduction' && card.has_price_reduction) {
            keys += keysPerCard;
          } else if (choice.feature === 'coin_purse' && card.has_coin_purse) {
            keys += keysPerCard;
          }
        } else if (choice.effectType === 'replace_location_gain_keys_per_shield') {
          const hasShield = card.shields.some(s => s.color === choice.color);
          if (hasShield) {
            keys += keysPerCard;
          }
        }
      }

      return keys;
    };

    const keysFromCastle = countKeysForLocation('castle');
    const keysFromVillage = countKeysForLocation('village');

    return keysFromCastle >= keysFromVillage ? 'castle' : 'village';
  }

  selectDiscardCard(_state: PlayGameState, _choice: DiscardChoice, availableCards: string[]): string {
    // Defausser la carte la plus chere
    let bestCard = availableCards[0];
    let bestValue = 0;

    for (const cardId of availableCards) {
      const card = getCard(cardId);
      if (card && card.value > bestValue) {
        bestValue = card.value;
        bestCard = cardId;
      }
    }

    return bestCard;
  }

  selectAdjacentCard(state: PlayGameState, choice: AdjacentCardChoice): number {
    const player = getCurrentPlayer(state);

    // Choisir la carte adjacente avec le meilleur effet
    let bestPosition = choice.adjacentPositions[0];
    let bestScore = -Infinity;

    for (const pos of choice.adjacentPositions) {
      const placed = player.board[pos];
      if (!placed) continue;

      const card = getCard(placed.cardId);
      if (!card) continue;

      let score = 0;

      // Evaluer les effets
      for (const effect of card.effects) {
        if (effect.type.includes('gold')) {
          score += (effect.amount ?? 1) * 2;
        }
        if (effect.type.includes('keys')) {
          score += (effect.amount ?? 1) * 3;
        }
        if (effect.type.includes('fill_purses')) {
          score += 5;
        }
      }

      // Bonus pour les cartes avec bourse non pleine
      if (card.has_coin_purse && placed.coinsOnCard !== card.max_coins) {
        score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPosition = pos;
      }
    }

    return bestPosition;
  }

  selectPurses(state: PlayGameState, choice: PurseSelectionChoice): number[] {
    const player = getCurrentPlayer(state);

    // Remplir les bourses avec le plus de capacite restante (maximiser l'or stocke)
    const pursesWithCapacity = choice.availablePositions.map(pos => {
      const placed = player.board[pos];
      if (!placed) return { pos, capacity: 0 };

      const card = getCard(placed.cardId);
      if (!card) return { pos, capacity: 0 };

      const current = placed.coinsOnCard ?? 0;
      const max = card.max_coins ?? 0;
      return { pos, capacity: max - current };
    });

    // Trier par capacite decroissante (remplir les grosses bourses en premier)
    pursesWithCapacity.sort((a, b) => b.capacity - a.capacity);

    return pursesWithCapacity.slice(0, choice.maxCards).map(p => p.pos);
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // ===========================================================================
  // MCTS Implementation
  // ===========================================================================

  private runMCTSForActions(state: PlayGameState, actions: GameAction[]): GameAction | null {
    if (actions.length === 0) return null;
    if (actions.length === 1) return actions[0];

    const startTime = Date.now();
    const root = this.createNode(state, null, null);
    root.untriedActions = [...actions];

    let iterations = 0;
    while (iterations < MAX_ITERATIONS && Date.now() - startTime < MAX_TIME_MS) {
      // 1. Selection
      let node = this.select(root);

      // 2. Expansion
      if (node.untriedActions.length > 0 && !this.isTerminal(node.state)) {
        node = this.expand(node);
      }

      // 3. Simulation
      const result = this.simulate(node.state);

      // 4. Backpropagation
      this.backpropagate(node, result);

      iterations++;
    }

    // Choisir le meilleur enfant (le plus visite)
    const bestChild = this.getBestChild(root, 0);
    return bestChild?.action ?? null;
  }

  private evaluateBestPosition(
    state: PlayGameState,
    cardId: string,
    validPositions: number[]
  ): number {
    const player = getCurrentPlayer(state);
    const card = getCard(cardId);
    if (!card) return validPositions[0];

    let bestPosition = validPositions[0];
    let bestScore = -Infinity;

    for (const position of validPositions) {
      let score = 0;
      const row = Math.floor(position / 3);
      const col = position % 3;

      // Compter les synergies de boucliers
      for (let i = 0; i < 9; i++) {
        const placed = player.board[i];
        if (!placed) continue;

        const placedCard = getCard(placed.cardId);
        if (!placedCard) continue;

        const placedRow = Math.floor(i / 3);
        const placedCol = i % 3;

        if (placedRow === row || placedCol === col) {
          for (const shield of card.shields) {
            for (const placedShield of placedCard.shields) {
              if (shield.color === placedShield.color) {
                score += 2;
              }
            }
          }
        }
      }

      // Bonus centre
      if (position === 4) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestPosition = position;
      }
    }

    return bestPosition;
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
    while (node.untriedActions.length === 0 && node.children.length > 0) {
      node = this.getBestChild(node, EXPLORATION_CONSTANT)!;
    }
    return node;
  }

  private expand(node: MCTSNode): MCTSNode {
    const actionIndex = Math.floor(Math.random() * node.untriedActions.length);
    const action = node.untriedActions.splice(actionIndex, 1)[0];

    const newState = executeAction(node.state, action);
    const childNode = this.createNode(newState, action, node);
    node.children.push(childNode);

    return childNode;
  }

  private simulate(state: PlayGameState): number {
    let currentState = { ...state };
    let depth = 0;
    const maxDepth = 20;

    while (depth < maxDepth && !this.isTerminal(currentState)) {
      const actions = this.getLegalActions(currentState);
      if (actions.length === 0) break;

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      currentState = executeAction(currentState, randomAction);
      depth++;
    }

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
        return child;
      }

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
    return state.turnPhase === 'end' || state.turnPhase === 'post_action';
  }

  private evaluateState(state: PlayGameState, playerIndex: number): number {
    const player = state.players[playerIndex];

    let score = 0;

    const cardCount = player.board.filter(c => c !== null).length;
    score += cardCount * 5;

    score += player.gold * 0.5;
    score += player.keys * 2;

    score += (player.reductionCastle + player.reductionVillage) * 8;

    score += this.evaluateShieldSynergies(player) * 2;

    return Math.max(0, Math.min(1, score / 100));
  }

  private evaluateShieldSynergies(player: PlayPlayer): number {
    let synergies = 0;

    for (let i = 0; i < 3; i++) {
      const rowColors = new Map<string, number>();
      const colColors = new Map<string, number>();

      for (let j = 0; j < 3; j++) {
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

  private getLegalActions(state: PlayGameState): GameAction[] {
    const player = getCurrentPlayer(state);
    const playerId = player.id;
    const actions: GameAction[] = [];

    switch (state.turnPhase) {
      case 'pre_action':
      case 'buy':
        const availableCards = getAvailableCards(state);
        for (const cardId of availableCards) {
          if (canAffordCard(player, cardId).canAfford) {
            actions.push({ type: 'buy_card', playerId, cardId });
          }
          actions.push({ type: 'buy_card_flipped', playerId, cardId });
        }

        if (state.turnPhase === 'pre_action' && player.keys > 0 && !state.keyUsedThisTurn) {
          const otherLocation = state.board.messengerLocation === 'castle' ? 'village' : 'castle';
          actions.push({
            type: 'spend_key',
            playerId,
            targetLocation: otherLocation,
          });
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
}
