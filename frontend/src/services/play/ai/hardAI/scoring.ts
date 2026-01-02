/**
 * Scoring pour MCTS
 *
 * Calcule une estimation du score final pour la simulation.
 * Ce n'est pas le score exact (calcule par le backend) mais une
 * heuristique suffisamment bonne pour guider le MCTS.
 */

import type { PlayPlayer, PlacedCard, ShieldColor } from '../../../../types/play';
import { getCard } from '../../gameEngine';

// =============================================================================
// Calcul du score estime
// =============================================================================

/**
 * Estime le score d'un joueur basé sur son plateau
 * Utilise des heuristiques simplifiées pour chaque type de carte de scoring
 */
export function estimateScore(player: PlayPlayer): number {
  let score = 0;

  // Parcourir les cartes placées et calculer leur score
  for (const placed of player.board) {
    if (!placed) continue;

    const cardScore = estimateCardScore(placed, player);
    score += cardScore;
  }

  // Ajouter les clés (pour cartes 017/066)
  const hasKeyScoring = player.board.some(
    p => p && (p.cardId === '017' || p.cardId === '066')
  );
  if (hasKeyScoring) {
    score += player.keys; // 1 pt par clé
  }

  return score;
}

/**
 * Estime le score d'une carte placée
 */
function estimateCardScore(placed: PlacedCard, player: PlayPlayer): number {
  const card = getCard(placed.cardId);
  if (!card) return 0;

  const cardId = placed.cardId;
  const position = placed.position;

  // Cartes retournées (089/090)
  if (placed.isFlipped) {
    return 0;
  }

  // Appeler la règle appropriée selon la carte
  return estimateRuleScore(cardId, position, player, placed);
}

/**
 * Estime le score d'une règle de carte
 */
