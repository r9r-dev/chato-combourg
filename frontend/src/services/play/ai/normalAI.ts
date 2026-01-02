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
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  PlayGameState,
  PlayPlayer,
  ShieldColor,
  DiscardChoice,
  ReplaceLocationChoice,
  AdjacentCardChoice,
  PurseSelectionChoice,
  Location,
} from '../../../types/play';
import {
  getCard,
  canAffordCard,
  getCurrentPlayer,
} from '../gameEngine';

export class NormalAI implements AIPlayer {
  level: AILevel = 'normal';
  name = 'IA Normale';

  // ===========================================================================
  // Actions obligatoires
  // ===========================================================================

  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const player = getCurrentPlayer(state);

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

      return { cardId: cheapest.cardId, flipped: true };
    }

    // Prendre la meilleure carte
    return { cardId: affordableCards[0].cardId, flipped: false };
  }

  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    const player = getCurrentPlayer(state);

    if (validPositions.length === 0) {
      return 4; // Centre par defaut
    }

    // Evaluer chaque position
    const positionScores = validPositions.map(pos => ({
      position: pos,
      score: this.evaluatePosition(cardId, pos, player),
    }));

    // Trier par score et prendre la meilleure
    positionScores.sort((a, b) => b.score - a.score);

    return positionScores[0].position;
  }

  // ===========================================================================
  // Actions facultatives
  // ===========================================================================

  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    const player = getCurrentPlayer(state);

    // Compter les cartes abordables dans le lieu actuel
    const currentLocation = state.board.messengerLocation;
    const currentCards = currentLocation === 'castle'
      ? state.board.castleCards
      : state.board.villageCards;

    const affordableCount = currentCards.filter(
      cardId => canAffordCard(player, cardId).canAfford
    ).length;

    // Si aucune carte abordable, deplacer le messager
    if (affordableCount === 0) {
      const otherLocation = currentLocation === 'castle' ? 'village' : 'castle';
      return {
        type: 'move_messenger',
        targetLocation: otherLocation,
      };
    }

    return null;
  }

  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    const player = getCurrentPlayer(state);
    const cardCount = player.board.filter(c => c !== null).length;

    // En fin de partie (>= 6 cartes), utiliser les cadenas
    if (cardCount >= 6 && availableLocks.length > 0) {
      // Choisir le premier cadenas disponible
      return availableLocks[0];
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

    // En fin de partie, preferer les cles (souvent option 1)
    // En debut de partie, preferer l'or (souvent option 0)
    const preferKeys = cardCount >= 6;

    return preferKeys ? Math.min(1, options.length - 1) : 0;
  }

  selectLocation(state: PlayGameState, choice: ReplaceLocationChoice): Location {
    // Choisir le lieu qui maximise le gain de cles
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
    // Defausser la carte la plus chere (maximise le gain)
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

    // Choisir la carte adjacente qui donne le plus de ressources
    let bestPosition = choice.adjacentPositions[0];
    let bestScore = -Infinity;

    for (const pos of choice.adjacentPositions) {
      const placed = player.board[pos];
      if (!placed) continue;

      const card = getCard(placed.cardId);
      if (!card) continue;

      // Score simple : nombre d'effets * 10 + valeur
      let score = card.effects.length * 10 + card.value;

      // Bonus si l'effet donne de l'or
      for (const effect of card.effects) {
        if (effect.type.includes('gold')) {
          score += 5;
        }
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

    // Trier par capacite restante (remplir les bourses presque pleines en priorite)
    const pursesWithCapacity = choice.availablePositions.map(pos => {
      const placed = player.board[pos];
      if (!placed) return { pos, remaining: Infinity };

      const card = getCard(placed.cardId);
      if (!card) return { pos, remaining: Infinity };

      const current = placed.coinsOnCard ?? 0;
      const max = card.max_coins ?? 0;
      return { pos, remaining: max - current };
    });

    // Trier par capacite restante (petite = prioritaire)
    pursesWithCapacity.sort((a, b) => a.remaining - b.remaining);

    return pursesWithCapacity.slice(0, choice.maxCards).map(p => p.pos);
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  async isAvailable(): Promise<boolean> {
    return true;
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
      score += (card.max_coins ?? 0) * 0.5;
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
