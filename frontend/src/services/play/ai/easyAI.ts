/**
 * Easy AI - IA Facile
 *
 * Comportement :
 * - Choix aleatoire parmi les cartes abordables
 * - Placement aleatoire valide
 * - N'utilise pas les cles strategiquement
 * - Prend les choix d'effets au hasard
 */

import type {
  AIPlayer,
  AILevel,
  PlayGameState,
  GameAction,
} from '../../../types/play';
import { getValidPlacements } from '../../../types/play';
import {
  getAvailableCards,
  canAffordCard,
  getCurrentPlayer,
} from '../gameEngine';

export class EasyAI implements AIPlayer {
  level: AILevel = 'easy';
  name = 'IA Facile';

  async selectAction(state: PlayGameState): Promise<GameAction> {
    const player = getCurrentPlayer(state);
    const playerId = player.id;

    switch (state.turnPhase) {
      case 'pre_action':
      case 'buy':
        return this.selectBuyAction(state, playerId);

      case 'place':
        return this.selectPlaceAction(state, playerId);

      case 'effect':
        return this.selectEffectAction(state, playerId);

      case 'post_action':
        return this.selectPostAction(state, playerId);

      case 'end':
        return { type: 'end_turn', playerId };

      default:
        return { type: 'end_turn', playerId };
    }
  }

  async isAvailable(): Promise<boolean> {
    return true; // Toujours disponible
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  private selectBuyAction(state: PlayGameState, playerId: string): GameAction {
    const player = getCurrentPlayer(state);

    // Verifier si on peut utiliser un cadenas (50% de chance de l'utiliser)
    // Un seul cadenas par tour (verifie via lockUsedThisTurn)
    if (state.turnPhase === 'pre_action' && !state.lockUsedThisTurn && Math.random() < 0.5) {
      const locksWithKeys: number[] = [];
      for (const [position, hasKey] of player.lockedCards) {
        if (hasKey) locksWithKeys.push(position);
      }
      if (locksWithKeys.length > 0) {
        const randomLock = locksWithKeys[Math.floor(Math.random() * locksWithKeys.length)];
        return {
          type: 'use_key_on_lock',
          playerId,
          lockPosition: randomLock,
        };
      }
    }

    const availableCards = getAvailableCards(state);

    // Filtrer les cartes abordables
    const affordableCards = availableCards.filter(cardId => {
      const { canAfford } = canAffordCard(player, cardId);
      return canAfford;
    });

    if (affordableCards.length === 0) {
      // Prendre une carte face cachee (toujours possible)
      const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
      return {
        type: 'buy_card_flipped',
        playerId,
        cardId: randomCard,
      };
    }

    // Choisir une carte au hasard
    const randomCard = affordableCards[Math.floor(Math.random() * affordableCards.length)];
    return {
      type: 'buy_card',
      playerId,
      cardId: randomCard,
    };
  }

  private selectPlaceAction(state: PlayGameState, playerId: string): GameAction {
    const player = getCurrentPlayer(state);
    const validPositions = getValidPlacements(player.board);

    // Choisir une position au hasard
    const randomPosition = validPositions[Math.floor(Math.random() * validPositions.length)];

    return {
      type: 'place_card',
      playerId,
      position: randomPosition,
    };
  }

  private selectEffectAction(_state: PlayGameState, playerId: string): GameAction {
    // Pour les effets avec choix, prendre au hasard
    return {
      type: 'choose_effect',
      playerId,
      choiceIndex: Math.random() < 0.5 ? 0 : 1,
    };
  }

  private selectPostAction(state: PlayGameState, playerId: string): GameAction {
    const player = getCurrentPlayer(state);

    // Verifier si on peut utiliser un cadenas (50% de chance de l'utiliser)
    // Un seul cadenas par tour (verifie via lockUsedThisTurn)
    if (!state.lockUsedThisTurn && Math.random() < 0.5) {
      const locksWithKeys: number[] = [];
      for (const [position, hasKey] of player.lockedCards) {
        if (hasKey) locksWithKeys.push(position);
      }
      if (locksWithKeys.length > 0) {
        const randomLock = locksWithKeys[Math.floor(Math.random() * locksWithKeys.length)];
        return {
          type: 'use_key_on_lock',
          playerId,
          lockPosition: randomLock,
        };
      }
    }

    // Terminer le tour
    return { type: 'end_turn', playerId };
  }
}
