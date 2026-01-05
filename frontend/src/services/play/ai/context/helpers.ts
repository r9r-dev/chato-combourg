/**
 * Fonctions utilitaires pour l'analyse du contexte IA
 */

import type {
  PlayPlayer,
  PlacedCard,
  PlayCard,
  ShieldColor,
  Location,
} from '../../../../types/play';
import { ADJACENCY_MAP } from '../../../../types/play';
import type { AIContext } from '../types';
import { calculatePlayerScore } from '../evaluator/scoreCalculator';

// =============================================================================
// Helpers sur un joueur
// =============================================================================

/**
 * Nombre de cartes placees sur le plateau
 */
export function getPlacedCount(player: PlayPlayer): number {
  return player.board.filter(c => c !== null).length;
}

/**
 * Total des pieces sur toutes les bourses
 */
export function getTotalCoins(player: PlayPlayer): number {
  return player.board.reduce((sum, card) => {
    return sum + (card?.coinsOnCard ?? 0);
  }, 0);
}

/**
 * Positions des cadenas non ouverts
 */
export function getClosedLocks(player: PlayPlayer): number[] {
  const positions: number[] = [];

  for (const [position, hasKey] of player.lockedCards) {
    if (hasKey) {
      positions.push(position);
    }
  }

  return positions;
}

/**
 * Positions des bourses non pleines
 */
export function getOpenPurses(
  player: PlayPlayer,
  cards: Map<string, PlayCard>
): number[] {
  const positions: number[] = [];

  for (let i = 0; i < player.board.length; i++) {
    const placedCard = player.board[i];
    if (!placedCard) continue;

    const card = cards.get(placedCard.cardId);
    if (!card?.has_coin_purse) continue;

    if (placedCard.coinsOnCard < card.max_coins) {
      positions.push(i);
    }
  }

  return positions;
}

// =============================================================================
// Helpers sur le plateau d'un joueur
// =============================================================================

/**
 * Cartes adjacentes a une position (orthogonales uniquement)
 */
export function getAdjacentCards(
  board: (PlacedCard | null)[],
  position: number
): PlacedCard[] {
  const adjacentPositions = ADJACENCY_MAP[position] ?? [];
  return adjacentPositions
    .map(pos => board[pos])
    .filter((card): card is PlacedCard => card !== null);
}

/**
 * Compte les boucliers d'une couleur sur les cartes adjacentes
 */
export function countAdjacentShields(
  board: (PlacedCard | null)[],
  position: number,
  color: ShieldColor,
  cards: Map<string, PlayCard>
): number {
  const adjacent = getAdjacentCards(board, position);

  return adjacent.reduce((count, placedCard) => {
    const card = cards.get(placedCard.cardId);
    if (!card) return count;

    const shieldCount = card.shields
      .filter(s => s.color === color)
      .reduce((sum, s) => sum + s.count, 0);

    return count + shieldCount;
  }, 0);
}

/**
 * Compte tous les boucliers d'une couleur sur le plateau
 */
export function countTotalShields(
  board: (PlacedCard | null)[],
  color: ShieldColor,
  cards: Map<string, PlayCard>
): number {
  return board.reduce((count, placedCard) => {
    if (!placedCard) return count;

    const card = cards.get(placedCard.cardId);
    if (!card) return count;

    const shieldCount = card.shields
      .filter(s => s.color === color)
      .reduce((sum, s) => sum + s.count, 0);

    return count + shieldCount;
  }, 0);
}

/**
 * Verifie si une position est dans une ligne complete
 */
export function isInCompleteLine(
  board: (PlacedCard | null)[],
  position: number
): boolean {
  const row = Math.floor(position / 3);
  const rowStart = row * 3;

  return (
    board[rowStart] !== null &&
    board[rowStart + 1] !== null &&
    board[rowStart + 2] !== null
  );
}

/**
 * Verifie si une position est dans une colonne complete
 */