function estimateRuleScore(
  cardId: string,
  position: number,
  player: PlayPlayer,
  placed: PlacedCard
): number {
  const row = Math.floor(position / 3);
  const col = position % 3;

  // ==========================================================================
  // Boucliers sur ligne/colonne
  // ==========================================================================

  // Boucliers sur colonne
  if (['001', '009', '033', '037', '045', '055'].includes(cardId)) {
    const color = getShieldColorForCard(cardId);
    const points = cardId === '001' ? 4 : 3;
    return countShieldsInCol(player.board, col, color) * points;
  }

  // Boucliers sur ligne
  if (['011', '013', '028', '043', '048', '060', '067', '073'].includes(cardId)) {
    const color = getShieldColorForCard(cardId);
    const points = cardId === '013' ? 4 : 3;
    return countShieldsInRow(player.board, row, color) * points;
  }

  // Boucliers sur ligne ET colonne
  if (['019', '023', '042', '062', '065', '080', '092'].includes(cardId)) {
    const color = getShieldColorForCard(cardId);
    const points = ['019', '062', '080', '092'].includes(cardId) ? 2 : 3;
    const rowCount = countShieldsInRow(player.board, row, color);
    const colCount = countShieldsInCol(player.board, col, color);
    return (rowCount + colCount) * points;
  }

  // ==========================================================================
  // Position
  // ==========================================================================

  if (cardId === '003' && row === 0) return 8;
  if (cardId === '007' && row === 2) return 5;
  if (cardId === '021' && col === 0) return 8;
  if (cardId === '030' && col === 0) return 6;
  if (cardId === '031' && col === 2) return 8;
  if (cardId === '047' && row === 0) return 5;
  if (cardId === '049' && col === 2) return 5;
  if (cardId === '052' && col === 1) return 6;
  if (cardId === '063' && row === 2) return 7;
  if (cardId === '071' && row === 1) return 5;
  if (cardId === '085' && [1, 3, 5, 7].includes(position)) return 3;
  if (cardId === '087' && [0, 2, 6, 8].includes(position)) return 4;

  // ==========================================================================
  // Paires et trios de boucliers
  // ==========================================================================

  if (cardId === '008') {
    return countPairs(player.board, 'pink', 'orange') * 4;
  }
  if (cardId === '022') {
    return countPairs(player.board, 'blue', 'red') * 4;
  }
  if (cardId === '068') {
    return countPairs(player.board, 'green', 'yellow') * 4;
  }
  if (cardId === '018') {
    return countTrios(player.board, ['blue', 'green', 'orange']) * 10;
  }
  if (cardId === '054') {
    return countTrios(player.board, ['pink', 'red', 'yellow']) * 7;
  }
  if (cardId === '027') {
    return countSetsOf3(player.board) * 6;
  }

  // ==========================================================================
  // Pas de bouclier d'une couleur
  // ==========================================================================

  if (cardId === '026' && !hasShieldColor(player.board, 'yellow')) return 10;
  if (cardId === '044' && !hasShieldColor(player.board, 'orange')) return 10;
  if (cardId === '064' && !hasShieldColor(player.board, 'pink')) return 9;
  if (cardId === '072' && !hasShieldColor(player.board, 'green')) return 10;
  if (cardId === '083' && !hasShieldColor(player.board, 'red')) return 10;
  if (cardId === '091' && !hasShieldColor(player.board, 'blue')) return 9;

  // ==========================================================================
  // Categories
  // ==========================================================================

  if (cardId === '006') return countCategory(player.board, 'village') * 2;
  if (cardId === '046' || cardId === '074') return countCategory(player.board, 'castle') * 2;
  if (cardId === '078') return countCategory(player.board, 'village');
  if (cardId === '084') return countCategory(player.board, 'castle');
  if (cardId === '016') {
    const castle = countCategory(player.board, 'castle');
    const village = countCategory(player.board, 'village');
    return Math.min(castle, village) * 3;
  }
  if (cardId === '069') {
    return Math.floor(countCategory(player.board, 'village') / 3) * 7;
  }

  // ==========================================================================
  // Features (reductions, cadenas, bourses)
  // ==========================================================================

  if (cardId === '004' && !hasFeature(player.board, 'price_reduction')) return 8;
  if (cardId === '032') return countFeature(player.board, 'price_reduction') * 4;
  if (cardId === '070') return countFeature(player.board, 'lock') * 4;
  if (cardId === '079' && !hasFeature(player.board, 'coin_purse')) return 10;

  // ==========================================================================
  // Couts des cartes
  // ==========================================================================

  if (cardId === '010') return countUniqueCosts(player.board) * 3;
  if (cardId === '040') return countCardsWithCost(player.board, 4) * 3;
  if (cardId === '086') return countCardsWithCost(player.board, 0) * 2;
  if (cardId === '039') return countCardsWithMinCost(player.board, 5) * 5;

  // ==========================================================================
  // Boucliers par carte
  // ==========================================================================

  if (cardId === '015') return countCardsWithShieldCount(player.board, 1) * 2;
  if (cardId === '057') return countCardsWithShieldCount(player.board, 2) * 2;

  // ==========================================================================
  // Diversite de couleurs
  // ==========================================================================

  if (cardId === '005') return countUniqueColorsInRow(player.board, row) * 4;
  if (cardId === '012') return countUniqueColorsInRow(player.board, row) * 2;
  if (cardId === '024') return countUniqueColorsOnBoard(player.board) * 2;
  if (cardId === '029') return countUniqueColorsInCol(player.board, col) * 4;
  if (cardId === '076') return countUniqueColorsInCol(player.board, col) * 2;

  // ==========================================================================
  // Seuils de boucliers
  // ==========================================================================

  if (cardId === '002') {
    return countShieldsInCol(player.board, col, 'green') >= 1 ? 5 : 0;
  }
  if (cardId === '035') {
    return countShieldsInRow(player.board, row, 'pink') >= 1 ? 5 : 0;
  }
  if (cardId === '075') {
    return countShieldsInRow(player.board, row, 'red') >= 1 ? 7 : 0;
  }
  if (cardId === '088') {
    return countShieldsInCol(player.board, col, 'blue') >= 1 ? 3 : 0;
  }

  // ==========================================================================
  // Bourses (pieces sur carte)
  // ==========================================================================

  if (cardId === '020') {
    return getTotalCoinsOnCards(player.board);
  }

  // Cartes bourse - 2 pts par piece
  if (['014', '025', '036', '041', '050', '051', '053', '058', '059', '061', '081'].includes(cardId)) {
    return (placed.coinsOnCard ?? 0) * 2;
  }

  // ==========================================================================
  // Cartes retournees
  // ==========================================================================

  if (cardId === '056' && !hasFlippedCard(player.board)) return 12;
  if (cardId === '082' && hasFlippedCard(player.board)) return 8;

  // ==========================================================================
  // Couleurs manquantes
  // ==========================================================================

  if (cardId === '038') {
    return (6 - countUniqueColorsOnBoard(player.board)) * 6;
  }

  // Carte sans règle spéciale
  return 0;
}

// =============================================================================
// Helpers
// =============================================================================

function getShieldColorForCard(cardId: string): ShieldColor {
  const colorMap: Record<string, ShieldColor> = {
    '001': 'blue', '009': 'blue', '013': 'blue', '019': 'blue',
    '023': 'blue', '028': 'blue', '088': 'blue',
    '011': 'green', '021': 'green', '033': 'green', '042': 'green',
    '035': 'pink', '037': 'pink', '048': 'pink', '062': 'pink',
    '043': 'red', '045': 'red', '065': 'red', '075': 'red',
    '055': 'yellow', '067': 'yellow', '092': 'yellow',
    '060': 'orange', '073': 'orange', '080': 'orange',
  };
  return colorMap[cardId] ?? 'blue';
}

function countShieldsInRow(board: (PlacedCard | null)[], row: number, color: ShieldColor): number {
  let count = 0;
  for (let col = 0; col < 3; col++) {
    const placed = board[row * 3 + col];
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      if (shield.color === color) count += shield.count;
    }
  }
  return count;
}

function countShieldsInCol(board: (PlacedCard | null)[], col: number, color: ShieldColor): number {
  let count = 0;
  for (let row = 0; row < 3; row++) {
    const placed = board[row * 3 + col];
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      if (shield.color === color) count += shield.count;
    }
  }
  return count;
}

