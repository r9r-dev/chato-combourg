/**
 * Normal AI - IA Normale
 *
 * Comportement :
 * - Evalue les cartes selon des heuristiques
 * - Privilegie les cartes avec synergies (boucliers, categories)
 * - Utilise les cles de maniere basique
 * - Placement intelligent (optimise les lignes/colonnes)
 */

import type {
  AIPlayer,
  AILevel,
  PlayGameState,
  GameAction,
  PlayPlayer,
  ShieldColor,
} from '../../../types/play';
import { getValidPlacements } from '../../../types/play';
import {
  getCard,
  getAvailableCards,
  canAffordCard,
  getCurrentPlayer,
} from '../gameEngine';

export class NormalAI implements AIPlayer {
  level: AILevel = 'normal';
  name = 'IA Normale';

  async selectAction(state: PlayGameState): Promise<GameAction> {
    const player = getCurrentPlayer(state);
    const playerId = player.id;

    switch (state.turnPhase) {
      case 'pre_action':
        // Considerer l'utilisation d'une cle
        const keyAction = this.considerKeyAction(state, playerId);
        if (keyAction) return keyAction;
        // Sinon, passer a l'achat
        return this.selectBuyAction(state, playerId);

      case 'buy':
        return this.selectBuyAction(state, playerId);

      case 'place':
        return this.selectPlaceAction(state, playerId);

      case 'effect':
        return this.selectEffectAction(state, playerId);

      case 'post_action':
      case 'end':
        return { type: 'end_turn', playerId };

      default:
        return { type: 'end_turn', playerId };
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  private considerKeyAction(
    state: PlayGameState,
    playerId: string
  ): GameAction | null {
    const player = getCurrentPlayer(state);

    // Si on a des cles et que le messager n'est pas au bon endroit
    if (player.keys > 0) {
      const availableCards = getAvailableCards(state);
      const affordableCount = availableCards.filter(
        cardId => canAffordCard(player, cardId).canAfford
      ).length;

      // Si aucune carte abordable, deplacer le messager
      if (affordableCount === 0) {
        const otherLocation = state.board.messengerLocation === 'castle' ? 'village' : 'castle';
        return {
          type: 'spend_key',
          playerId,
          targetLocation: otherLocation,
        };
      }
    }

    return null;
  }

  private selectBuyAction(state: PlayGameState, playerId: string): GameAction {
    const player = getCurrentPlayer(state);
    const availableCards = getAvailableCards(state);

    // Evaluer chaque carte
    const cardScores: { cardId: string; score: number; canAfford: boolean }[] = [];

    for (const cardId of availableCards) {
      const { canAfford, cost } = canAffordCard(player, cardId);
      const score = this.evaluateCard(cardId, player, cost);
      cardScores.push({ cardId, score, canAfford });
    }

    // Filtrer les cartes abordables et trier par score
    const affordableCards = cardScores
      .filter(c => c.canAfford)
      .sort((a, b) => b.score - a.score);

    if (affordableCards.length === 0) {
      // Prendre une carte face cachee - la moins chere
      const cheapest = cardScores.sort((a, b) => {
        const cardA = getCard(a.cardId);
        const cardB = getCard(b.cardId);
        return (cardA?.value ?? 0) - (cardB?.value ?? 0);
      })[0];

      return {
        type: 'buy_card_flipped',
        playerId,
        cardId: cheapest.cardId,
      };
    }

    // Prendre la meilleure carte
    return {
      type: 'buy_card',
      playerId,
      cardId: affordableCards[0].cardId,
    };
  }

  private selectPlaceAction(state: PlayGameState, playerId: string): GameAction {
    const player = getCurrentPlayer(state);
    const validPositions = getValidPlacements(player.board);
    const purchasedCard = state.purchasedCard;

    if (!purchasedCard || validPositions.length === 0) {
      return {
        type: 'place_card',
        playerId,
        position: validPositions[0] ?? 4, // Centre par defaut
      };
    }

    // Evaluer chaque position
    const positionScores = validPositions.map(pos => ({
      position: pos,
      score: this.evaluatePosition(purchasedCard, pos, player),
    }));

    // Trier par score et prendre la meilleure
    positionScores.sort((a, b) => b.score - a.score);

    return {
      type: 'place_card',
      playerId,
      position: positionScores[0].position,
    };
  }

  private selectEffectAction(state: PlayGameState, playerId: string): GameAction {
    const player = getCurrentPlayer(state);

    // Pour les effets avec choix, evaluer les deux options
    // Heuristique simple: preferer l'or en debut de partie, les cles en fin

    const cardCount = player.board.filter(c => c !== null).length;
    const preferKeys = cardCount >= 6; // En fin de partie, les cles valent plus

    return {
      type: 'choose_effect',
      playerId,
      choiceIndex: preferKeys ? 1 : 0, // Assume option 0 = or, option 1 = cles
    };
  }

  // ===========================================================================
  // Evaluation
  // ===========================================================================

  private evaluateCard(
    cardId: string,
    player: PlayPlayer,
    cost: number
  ): number {
    const card = getCard(cardId);
    if (!card) return 0;

    let score = 0;

    // Bonus pour les boucliers qui matchent ceux qu'on a deja
    const existingColors = this.getExistingShieldColors(player);
    for (const shield of card.shields) {
      if (existingColors.has(shield.color)) {
        score += shield.count * 3; // Synergie de couleur
      } else {
        score += shield.count * 1; // Nouvelle couleur (diversite)
      }
    }

    // Bonus pour les reductions
    if (card.has_price_reduction) {
      score += 5;
    }

    // Bonus pour le messager (flexibilite)
    if (card.has_messenger) {
      score += 2;
    }

    // Bonus pour les bourses
    if (card.has_coin_purse) {
      score += card.max_coins * 0.5;
    }

    // Malus pour le cout eleve
    score -= cost * 0.5;

    return score;
  }

  private evaluatePosition(
    cardId: string,
    position: number,
    player: PlayPlayer
  ): number {
    const card = getCard(cardId);
    if (!card) return 0;

    let score = 0;
    const row = Math.floor(position / 3);
    const col = position % 3;

    // Compter les boucliers sur la meme ligne et colonne
    for (let i = 0; i < 9; i++) {
      const placed = player.board[i];
      if (!placed) continue;

      const placedCard = getCard(placed.cardId);
      if (!placedCard) continue;

      const placedRow = Math.floor(i / 3);
      const placedCol = i % 3;

      // Meme ligne
      if (placedRow === row) {
        for (const shield of card.shields) {
          for (const placedShield of placedCard.shields) {
            if (shield.color === placedShield.color) {
              score += 2; // Synergie sur la ligne
            }
          }
        }
      }

      // Meme colonne
      if (placedCol === col) {
        for (const shield of card.shields) {
          for (const placedShield of placedCard.shields) {
            if (shield.color === placedShield.color) {
              score += 2; // Synergie sur la colonne
            }
          }
        }
      }
    }

    // Bonus pour le centre (plus de flexibilite)
    if (position === 4) {
      score += 1;
    }

    return score;
  }

  private getExistingShieldColors(player: PlayPlayer): Set<ShieldColor> {
    const colors = new Set<ShieldColor>();

    for (const placed of player.board) {
      if (!placed) continue;
      const card = getCard(placed.cardId);
      if (!card) continue;

      for (const shield of card.shields) {
        colors.add(shield.color as ShieldColor);
      }
    }

    return colors;
  }
}