export function isInCompleteColumn(
  board: (PlacedCard | null)[],
  position: number
): boolean {
  const col = position % 3;

  return (
    board[col] !== null &&
    board[col + 3] !== null &&
    board[col + 6] !== null
  );
}

/**
 * Retourne les positions de la ligne contenant une position
 */
export function getRowPositions(position: number): number[] {
  const row = Math.floor(position / 3);
  return [row * 3, row * 3 + 1, row * 3 + 2];
}

/**
 * Retourne les positions de la colonne contenant une position
 */
export function getColumnPositions(position: number): number[] {
  const col = position % 3;
  return [col, col + 3, col + 6];
}

// =============================================================================
// Helpers sur les cartes
// =============================================================================

/**
 * Cout effectif d'une carte pour un joueur (avec reductions)
 */
export function getCardEffectiveCost(
  card: PlayCard,
  player: PlayPlayer
): number {
  let reduction = 0;

  if (card.category === 'castle') {
    reduction = player.reductionCastle;
  } else if (card.category === 'village') {
    reduction = player.reductionVillage;
  }

  return Math.max(0, card.value - reduction);
}

/**
 * Verifie si une carte a un effet specifique
 */
export function hasEffect(card: PlayCard, effectType: string): boolean {
  if (card.effects.some(e => e.type === effectType)) {
    return true;
  }

  if (card.lock_effect?.type === effectType) {
    return true;
  }

  // Verifier dans les options [OU]
  for (const effect of card.effects) {
    if (effect.options?.some(opt => opt.type === effectType)) {
      return true;
    }
  }

  return false;
}

/**
 * Recupere les couleurs de boucliers uniques sur un plateau
 */
export function getUniqueShieldColors(
  board: (PlacedCard | null)[],
  cards: Map<string, PlayCard>
): Set<ShieldColor> {
  const colors = new Set<ShieldColor>();

  for (const placedCard of board) {
    if (!placedCard) continue;

    const card = cards.get(placedCard.cardId);
    if (!card) continue;

    for (const shield of card.shields) {
      colors.add(shield.color);
    }
  }

  return colors;
}

/**
 * Compte le nombre de cartes d'une categorie sur le plateau
 */
export function countCategoryCards(
  board: (PlacedCard | null)[],
  category: 'castle' | 'village',
  cards: Map<string, PlayCard>
): number {
  return board.filter(placedCard => {
    if (!placedCard) return false;
    const card = cards.get(placedCard.cardId);
    return card?.category === category;
  }).length;
}

// =============================================================================
// Helpers de scoring
// =============================================================================

/**
 * Calcule le score d'un joueur en utilisant les vraies règles des 92 cartes
 *
 * Cette fonction utilise le calculateur complet qui implémente toutes
 * les règles de scoring du jeu Chateau Combo.
 */
export function estimateScore(
  player: PlayPlayer,
  cards: Map<string, PlayCard>
): number {
  return calculatePlayerScore(player, cards);
}

// =============================================================================
// Helpers pour le contexte
// =============================================================================

/**
 * Obtient les cartes achetables par le joueur courant
 */
export function getAffordableCards(context: AIContext): string[] {
  return context.affordableCards;
}

/**
 * Verifie si le joueur peut utiliser une cle ce tour
 */
export function canUseKey(context: AIContext): boolean {
  return context.me.keys > 0 && !context.keyUsedThisTurn;
}

/**
 * Verifie si le joueur peut ouvrir un cadenas ce tour
 */
export function canOpenLock(context: AIContext): boolean {
  return (
    context.me.keys > 0 &&
    !context.lockUsedThisTurn &&
    getClosedLocks(context.me).length > 0
  );
}

/**
 * Obtient le lieu actuel du messager
 */
export function getMessengerLocation(context: AIContext): Location {
  return context.board.messengerLocation;
}

/**
 * Obtient l'autre lieu (pas celui du messager)
 */
export function getOtherLocation(context: AIContext): Location {
  return context.board.messengerLocation === 'castle' ? 'village' : 'castle';
}