function countShieldsOnBoard(board: (PlacedCard | null)[], color: ShieldColor): number {
  let count = 0;
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      if (shield.color === color) count += shield.count;
    }
  }
  return count;
}

function hasShieldColor(board: (PlacedCard | null)[], color: ShieldColor): boolean {
  return countShieldsOnBoard(board, color) > 0;
}

function countPairs(board: (PlacedCard | null)[], color1: ShieldColor, color2: ShieldColor): number {
  const count1 = countShieldsOnBoard(board, color1);
  const count2 = countShieldsOnBoard(board, color2);
  return Math.min(count1, count2);
}

function countTrios(board: (PlacedCard | null)[], colors: ShieldColor[]): number {
  const counts = colors.map(c => countShieldsOnBoard(board, c));
  return Math.min(...counts);
}

function countSetsOf3(board: (PlacedCard | null)[]): number {
  const colors: ShieldColor[] = ['blue', 'pink', 'green', 'red', 'orange', 'yellow'];
  let total = 0;
  for (const color of colors) {
    total += Math.floor(countShieldsOnBoard(board, color) / 3);
  }
  return total;
}

function countCategory(board: (PlacedCard | null)[], category: 'castle' | 'village'): number {
  let count = 0;
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card?.category === category) count++;
  }
  return count;
}

function hasFeature(board: (PlacedCard | null)[], feature: string): boolean {
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    if (feature === 'price_reduction' && card.has_price_reduction) return true;
    if (feature === 'lock' && card.has_lock) return true;
    if (feature === 'coin_purse' && card.has_coin_purse) return true;
  }
  return false;
}

function countFeature(board: (PlacedCard | null)[], feature: string): number {
  let count = 0;
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    if (feature === 'price_reduction' && card.has_price_reduction) count++;
    if (feature === 'lock' && card.has_lock) count++;
    if (feature === 'coin_purse' && card.has_coin_purse) count++;
  }
  return count;
}

function countUniqueCosts(board: (PlacedCard | null)[]): number {
  const costs = new Set<number>();
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card) costs.add(card.value);
  }
  return costs.size;
}

function countCardsWithCost(board: (PlacedCard | null)[], cost: number): number {
  let count = 0;
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card?.value === cost) count++;
  }
  return count;
}

function countCardsWithMinCost(board: (PlacedCard | null)[], minCost: number): number {
  let count = 0;
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card && card.value >= minCost) count++;
  }
  return count;
}

function countCardsWithShieldCount(board: (PlacedCard | null)[], shieldCount: number): number {
  let count = 0;
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    const totalShields = card.shields.reduce((sum, s) => sum + s.count, 0);
    if (totalShields === shieldCount) count++;
  }
  return count;
}

function countUniqueColorsInRow(board: (PlacedCard | null)[], row: number): number {
  const colors = new Set<ShieldColor>();
  for (let col = 0; col < 3; col++) {
    const placed = board[row * 3 + col];
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      colors.add(shield.color);
    }
  }
  return colors.size;
}

function countUniqueColorsInCol(board: (PlacedCard | null)[], col: number): number {
  const colors = new Set<ShieldColor>();
  for (let row = 0; row < 3; row++) {
    const placed = board[row * 3 + col];
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      colors.add(shield.color);
    }
  }
  return colors.size;
}

function countUniqueColorsOnBoard(board: (PlacedCard | null)[]): number {
  const colors = new Set<ShieldColor>();
  for (const placed of board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      colors.add(shield.color);
    }
  }
  return colors.size;
}

function getTotalCoinsOnCards(board: (PlacedCard | null)[]): number {
  let total = 0;
  for (const placed of board) {
    if (placed) {
      total += placed.coinsOnCard ?? 0;
    }
  }
  return total;
}

function hasFlippedCard(board: (PlacedCard | null)[]): boolean {
  return board.some(p => p?.isFlipped);
}

// =============================================================================
// Evaluation relative (pour MCTS)
// =============================================================================

/**
 * Calcule le score relatif d'un joueur par rapport aux autres
 * Positif = en avance, Negatif = en retard
 */
export function getRelativeScore(
  playerId: string,
  players: PlayPlayer[]
): number {
  const player = players.find(p => p.id === playerId);
  if (!player) return 0;

  const myScore = estimateScore(player);
  const otherScores = players
    .filter(p => p.id !== playerId)
    .map(p => estimateScore(p));

  const maxOpponentScore = Math.max(...otherScores, 0);

  return myScore - maxOpponentScore;
}

/**
 * Calcule un score normalise entre 0 et 1 pour le MCTS
 * 0.5 = egalite, > 0.5 = en avance, < 0.5 = en retard
 */
export function getNormalizedScore(
  playerId: string,
  players: PlayPlayer[]
): number {
  const relative = getRelativeScore(playerId, players);

  // Normaliser avec une sigmoid douce
  // Un ecart de 20 points donne ~0.88 ou ~0.12
  return 1 / (1 + Math.exp(-relative / 10));
}
