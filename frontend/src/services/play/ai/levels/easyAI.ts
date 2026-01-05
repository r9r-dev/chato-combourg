/**
 * IA Facile
 *
 * Fait des erreurs volontaires pour etre battable par les debutants.
 * - Choisit parmi les top 5 actions au lieu de la meilleure
 * - Ignore souvent les cles et cadenas
 * - Ne considere pas les adversaires
 */

import type {
  AILevel,
  AIBuyDecision,
  AIKeyAction,
  PlayGameState,
} from '../../../../types/play';
import { BaseAI } from './baseAI';
import type { EasyAIConfig } from '../types';

const DEFAULT_CONFIG: EasyAIConfig = {
  randomFromTopN: 5,
  skipKeyProbability: 0.7,
  skipLockProbability: 0.8,
  ignoreOpponents: true,
  preferSimpleCards: true,
};

/**
 * IA Facile - fait des erreurs volontaires
 */
export class EasyAI extends BaseAI {
  level: AILevel = 'easy';
  name = 'Debutant';
  private config: EasyAIConfig;

  constructor(config: Partial<EasyAIConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Choisit une carte a acheter
   * Prefere les cartes simples et choisit parmi les top 5
   */
  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const affordableCards = this.getAffordableCards(state, availableCards);

    // Si aucune carte achetable, acheter face cachee
    if (affordableCards.length === 0) {
      return {
        cardId: this.pickRandom(availableCards),
        flipped: true,
      };
    }

    // Evaluer les cartes (simpliste)
    const evaluatedCards = affordableCards.map(cardId => {
      const card = this.getCards().get(cardId);
      let score = card?.value ?? 0;

      // Malus pour les cartes complexes (avec effet cadenas)
      if (this.config.preferSimpleCards && card?.has_lock) {
        score -= 2;
      }

      // Bonus pour les cartes avec reduction (l'IA facile les aime)
      if (card?.has_price_reduction) {
        score += 1;
      }

      return { cardId, score };
    });

    // Trier par score decroissant
    evaluatedCards.sort((a, b) => b.score - a.score);

    // Choisir parmi les top N
    const selected = this.pickFromTopN(evaluatedCards, this.config.randomFromTopN);

    return {
      cardId: selected.cardId,
      flipped: false,
    };
  }

  /**
   * Choisit une position de placement
   * Choisit parmi les positions valides sans trop reflechir
   */
  selectPlaceAction(state: PlayGameState, _cardId: string, validPositions: number[]): number {
    if (validPositions.length === 0) {
      throw new Error('[EasyAI] No valid positions');
    }

    // Si une seule position, pas de choix
    if (validPositions.length === 1) {
      return validPositions[0];
    }

    // Evaluer grossierement les positions
    const player = this.getCurrentPlayer(state);
    const evaluatedPositions = validPositions.map(position => {
      let score = 0;

      // Preferer le centre (position 4)
      if (position === 4) score += 2;

      // Preferer les positions avec des voisins
      const adjacentCount = this.countOccupiedAdjacent(player.board, position);
      score += adjacentCount;

      return { position, score };
    });

    // Trier et choisir parmi les meilleurs
    evaluatedPositions.sort((a, b) => b.score - a.score);
    const selected = this.pickFromTopN(evaluatedPositions, 3);

    return selected.position;
  }

  /**
   * Decide si utiliser une cle
   * L'IA facile ignore souvent les cles
   */
  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    // Probabilite de ne pas utiliser de cle
    if (Math.random() < this.config.skipKeyProbability) {
      return null;
    }

    const player = this.getCurrentPlayer(state);
    if (player.keys === 0 || state.keyUsedThisTurn) {
      return null;
    }

    // Deplacer le messager vers l'autre lieu (action simple)
    const otherLocation = state.board.messengerLocation === 'castle' ? 'village' : 'castle';
    return {
      type: 'move_messenger',
      targetLocation: otherLocation,
    };
  }

  /**
   * Decide si ouvrir un cadenas
   * L'IA facile ignore presque toujours les cadenas
   */
  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    // Probabilite de ne pas ouvrir de cadenas
    if (Math.random() < this.config.skipLockProbability) {
      return null;
    }

    const player = this.getCurrentPlayer(state);
    if (player.keys === 0 || state.lockUsedThisTurn || availableLocks.length === 0) {
      return null;
    }

    // Choisir au hasard
    return this.pickRandom(availableLocks);
  }

  /**
   * Compte les positions adjacentes occupees
   */
  private countOccupiedAdjacent(board: (any | null)[], position: number): number {
    const adjacencyMap: Record<number, number[]> = {
      0: [1, 3],
      1: [0, 2, 4],
      2: [1, 5],
      3: [0, 4, 6],
      4: [1, 3, 5, 7],
      5: [2, 4, 8],
      6: [3, 7],
      7: [4, 6, 8],
      8: [5, 7],
    };

    const adjacent = adjacencyMap[position] ?? [];
    return adjacent.filter(pos => board[pos] !== null).length;
  }
}
