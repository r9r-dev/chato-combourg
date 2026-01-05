/**
 * IA Normale
 *
 * Utilise des heuristiques pour evaluer les coups.
 * Considere les synergies et le positionnement.
 */

import type {
  AILevel,
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  PlayGameState,
  Location,
  DiscardChoice,
  ReplaceLocationChoice,
} from '../../../../types/play';
import { BaseAI } from './baseAI';
import { ADJACENCY_MAP } from '../../../../types/play';

/**
 * IA Normale - heuristiques equilibrees
 */
export class NormalAI extends BaseAI {
  level: AILevel = 'normal';
  name = 'Strategique';

  /**
   * Choisit une carte a acheter en evaluant les synergies
   */
  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const player = this.getCurrentPlayer(state);
    const cards = this.getCards();
    const affordableCards = this.getAffordableCards(state, availableCards);

    // Si aucune carte achetable, acheter face cachee
    if (affordableCards.length === 0) {
      return {
        cardId: this.pickRandom(availableCards),
        flipped: true,
      };
    }

    // Evaluer chaque carte
    const evaluatedCards = affordableCards.map(cardId => {
      const card = cards.get(cardId);
      if (!card) return { cardId, score: 0 };

      let score = 0;

      // Score de base : valeur de la carte
      score += card.value;

      // Bonus pour les reductions (surtout en debut de partie)
      if (card.has_price_reduction) {
        const turnsRemaining = 9 - state.turnNumber;
        score += turnsRemaining * 0.5;
      }

      // Bonus pour les bourses
      if (card.has_coin_purse) {
        score += card.max_coins * 0.3;
      }

      // Bonus pour les cartes qui matchent la categorie dominante
      const castleCount = this.countCategory(player.board, 'castle');
      const villageCount = this.countCategory(player.board, 'village');
      if (card.category === 'castle' && castleCount >= villageCount) {
        score += 1;
      } else if (card.category === 'village' && villageCount >= castleCount) {
        score += 1;
      }

      // Bonus pour les nouvelles couleurs de boucliers
      const existingColors = this.getExistingColors(player.board);
      for (const shield of card.shields) {
        if (!existingColors.has(shield.color)) {
          score += 2; // Nouvelle couleur = bonus
        }
      }

      // Malus si on n'a pas assez de cles pour les cadenas
      if (card.has_lock && player.keys === 0) {
        score -= 1;
      }

      return { cardId, score };
    });

    // Choisir la meilleure carte
    evaluatedCards.sort((a, b) => b.score - a.score);
    const best = evaluatedCards[0];

