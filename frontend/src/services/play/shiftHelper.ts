/**
 * Helper pour le shift automatique du plateau
 *
 * Apres chaque placement de carte, ce helper evalue si un decalage
 * du plateau permettrait d'augmenter les points des cartes avec
 * bonus de position.
 */

import type { PlacedCard, ShiftDirection } from '../../types/play';
import { canShiftBoard, shiftBoard } from '../../types/play';

// =============================================================================
// Helpers de position
// =============================================================================

const isTopRow = (pos: number): boolean => pos < 3;
const isBottomRow = (pos: number): boolean => pos >= 6;
const isLeftCol = (pos: number): boolean => pos % 3 === 0;
const isRightCol = (pos: number): boolean => pos % 3 === 2;
const isMiddleCol = (pos: number): boolean => pos % 3 === 1;
const isMiddleRow = (pos: number): boolean => pos >= 3 && pos < 6;
const isCorner = (pos: number): boolean => [0, 2, 6, 8].includes(pos);
const isBorder = (pos: number): boolean =>
  !isCorner(pos) && (isTopRow(pos) || isBottomRow(pos) || isLeftCol(pos) || isRightCol(pos));

// =============================================================================
// Configuration des cartes avec bonus de position
// =============================================================================

interface PositionBonus {
  check: (pos: number) => boolean;
  score: number;
}

const POSITION_BONUS_CARDS: Record<string, PositionBonus> = {
  '003': { check: isTopRow, score: 8 },      // Duchesse
  '007': { check: isBottomRow, score: 5 },   // Maître de guilde
  '021': { check: isLeftCol, score: 8 },     // Astronome
  '030': { check: isLeftCol, score: 6 },     // Orfèvre
  '031': { check: isRightCol, score: 8 },    // Capitaine
  '047': { check: isTopRow, score: 5 },      // Mère supérieure
  '049': { check: isRightCol, score: 5 },    // Bûcheron
  '052': { check: isMiddleCol, score: 6 },   // Espion
  '063': { check: isBottomRow, score: 7 },   // Agricultrice
  '071': { check: isMiddleRow, score: 5 },   // Épicière
  '085': { check: isBorder, score: 3 },      // Boulangère
  '087': { check: isCorner, score: 4 },      // Pêcheur
};

// =============================================================================
// Fonctions de calcul
// =============================================================================

/**
 * Calcule le score total de position pour un plateau
 */
function calculatePositionScore(board: (PlacedCard | null)[]): number {
  let score = 0;

  for (let pos = 0; pos < 9; pos++) {
    const card = board[pos];
    if (card === null) continue;

    const bonus = POSITION_BONUS_CARDS[card.cardId];
    if (bonus && bonus.check(pos)) {
      score += bonus.score;
    }
  }

  return score;
}

/**
 * Evalue le gain de points d'un shift dans une direction
 * Retourne la difference de score (positif = gain, negatif = perte)
 */
function evaluateShiftGain(
  board: (PlacedCard | null)[],
  direction: ShiftDirection
): number {
  if (!canShiftBoard(board, direction)) {
    return -Infinity;
  }

  const currentScore = calculatePositionScore(board);
  const shiftedBoard = shiftBoard(board, direction);
  const newScore = calculatePositionScore(shiftedBoard);

  return newScore - currentScore;
}

/**
 * Trouve le meilleur shift (gain > 0)
 * Retourne null si aucun shift n'est benefique
 */
function findOptimalShift(board: (PlacedCard | null)[]): ShiftDirection | null {
  const directions: ShiftDirection[] = ['up', 'down', 'left', 'right'];

  let bestDirection: ShiftDirection | null = null;
  let bestGain = 0;

  for (const direction of directions) {
    const gain = evaluateShiftGain(board, direction);
    if (gain > bestGain) {
      bestGain = gain;
      bestDirection = direction;
    }
  }

  return bestDirection;
}

// =============================================================================
// Interface de resultat
// =============================================================================

export interface ShiftResult {
  shifted: boolean;
  board: (PlacedCard | null)[];
  lockedCards: Map<number, boolean>;
  direction?: ShiftDirection;
  gain?: number;
}

/**
 * Applique le shift optimal si benefique
 * Met a jour le plateau et les lockedCards
 */
export function applyOptimalShift(
  board: (PlacedCard | null)[],
  lockedCards: Map<number, boolean>
): ShiftResult {
  const optimalDirection = findOptimalShift(board);

  if (optimalDirection === null) {
    return {
      shifted: false,
      board,
      lockedCards,
    };
  }

  const shiftedBoard = shiftBoard(board, optimalDirection);

  // Mettre a jour les positions dans lockedCards
  const newLockedCards = new Map<number, boolean>();
  for (const [oldPos, hasKey] of lockedCards) {
    const oldCard = board[oldPos];
    if (oldCard) {
      const newPos = shiftedBoard.findIndex(c => c !== null && c.cardId === oldCard.cardId);
      if (newPos >= 0) {
        newLockedCards.set(newPos, hasKey);
      }
    }
  }

  const gain = calculatePositionScore(shiftedBoard) - calculatePositionScore(board);

  return {
    shifted: true,
    board: shiftedBoard,
    lockedCards: newLockedCards,
    direction: optimalDirection,
    gain,
  };
}
