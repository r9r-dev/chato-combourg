/**
 * AI Module - Interface commune, wrapper securise et factory pour les IA
 *
 * Ce module fournit :
 * - Un wrapper securise qui garantit que l'IA retourne toujours une action valide
 * - Des fallbacks pour chaque type d'action
 * - Une factory pour creer les IA
 */

import type {
  AIPlayer,
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  AILevel,
  PlayGameState,
  GameAction,
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
  validateAction,
} from '../gameEngine';
import { EasyAI } from './easyAI';
import { NormalAI } from './normalAI';
import { HardAI } from './hardAI';

// =============================================================================
// Constants
// =============================================================================

const MAX_ITERATIONS = 100; // Securite contre les boucles infinies
const AI_ACTION_DELAY = 300; // Delai entre les actions (ms)

// =============================================================================
// Fallback Functions
// =============================================================================

/**
 * Fallback pour l'achat : prend la carte la moins chere ou face cachee
 */
function fallbackBuyAction(
  state: PlayGameState,
  availableCards: string[]
): AIBuyDecision {
  const player = getCurrentPlayer(state);

  // Trouver la carte la moins chere qu'on peut acheter
  let cheapestAffordable: { cardId: string; cost: number } | null = null;

  for (const cardId of availableCards) {
    const { canAfford, cost } = canAffordCard(player, cardId);
    if (canAfford) {
      if (!cheapestAffordable || cost < cheapestAffordable.cost) {
        cheapestAffordable = { cardId, cost };
      }
    }
  }

  if (cheapestAffordable) {
    return { cardId: cheapestAffordable.cardId, flipped: false };
  }

  // Sinon, prendre la carte la moins chere face cachee
  let cheapest = { cardId: availableCards[0], value: Infinity };
  for (const cardId of availableCards) {
    const card = getCard(cardId);
    if (card && card.value < cheapest.value) {
      cheapest = { cardId, value: card.value };
    }
  }

  return { cardId: cheapest.cardId, flipped: true };
}

/**
 * Fallback pour le placement : premiere position valide
 */
function fallbackPlaceAction(validPositions: number[]): number {
  // Preferer le centre si disponible
  if (validPositions.includes(4)) return 4;
  return validPositions[0] ?? 4;
}

/**
 * Fallback pour le choix d'effet : premiere option
 */
function fallbackEffectOption(): number {
  return 0;
}

/**
 * Fallback pour le choix de lieu : chateau
 */
function fallbackLocation(): Location {
  return 'castle';
}

/**
 * Fallback pour la defausse : carte la plus chere
 */