    return {
      cardId: best.cardId,
      flipped: false,
    };
  }

  /**
   * Choisit une position de placement en evaluant les synergies
   */
  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    if (validPositions.length === 0) {
      throw new Error('[NormalAI] No valid positions');
    }

    if (validPositions.length === 1) {
      return validPositions[0];
    }

    const player = this.getCurrentPlayer(state);
    const card = this.getCards().get(cardId);

    // Evaluer chaque position
    const evaluatedPositions = validPositions.map(position => {
      let score = 0;

      // Compter les voisins
      const adjacentCards = this.getAdjacentOccupied(player.board, position);
      score += adjacentCards.length * 2;

      // Bonus si complete une ligne ou colonne
      if (this.wouldCompleteLine(player.board, position)) {
        score += 3;
      }
      if (this.wouldCompleteColumn(player.board, position)) {
        score += 3;
      }

      // Bonus pour le centre (plus de voisins potentiels)
      if (position === 4) {
        score += 1;
      }

      // Bonus pour les synergies de couleurs avec les voisins
      if (card) {
        for (const adjacent of adjacentCards) {
          const adjacentCard = this.getCards().get(adjacent.cardId);
          if (adjacentCard) {
            // Verifier les couleurs communes
            for (const shield of card.shields) {
              if (adjacentCard.shields.some(s => s.color === shield.color)) {
                score += 1;
              }
            }
          }
        }
      }

      return { position, score };
    });

    // Choisir la meilleure position
    evaluatedPositions.sort((a, b) => b.score - a.score);
    return evaluatedPositions[0].position;
  }

  /**
   * Decide si utiliser une cle
   */
  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    const player = this.getCurrentPlayer(state);

    if (player.keys === 0 || state.keyUsedThisTurn) {
      return null;
    }

    // Evaluer si le refresh ou le deplacement du messager vaut le coup
    const messengerCards = state.board.messengerLocation === 'castle'
      ? state.board.castleCards
      : state.board.villageCards;

    const otherCards = state.board.messengerLocation === 'castle'
      ? state.board.villageCards
      : state.board.castleCards;

    // Calculer la valeur moyenne des cartes disponibles
    const avgMessenger = this.averageCardValue(messengerCards);
    const avgOther = this.averageCardValue(otherCards);

    // Deplacer le messager si l'autre lieu est meilleur
    if (avgOther > avgMessenger + 1) {
      return {
        type: 'move_messenger',
        targetLocation: state.board.messengerLocation === 'castle' ? 'village' : 'castle',
      };
    }

    // Sinon, ne pas utiliser de cle
    return null;
  }

  /**
   * Decide si ouvrir un cadenas
   */
  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    const player = this.getCurrentPlayer(state);

    if (player.keys === 0 || state.lockUsedThisTurn || availableLocks.length === 0) {
      return null;
    }

    // Garder au moins une cle pour le futur si possible
    if (player.keys <= 1 && state.turnNumber < 7) {
      return null;
    }

    // Ouvrir le premier cadenas disponible
    return availableLocks[0];
  }

  /**
   * Choisit entre plusieurs options d'effet
   */
  selectEffectOption(state: PlayGameState, options: AIEffectOption[]): number {
    const player = this.getCurrentPlayer(state);

    // Evaluer chaque option
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (const option of options) {
      let score = 0;

      // Preferer l'or si on en manque
      if (option.description.includes('or') && player.gold < 5) {
        score += 3;
      }

      // Preferer les cles si on en a peu
      if (option.description.includes('cle') && player.keys < 2) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = option.index;
      }
    }

    return bestIndex;
  }

  /**
   * Choisit un lieu pour un effet
   */
  selectLocation(state: PlayGameState, _choice: ReplaceLocationChoice): Location {
    // Choisir le lieu avec les cartes les moins interessantes
    const castleValue = this.averageCardValue(state.board.castleCards);
    const villageValue = this.averageCardValue(state.board.villageCards);

    return castleValue < villageValue ? 'castle' : 'village';
  }

  /**
   * Choisit une carte a defausser
   */
  selectDiscardCard(_state: PlayGameState, _choice: DiscardChoice, availableCards: string[]): string {
    // Defausser la carte la moins utile pour nous
    const evaluatedCards = availableCards.map(cardId => {
      const card = this.getCards().get(cardId);
      let score = card?.value ?? 0;

      // Malus si la carte nous serait utile
      // (Par exemple, si elle match notre strategie)
      return { cardId, score };
    });

    // Defausser celle avec le plus haut score (la moins utile)
    evaluatedCards.sort((a, b) => b.score - a.score);
    return evaluatedCards[0].cardId;
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  private countCategory(board: any[], category: string): number {
    return board.filter(card => {
      if (!card) return false;
      const cardData = this.getCards().get(card.cardId);
      return cardData?.category === category;
    }).length;
  }

  private getExistingColors(board: any[]): Set<string> {
    const colors = new Set<string>();
    for (const placed of board) {
      if (!placed) continue;
      const card = this.getCards().get(placed.cardId);
      if (card) {
        for (const shield of card.shields) {
          colors.add(shield.color);
        }
      }
    }
    return colors;
  }

  private getAdjacentOccupied(board: any[], position: number): any[] {
    const adjacent = ADJACENCY_MAP[position] ?? [];
    return adjacent.map(pos => board[pos]).filter(card => card !== null);
  }

  private wouldCompleteLine(board: any[], position: number): boolean {
    const row = Math.floor(position / 3);
    const rowPositions = [row * 3, row * 3 + 1, row * 3 + 2];
    const otherPositions = rowPositions.filter(p => p !== position);
    return otherPositions.every(p => board[p] !== null);
  }

  private wouldCompleteColumn(board: any[], position: number): boolean {
    const col = position % 3;
    const colPositions = [col, col + 3, col + 6];
    const otherPositions = colPositions.filter(p => p !== position);
    return otherPositions.every(p => board[p] !== null);
  }

  private averageCardValue(cardIds: string[]): number {
    if (cardIds.length === 0) return 0;

    let total = 0;
    for (const cardId of cardIds) {
      const card = this.getCards().get(cardId);
      total += card?.value ?? 0;
    }

    return total / cardIds.length;
  }
}