function fallbackDiscardCard(availableCards: string[]): string {
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

/**
 * Fallback pour la carte adjacente : premiere position
 */
function fallbackAdjacentCard(choice: AdjacentCardChoice): number {
  return choice.adjacentPositions[0];
}

/**
 * Fallback pour les bourses : premieres positions disponibles
 */
function fallbackPurses(choice: PurseSelectionChoice): number[] {
  return choice.availablePositions.slice(0, choice.maxCards);
}

// =============================================================================
// Safe AI Runner
// =============================================================================

/**
 * Resultat d'une action IA
 */
export interface AIActionResult {
  action: GameAction;
  source: 'ai' | 'fallback';
  error?: string;
}

/**
 * Gestionnaire de tour IA securise
 *
 * Encapsule une IA et garantit qu'elle retourne toujours des actions valides.
 * En cas d'erreur ou d'action invalide, utilise des fallbacks.
 */
export class SafeAIRunner {
  private ai: AIPlayer;
  private iterationCount = 0;

  constructor(ai: AIPlayer) {
    this.ai = ai;
  }

  get name(): string {
    return this.ai.name;
  }

  get level(): AILevel {
    return this.ai.level;
  }

  /**
   * Reset le compteur d'iterations (a appeler au debut de chaque tour)
   */
  resetIterations(): void {
    this.iterationCount = 0;
  }

  /**
   * Verifie si on a depasse le nombre max d'iterations
   */
  checkIterations(): boolean {
    this.iterationCount++;
    if (this.iterationCount > MAX_ITERATIONS) {
      console.error(`[${this.ai.name}] Max iterations reached (${MAX_ITERATIONS})`);
      return false;
    }
    return true;
  }

  // ===========================================================================
  // Actions obligatoires
  // ===========================================================================

  /**
   * Obtenir l'action d'achat de l'IA (avec fallback)
   */
  getBuyAction(state: PlayGameState): AIActionResult {
    const availableCards = getAvailableCards(state);
    const player = getCurrentPlayer(state);

    if (availableCards.length === 0) {
      return {
        action: { type: 'end_turn', playerId: player.id },
        source: 'fallback',
        error: 'No cards available',
      };
    }

    try {
      const decision = this.ai.selectBuyAction(state, availableCards);

      // Valider la decision
      const actionType = decision.flipped ? 'buy_card_flipped' : 'buy_card';
      const action: GameAction = {
        type: actionType,
        playerId: player.id,
        cardId: decision.cardId,
      };

      const validation = validateAction(state, action);
      if (validation.isValid) {
        return { action, source: 'ai' };
      }

      // Action invalide, utiliser fallback
      console.warn(`[${this.ai.name}] Invalid buy action: ${validation.reason}`);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectBuyAction:`, error);
    }

    // Fallback
    const fallback = fallbackBuyAction(state, availableCards);
    const actionType = fallback.flipped ? 'buy_card_flipped' : 'buy_card';
    return {
      action: {
        type: actionType,
        playerId: player.id,
        cardId: fallback.cardId,
      },
      source: 'fallback',
    };
  }

  /**
   * Obtenir l'action de placement de l'IA (avec fallback)
   */
  getPlaceAction(state: PlayGameState): AIActionResult {
    const player = getCurrentPlayer(state);
    const validPositions = getValidPlacements(player.board);
    const cardId = state.purchasedCard;

    if (!cardId || validPositions.length === 0) {
      return {
        action: { type: 'end_turn', playerId: player.id },
        source: 'fallback',
        error: 'No card to place or no valid positions',
      };
    }

    try {
      const position = this.ai.selectPlaceAction(state, cardId, validPositions);

      // Valider la position
      if (validPositions.includes(position)) {
        return {
          action: {
            type: 'place_card',
            playerId: player.id,
            position,
          },
          source: 'ai',
        };
      }

      console.warn(`[${this.ai.name}] Invalid place position: ${position}`);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectPlaceAction:`, error);
    }

    // Fallback
    const position = fallbackPlaceAction(validPositions);
    return {
      action: {
        type: 'place_card',
        playerId: player.id,
        position,
      },
      source: 'fallback',
    };
  }

  // ===========================================================================
  // Actions facultatives
  // ===========================================================================

  /**
   * Obtenir l'action de cle de l'IA (peut retourner null)
   */
  getKeyAction(state: PlayGameState): AIKeyAction | null {
    const player = getCurrentPlayer(state);

    // Pas de cles ou deja utilisee ce tour
    if (player.keys <= 0 || state.keyUsedThisTurn) {
      return null;
    }

    try {
      return this.ai.selectKeyAction(state);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectKeyAction:`, error);
      return null;
    }
  }

  /**
   * Obtenir l'action de cadenas de l'IA (peut retourner null)
   */
  getLockAction(state: PlayGameState): number | null {
    const player = getCurrentPlayer(state);

    // Pas de cles ou cadenas deja utilise ce tour
    if (player.keys <= 0 || state.lockUsedThisTurn) {
      return null;
    }

    // Trouver les cadenas disponibles (non ouverts)
    const availableLocks: number[] = [];
    for (let i = 0; i < 9; i++) {
      const placed = player.board[i];
      if (placed) {
        const card = getCard(placed.cardId);
        if (card?.has_lock) {
          const isLocked = player.lockedCards.get(i) !== false;
          if (isLocked) {
            availableLocks.push(i);
          }
        }
      }
    }

    if (availableLocks.length === 0) {
      return null;
    }

    try {
      return this.ai.selectLockAction(state, availableLocks);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectLockAction:`, error);
      return null;
    }
  }

  // ===========================================================================
  // Choix d'effets
  // ===========================================================================

  /**
   * Obtenir le choix d'effet [OU] de l'IA (avec fallback)
   */
  getEffectOption(state: PlayGameState, options: AIEffectOption[]): number {
    try {
      const choice = this.ai.selectEffectOption(state, options);
      if (choice >= 0 && choice < options.length) {
        return choice;
      }
      console.warn(`[${this.ai.name}] Invalid effect option: ${choice}`);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectEffectOption:`, error);
    }
    return fallbackEffectOption();
  }

  /**
   * Obtenir le choix de lieu de l'IA (avec fallback)
   */
  getLocationChoice(state: PlayGameState, choice: ReplaceLocationChoice): Location {
    try {
      const location = this.ai.selectLocation(state, choice);
      if (location === 'castle' || location === 'village') {
        return location;
      }
      console.warn(`[${this.ai.name}] Invalid location: ${location}`);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectLocation:`, error);
    }
    return fallbackLocation();
  }

  /**
   * Obtenir le choix de defausse de l'IA (avec fallback)
   */
  getDiscardChoice(state: PlayGameState, choice: DiscardChoice): string {
    const availableCards = choice.location === 'castle'
      ? state.board.castleCards
      : state.board.villageCards;

    if (availableCards.length === 0) {
      console.warn(`[${this.ai.name}] No cards to discard`);
      return '';
    }

    try {
      const cardId = this.ai.selectDiscardCard(state, choice, availableCards);
      if (availableCards.includes(cardId)) {
        return cardId;
      }
      console.warn(`[${this.ai.name}] Invalid discard card: ${cardId}`);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectDiscardCard:`, error);
    }
    return fallbackDiscardCard(availableCards);
  }

  /**
   * Obtenir le choix de carte adjacente de l'IA (avec fallback)
   */
  getAdjacentCardChoice(state: PlayGameState, choice: AdjacentCardChoice): number {
    try {
      const position = this.ai.selectAdjacentCard(state, choice);
      if (choice.adjacentPositions.includes(position)) {
        return position;
      }
      console.warn(`[${this.ai.name}] Invalid adjacent card: ${position}`);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectAdjacentCard:`, error);
    }
    return fallbackAdjacentCard(choice);
  }

  /**
   * Obtenir le choix de bourses de l'IA (avec fallback)
   */
  getPurseChoice(state: PlayGameState, choice: PurseSelectionChoice): number[] {
    try {
      const positions = this.ai.selectPurses(state, choice);

      // Valider : toutes les positions doivent etre disponibles
      const valid = positions.every(p => choice.availablePositions.includes(p));
      if (valid && positions.length <= choice.maxCards) {
        return positions;
      }
      console.warn(`[${this.ai.name}] Invalid purse selection: ${positions}`);
    } catch (error) {
      console.error(`[${this.ai.name}] Error in selectPurses:`, error);
    }
    return fallbackPurses(choice);
  }

  /**
   * Verifie si l'IA est disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.ai.isAvailable();
    } catch {
      return false;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Cree une IA securisee selon le niveau
 */
export function createAI(level: AILevel): SafeAIRunner {
  let ai: AIPlayer;

  switch (level) {
    case 'easy':
      ai = new EasyAI();
      break;
    case 'normal':
      ai = new NormalAI();
      break;
    case 'hard':
      ai = new HardAI();
      break;
    case 'neural':
      // Pour l'instant, on fallback sur MCTS
      ai = new HardAI();
      break;
    default:
      ai = new EasyAI();
  }

  return new SafeAIRunner(ai);
}

// =============================================================================
// Exports
// =============================================================================

export { EasyAI } from './easyAI';
export { NormalAI } from './normalAI';
export { HardAI } from './hardAI';
export { AI_ACTION_DELAY };
export type { AIPlayer };
