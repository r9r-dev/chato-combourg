/**
 * Calculateur de score complet basé sur les règles des 92 cartes
 *
 * Ce module est une conversion TypeScript du calculateur Python backend.
 * Il permet à l'IA d'évaluer précisément les positions de jeu.
 */

import type { PlayCard, PlayPlayer } from '../../../../types/play';

// =============================================================================
// Types
// =============================================================================

type RuleFunction = (grid: Grid, position: number, keys?: number) => number;

// =============================================================================
// Grid Class
// =============================================================================

const COLORS = ['blue', 'green', 'orange', 'pink', 'red', 'yellow'] as const;

export class Grid {
  private cards: string[];
  private coinsOnCards: Map<string, number>;
  private cardAttributes: Map<string, PlayCard>;

  constructor(
    cards: string[],
    coinsOnCards: Map<string, number>,
    cardAttributes: Map<string, PlayCard>
  ) {
    this.cards = cards;
    this.coinsOnCards = coinsOnCards;
    this.cardAttributes = cardAttributes;
  }

  // Position helpers
  static getRow(position: number): number {
    return Math.floor(position / 3);
  }

  static getCol(position: number): number {
    return position % 3;
  }

  getCardAt(position: number): string {
    return this.cards[position];
  }

  getAttrs(cardId: string): PlayCard | undefined {
    return this.cardAttributes.get(cardId);
  }

  getRowPositions(position: number): number[] {
    const row = Grid.getRow(position);
    return [row * 3, row * 3 + 1, row * 3 + 2];
  }

  getColPositions(position: number): number[] {
    const col = Grid.getCol(position);
    return [col, col + 3, col + 6];
  }

  getRowCards(position: number): string[] {
    return this.getRowPositions(position).map(p => this.cards[p]);
  }

  getColCards(position: number): string[] {
    return this.getColPositions(position).map(p => this.cards[p]);
  }

  // Shield counting
  countShieldsInCards(cardIds: string[], color: string): number {
    let total = 0;
    for (const cardId of cardIds) {
      const attrs = this.getAttrs(cardId);
      if (attrs) {
        for (const shield of attrs.shields) {
          if (shield.color === color) {
            total += shield.count;
          }
        }
      }
    }
    return total;
  }

  countShieldsOnBoard(color: string): number {
    return this.countShieldsInCards(this.cards, color);
  }

  countShieldsInRow(position: number, color: string): number {
    return this.countShieldsInCards(this.getRowCards(position), color);
  }

  countShieldsInCol(position: number, color: string): number {
    return this.countShieldsInCards(this.getColCards(position), color);
  }

  countShieldsOnCard(position: number, color: string): number {
    return this.countShieldsInCards([this.cards[position]], color);
  }

  // Unique colors
  getUniqueColorsInCards(cardIds: string[]): Set<string> {
    const colors = new Set<string>();
    for (const cardId of cardIds) {
      const attrs = this.getAttrs(cardId);
      if (attrs) {
        for (const shield of attrs.shields) {
          colors.add(shield.color);
        }
      }
    }
    return colors;
  }

  getUniqueColorsInRow(position: number): Set<string> {
    return this.getUniqueColorsInCards(this.getRowCards(position));
  }

  getUniqueColorsInCol(position: number): Set<string> {
    return this.getUniqueColorsInCards(this.getColCards(position));
  }

  getUniqueColorsOnBoard(): Set<string> {
    return this.getUniqueColorsInCards(this.cards);
  }

  // Position checks
  isTopRow(position: number): boolean {
    return Grid.getRow(position) === 0;
  }

  isMiddleRow(position: number): boolean {
    return Grid.getRow(position) === 1;
  }

  isBottomRow(position: number): boolean {
    return Grid.getRow(position) === 2;
  }

  isLeftCol(position: number): boolean {
    return Grid.getCol(position) === 0;
  }

  isMiddleCol(position: number): boolean {
    return Grid.getCol(position) === 1;
  }

  isRightCol(position: number): boolean {
    return Grid.getCol(position) === 2;
  }

  isCorner(position: number): boolean {
    return [0, 2, 6, 8].includes(position);
  }

  isBorder(position: number): boolean {
    return [1, 3, 5, 7].includes(position);
  }

  isCenter(position: number): boolean {
    return position === 4;
  }

  // Category counting
  countVillageCards(): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      return attrs?.category === 'village';
    }).length;
  }

  countCastleCards(): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      return attrs?.category === 'castle';
    }).length;
  }

  // Feature counting
  countCardsWithPriceReduction(): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      return attrs?.has_price_reduction;
    }).length;
  }

  countCardsWithLock(): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      return attrs?.has_lock;
    }).length;
  }

  countCardsWithCoinPurse(): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      return attrs?.has_coin_purse;
    }).length;
  }

  countCardsWithShieldCount(shieldCount: number): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      if (!attrs) return false;
      const total = attrs.shields.reduce((sum, s) => sum + s.count, 0);
      return total === shieldCount;
    }).length;
  }

  countCardsWithExactValue(value: number): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      return attrs?.value === value;
    }).length;
  }

  countCardsWithValueOrMore(minValue: number): number {
    return this.cards.filter(cardId => {
      const attrs = this.getAttrs(cardId);
      return attrs && attrs.value >= minValue;
    }).length;
  }

  getUniqueValuesOnBoard(): Set<number> {
    const values = new Set<number>();
    for (const cardId of this.cards) {
      const attrs = this.getAttrs(cardId);
      if (attrs) {
        values.add(attrs.value);
      }
    }
    return values;
  }

  sumValuesInRow(position: number): number {
    return this.getRowCards(position).reduce((sum, cardId) => {
      const attrs = this.getAttrs(cardId);
      return sum + (attrs?.value ?? 0);
    }, 0);
  }

  sumValuesInCol(position: number): number {
    return this.getColCards(position).reduce((sum, cardId) => {
      const attrs = this.getAttrs(cardId);
      return sum + (attrs?.value ?? 0);
    }, 0);
  }

  // Coins
  getCoinsOnCard(cardId: string): number {
    return this.coinsOnCards.get(cardId) ?? 0;
  }

  getTotalCoinsOnCards(): number {
    let total = 0;
    for (const coins of this.coinsOnCards.values()) {
      total += coins;
    }
    return total;
  }

  // Card checks
  hasCardOnBoard(cardId: string): boolean {
    return this.cards.includes(cardId);
  }
}

// =============================================================================
// Rule Factories
// =============================================================================

function makeShieldsInRowRule(color: string, multiplier: number): RuleFunction {
  return (grid: Grid, position: number): number => {
    const count = grid.countShieldsInRow(position, color);
    return count * multiplier;
  };
}

function makeShieldsInColRule(color: string, multiplier: number): RuleFunction {
  return (grid: Grid, position: number): number => {
    const count = grid.countShieldsInCol(position, color);
    return count * multiplier;
  };
}

function makeShieldsInRowAndColRule(color: string, multiplier: number): RuleFunction {
  return (grid: Grid, position: number): number => {
    const rowCount = grid.countShieldsInRow(position, color);
    const colCount = grid.countShieldsInCol(position, color);
    const selfCount = grid.countShieldsOnCard(position, color);
    const count = rowCount + colCount - selfCount; // Avoid counting card twice
    return count * multiplier;
  };
}

function makePositionRule(
  check: 'top_row' | 'middle_row' | 'bottom_row' | 'left_col' | 'middle_col' | 'right_col' | 'corner' | 'border' | 'center',
  score: number
): RuleFunction {
  return (grid: Grid, position: number): number => {
    const checks: Record<string, (pos: number) => boolean> = {
      top_row: (p) => grid.isTopRow(p),
      middle_row: (p) => grid.isMiddleRow(p),
      bottom_row: (p) => grid.isBottomRow(p),
      left_col: (p) => grid.isLeftCol(p),
      middle_col: (p) => grid.isMiddleCol(p),
      right_col: (p) => grid.isRightCol(p),
      corner: (p) => grid.isCorner(p),
      border: (p) => grid.isBorder(p),
      center: (p) => grid.isCenter(p),
    };
    return checks[check](position) ? score : 0;
  };
}

function makePairsRule(color1: string, color2: string, multiplier: number): RuleFunction {
  return (grid: Grid, _position: number): number => {
    const count1 = grid.countShieldsOnBoard(color1);
    const count2 = grid.countShieldsOnBoard(color2);
    const pairs = Math.min(count1, count2);
    return pairs * multiplier;
  };
}

function makeTriosRule(colors: string[], multiplier: number): RuleFunction {
  return (grid: Grid, _position: number): number => {
    const counts = colors.map(c => grid.countShieldsOnBoard(c));
    const trios = Math.min(...counts);
    return trios * multiplier;
  };
}

function makeNoShieldRule(color: string, score: number): RuleFunction {
  return (grid: Grid, _position: number): number => {
    const count = grid.countShieldsOnBoard(color);
    return count === 0 ? score : 0;
  };
}

function makeCoinsOnCardRule(maxCoins: number, multiplier: number): RuleFunction {
  return (grid: Grid, position: number): number => {
    const cardId = grid.getCardAt(position);
    const coins = Math.min(grid.getCoinsOnCard(cardId), maxCoins);
    return coins * multiplier;
  };
}

function makeThresholdRule(
  color: string,
  scope: 'row' | 'col' | 'board',
  threshold: number,
  score: number
): RuleFunction {
  return (grid: Grid, position: number): number => {
    let count: number;
    if (scope === 'row') {
      count = grid.countShieldsInRow(position, color);
    } else if (scope === 'col') {
      count = grid.countShieldsInCol(position, color);
    } else {
      count = grid.countShieldsOnBoard(color);
    }
    return count >= threshold ? score : 0;
  };
}

function makeCategoryCountRule(category: 'village' | 'castle', multiplier: number): RuleFunction {
  return (grid: Grid, _position: number): number => {
    const count = category === 'village' ? grid.countVillageCards() : grid.countCastleCards();
    return count * multiplier;
  };
}

function makeUniqueColorsRule(scope: 'row' | 'col' | 'board', multiplier: number): RuleFunction {
  return (grid: Grid, position: number): number => {
    let colors: Set<string>;
    if (scope === 'row') {
      colors = grid.getUniqueColorsInRow(position);
    } else if (scope === 'col') {
      colors = grid.getUniqueColorsInCol(position);
    } else {
      colors = grid.getUniqueColorsOnBoard();
    }
    return colors.size * multiplier;
  };
}

function makeFeatureCountRule(
  feature: 'price_reduction' | 'lock' | 'coin_purse',
  multiplier: number
): RuleFunction {
  return (grid: Grid, _position: number): number => {
    let count: number;
    if (feature === 'price_reduction') {
      count = grid.countCardsWithPriceReduction();
    } else if (feature === 'lock') {
      count = grid.countCardsWithLock();
    } else {
      count = grid.countCardsWithCoinPurse();
    }
    return count * multiplier;
  };
}

function makeExactValueRule(value: number, multiplier: number): RuleFunction {
  return (grid: Grid, _position: number): number => {
    const count = grid.countCardsWithExactValue(value);
    return count * multiplier;
  };
}

function makeMinValueRule(minValue: number, multiplier: number): RuleFunction {
  return (grid: Grid, _position: number): number => {
    const count = grid.countCardsWithValueOrMore(minValue);
    return count * multiplier;
  };
}

function makeFlippedCardRule(): RuleFunction {
  return (_grid: Grid, _position: number): number => 0;
}

// =============================================================================
// Rule Definitions (92 cards)
// =============================================================================

// Shields on column
const rule_001 = makeShieldsInColRule('blue', 4);
const rule_009 = makeShieldsInColRule('blue', 3);
const rule_033 = makeShieldsInColRule('green', 3);
const rule_037 = makeShieldsInColRule('pink', 3);
const rule_045 = makeShieldsInColRule('red', 3);
const rule_055 = makeShieldsInColRule('yellow', 3);

// Shields on row
const rule_011 = makeShieldsInRowRule('green', 3);
const rule_013 = makeShieldsInRowRule('blue', 4);
const rule_028 = makeShieldsInRowRule('blue', 3);
const rule_043 = makeShieldsInRowRule('red', 3);
const rule_048 = makeShieldsInRowRule('pink', 3);
const rule_060 = makeShieldsInRowRule('orange', 3);
const rule_067 = makeShieldsInRowRule('yellow', 3);
const rule_073 = makeShieldsInRowRule('orange', 3);

// Shields on row AND column
const rule_019 = makeShieldsInRowAndColRule('blue', 2);
const rule_023 = makeShieldsInRowAndColRule('blue', 3);
const rule_042 = makeShieldsInRowAndColRule('green', 3);
const rule_062 = makeShieldsInRowAndColRule('pink', 2);
const rule_065 = makeShieldsInRowAndColRule('red', 3);
const rule_080 = makeShieldsInRowAndColRule('orange', 2);
const rule_092 = makeShieldsInRowAndColRule('yellow', 2);

// Position
const rule_003 = makePositionRule('top_row', 8);
const rule_007 = makePositionRule('bottom_row', 5);
const rule_021 = makePositionRule('left_col', 8);
const rule_030 = makePositionRule('left_col', 6);
const rule_031 = makePositionRule('right_col', 8);
const rule_047 = makePositionRule('top_row', 5);
const rule_049 = makePositionRule('right_col', 5);
const rule_052 = makePositionRule('middle_col', 6);
const rule_063 = makePositionRule('bottom_row', 7);
const rule_071 = makePositionRule('middle_row', 5);

// Pairs of shields
const rule_008 = makePairsRule('pink', 'orange', 4);
const rule_022 = makePairsRule('blue', 'red', 4);
const rule_068 = makePairsRule('green', 'yellow', 4);

// Trios of shields
const rule_018 = makeTriosRule(['blue', 'green', 'orange'], 10);
const rule_054 = makeTriosRule(['pink', 'red', 'yellow'], 7);

// No shield of color
const rule_026 = makeNoShieldRule('yellow', 10);
const rule_044 = makeNoShieldRule('orange', 10);
const rule_064 = makeNoShieldRule('pink', 9);
const rule_072 = makeNoShieldRule('green', 10);
const rule_083 = makeNoShieldRule('red', 10);
const rule_091 = makeNoShieldRule('blue', 9);

// Coins on card
const rule_014 = makeCoinsOnCardRule(3, 2);
const rule_025 = makeCoinsOnCardRule(5, 2);
const rule_036 = makeCoinsOnCardRule(8, 2);
const rule_041 = makeCoinsOnCardRule(4, 2);
const rule_050 = makeCoinsOnCardRule(4, 2);
const rule_051 = makeCoinsOnCardRule(5, 2);
const rule_053 = makeCoinsOnCardRule(9, 2);
const rule_058 = makeCoinsOnCardRule(6, 2);
const rule_059 = makeCoinsOnCardRule(4, 2);
const rule_061 = makeCoinsOnCardRule(7, 2);
const rule_081 = makeCoinsOnCardRule(5, 2);

// Threshold rules
const rule_002 = makeThresholdRule('green', 'col', 1, 5);
const rule_035 = makeThresholdRule('pink', 'row', 1, 5);
const rule_075 = makeThresholdRule('red', 'row', 1, 7);
const rule_088 = makeThresholdRule('blue', 'col', 1, 3);

// Category count
const rule_006 = makeCategoryCountRule('village', 2);
const rule_046 = makeCategoryCountRule('castle', 2);
const rule_074 = makeCategoryCountRule('castle', 2);

// Unique colors
const rule_005 = makeUniqueColorsRule('row', 4);
const rule_012 = makeUniqueColorsRule('row', 2);
const rule_024 = makeUniqueColorsRule('board', 2);
const rule_029 = makeUniqueColorsRule('col', 4);
const rule_076 = makeUniqueColorsRule('col', 2);

// Feature count
const rule_032 = makeFeatureCountRule('price_reduction', 4);
const rule_070 = makeFeatureCountRule('lock', 4);

// Exact value
const rule_040 = makeExactValueRule(4, 3);
const rule_086 = makeExactValueRule(0, 2);

// Min value
const rule_039 = makeMinValueRule(5, 5);

// Flipped cards
const rule_089 = makeFlippedCardRule();
const rule_090 = makeFlippedCardRule();

// =============================================================================
// Complex Rules (not factorizable)
// =============================================================================

// rule_004: 8 points if no card with price reduction
function rule_004(grid: Grid, _position: number): number {
  return grid.countCardsWithPriceReduction() === 0 ? 8 : 0;
}

// rule_010: 3 points for each unique cost on board
function rule_010(grid: Grid, _position: number): number {
  const uniqueValues = grid.getUniqueValuesOnBoard();
  return uniqueValues.size * 3;
}

// rule_015: 2 points for each card with exactly 1 shield
function rule_015(grid: Grid, _position: number): number {
  const count = grid.countCardsWithShieldCount(1);
  return count * 2;
}

// rule_016: 3 points for each castle/village pair
function rule_016(grid: Grid, _position: number): number {
  const castle = grid.countCastleCards();
  const village = grid.countVillageCards();
  const pairs = Math.min(castle, village);
  return pairs * 3;
}

// rule_017: 1 point for each key
function rule_017(_grid: Grid, _position: number, keys: number = 0): number {
  return keys;
}

// rule_020: 1 point for each coin on cards
function rule_020(grid: Grid, _position: number): number {
  return grid.getTotalCoinsOnCards();
}

// rule_027: 6 points for each set of 3 shields of same color
function rule_027(grid: Grid, _position: number): number {
  let totalSets = 0;
  for (const color of COLORS) {
    const count = grid.countShieldsOnBoard(color);
    totalSets += Math.floor(count / 3);
  }
  return totalSets * 6;
}

// rule_034: Sum of all card costs on same row
function rule_034(grid: Grid, position: number): number {
  return grid.sumValuesInRow(position);
}

// rule_038: 6 points for each missing shield color
function rule_038(grid: Grid, _position: number): number {
  const presentColors = grid.getUniqueColorsOnBoard();
  const missingCount = COLORS.filter(c => !presentColors.has(c)).length;
  return missingCount * 6;
}

// rule_056: 12 points if no flipped cards
function rule_056(grid: Grid, _position: number): number {
  const count = (grid.hasCardOnBoard('089') ? 1 : 0) + (grid.hasCardOnBoard('090') ? 1 : 0);
  return count === 0 ? 12 : 0;
}

// rule_057: 2 points for each card with exactly 2 shields
function rule_057(grid: Grid, _position: number): number {
  const count = grid.countCardsWithShieldCount(2);
  return count * 2;
}

// rule_066: 1 point for each key (same as 017)
function rule_066(_grid: Grid, _position: number, keys: number = 0): number {
  return keys;
}

// rule_069: 7 points for each set of 3 village cards
function rule_069(grid: Grid, _position: number): number {
  const villageCount = grid.countVillageCards();
  const sets = Math.floor(villageCount / 3);
  return sets * 7;
}

// rule_077: Sum of all card costs on same column
function rule_077(grid: Grid, position: number): number {
  return grid.sumValuesInCol(position);
}

// rule_078: 1 point for each village card
function rule_078(grid: Grid, _position: number): number {
  return grid.countVillageCards();
}

// rule_079: 10 points if no card with coin purse
function rule_079(grid: Grid, _position: number): number {
  return grid.countCardsWithCoinPurse() === 0 ? 10 : 0;
}

// rule_082: 8 points if at least one flipped card
function rule_082(grid: Grid, _position: number): number {
  const count = (grid.hasCardOnBoard('089') ? 1 : 0) + (grid.hasCardOnBoard('090') ? 1 : 0);
  return count > 0 ? 8 : 0;
}

// rule_084: 1 point for each castle card
function rule_084(grid: Grid, _position: number): number {
  return grid.countCastleCards();
}

// rule_085: 3 points if on border (not corner, not center)
function rule_085(grid: Grid, position: number): number {
  return grid.isBorder(position) ? 3 : 0;
}

// rule_087: 4 points if on corner
function rule_087(grid: Grid, position: number): number {
  return grid.isCorner(position) ? 4 : 0;
}

// =============================================================================
// Rules Mapping
// =============================================================================

const RULES: Record<string, RuleFunction> = {
  '001': rule_001,
  '002': rule_002,
  '003': rule_003,
  '004': rule_004,
  '005': rule_005,
  '006': rule_006,
  '007': rule_007,
  '008': rule_008,
  '009': rule_009,
  '010': rule_010,
  '011': rule_011,
  '012': rule_012,
  '013': rule_013,
  '014': rule_014,
  '015': rule_015,
  '016': rule_016,
  '017': rule_017,
  '018': rule_018,
  '019': rule_019,
  '020': rule_020,
  '021': rule_021,
  '022': rule_022,
  '023': rule_023,
  '024': rule_024,
  '025': rule_025,
  '026': rule_026,
  '027': rule_027,
  '028': rule_028,
  '029': rule_029,
  '030': rule_030,
  '031': rule_031,
  '032': rule_032,
  '033': rule_033,
  '034': rule_034,
  '035': rule_035,
  '036': rule_036,
  '037': rule_037,
  '038': rule_038,
  '039': rule_039,
  '040': rule_040,
  '041': rule_041,
  '042': rule_042,
  '043': rule_043,
  '044': rule_044,
  '045': rule_045,
  '046': rule_046,
  '047': rule_047,
  '048': rule_048,
  '049': rule_049,
  '050': rule_050,
  '051': rule_051,
  '052': rule_052,
  '053': rule_053,
  '054': rule_054,
  '055': rule_055,
  '056': rule_056,
  '057': rule_057,
  '058': rule_058,
  '059': rule_059,
  '060': rule_060,
  '061': rule_061,
  '062': rule_062,
  '063': rule_063,
  '064': rule_064,
  '065': rule_065,
  '066': rule_066,
  '067': rule_067,
  '068': rule_068,
  '069': rule_069,
  '070': rule_070,
  '071': rule_071,
  '072': rule_072,
  '073': rule_073,
  '074': rule_074,
  '075': rule_075,
  '076': rule_076,
  '077': rule_077,
  '078': rule_078,
  '079': rule_079,
  '080': rule_080,
  '081': rule_081,
  '082': rule_082,
  '083': rule_083,
  '084': rule_084,
  '085': rule_085,
  '086': rule_086,
  '087': rule_087,
  '088': rule_088,
  '089': rule_089,
  '090': rule_090,
  '091': rule_091,
  '092': rule_092,
};

// Cards that need keys parameter
const KEYS_RULES = new Set(['017', '066']);

// Export for use by deltaCalculator
export { RULES, KEYS_RULES };

// =============================================================================
// Card Contribution Estimator
// =============================================================================

/**
 * Estime la contribution d'une carte à une position donnée.
 *
 * Stratégie simplifiée :
 * 1. Score réel de la règle sur le plateau actuel
 * 2. Bonus basé sur le coût de la carte (les cartes chères rapportent plus)
 * 3. Bonus pour synergies de couleur existantes
 */
export function estimateCardContribution(
  cardId: string,
  position: number,
  currentBoard: string[],
  keys: number,
  coinsOnCards: Map<string, number>,
  cardAttributes: Map<string, PlayCard>
): number {
  // Cartes retournées = 0 points directs
  if (cardId === '089' || cardId === '090') {
    return 0;
  }

  // Créer le plateau avec la carte placée
  const newBoard = [...currentBoard];
  newBoard[position] = cardId;

  // Créer la grille pour évaluer
  const grid = new Grid(newBoard, coinsOnCards, cardAttributes);

  // Obtenir la règle et les attributs
  const rule = RULES[cardId];
  const attrs = cardAttributes.get(cardId);

  // 1. Score de base : appliquer la règle au contexte actuel
  // Le score de la règle reflète déjà la qualité de la carte
  let score = rule ? rule(grid, position, keys) : 0;

  // Bonus pour synergies de couleur avec le plateau existant
  if (attrs && attrs.shields.length > 0) {
    const row = Math.floor(position / 3);
    const col = position % 3;
    const rowPositions = [row * 3, row * 3 + 1, row * 3 + 2].filter(p => p !== position);
    const colPositions = [col, col + 3, col + 6].filter(p => p !== position);

    // Compter les couleurs présentes dans la ligne/colonne
    const existingColors = new Set<string>();
    for (const p of [...rowPositions, ...colPositions]) {
      const existingCard = currentBoard[p];
      if (existingCard) {
        const existingAttrs = cardAttributes.get(existingCard);
        if (existingAttrs) {
          for (const s of existingAttrs.shields) {
            existingColors.add(s.color);
          }
        }
      }
    }

    // Bonus si la carte partage des couleurs avec les voisins
    for (const shield of attrs.shields) {
      if (existingColors.has(shield.color)) {
        score += shield.count * 2; // Bonus pour chaque bouclier de couleur commune
      }
    }
  }

  // Ajouter la valeur des pièces sur cette carte
  const coinsOnThisCard = coinsOnCards.get(cardId) ?? 0;
  score += coinsOnThisCard;

  return score;
}

/**
 * Compare le score de contribution d'une carte entre différentes positions.
 * Retourne les positions triées par contribution décroissante.
 */
export function rankPositionsByContribution(
  cardId: string,
  validPositions: number[],
  currentBoard: string[],
  keys: number,
  coinsOnCards: Map<string, number>,
  cardAttributes: Map<string, PlayCard>
): Array<{ position: number; contribution: number }> {
  const results = validPositions.map(position => ({
    position,
    contribution: estimateCardContribution(
      cardId,
      position,
      currentBoard,
      keys,
      coinsOnCards,
      cardAttributes
    ),
  }));

  // Trier par contribution décroissante
  results.sort((a, b) => b.contribution - a.contribution);
  return results;
}

// =============================================================================
// Main Calculator Function
// =============================================================================

export interface ScoreResult {
  totalScore: number;
  cardsScore: number;
  keysBonus: number;
}

/**
 * Calculate score for a complete 3x3 board
 */
export function calculateScore(
  cards: string[],
  keys: number,
  coinsOnCards: Map<string, number>,
  cardAttributes: Map<string, PlayCard>
): ScoreResult {
  if (cards.length !== 9) {
    // Board not complete, return estimate
    return estimatePartialScore(cards, keys, coinsOnCards, cardAttributes);
  }

  const grid = new Grid(cards, coinsOnCards, cardAttributes);
  let cardsScore = 0;

  for (let position = 0; position < 9; position++) {
    const cardId = cards[position];
    const rule = RULES[cardId];

    if (rule) {
      if (KEYS_RULES.has(cardId)) {
        cardsScore += rule(grid, position, keys);
      } else {
        cardsScore += rule(grid, position);
      }
    }
  }

  // Keys bonus: 1 point per key (already counted in rule_017 and rule_066, but also as separate bonus)
  const keysBonus = keys;
  const totalScore = cardsScore + keysBonus;

  return { totalScore, cardsScore, keysBonus };
}

/**
 * Estimate score for a partial board (used during game)
 *
 * Pour les plateaux partiels, on utilise une estimation conservatrice
 * car il est difficile de prédire les synergies futures.
 */
export function estimatePartialScore(
  cards: string[],
  keys: number,
  coinsOnCards: Map<string, number>,
  cardAttributes: Map<string, PlayCard>
): ScoreResult {
  const placedCards = cards.filter(c => c !== null && c !== undefined && c !== '');
  const placedCount = placedCards.length;

  if (placedCount === 0) {
    return { totalScore: 0, cardsScore: 0, keysBonus: keys };
  }

  let cardsScore = 0;

  // 1. Score de base : valeur des cartes (proxy pour la qualité)
  for (const cardId of placedCards) {
    const attrs = cardAttributes.get(cardId);
    if (attrs) {
      cardsScore += attrs.value * 1.5;
    }
  }

  // 2. Pièces sur les bourses
  for (const coins of coinsOnCards.values()) {
    cardsScore += coins;
  }

  // 3. Analyser les boucliers
  const shieldCounts: Record<string, number> = {};
  const uniqueColors = new Set<string>();

  for (const cardId of placedCards) {
    const attrs = cardAttributes.get(cardId);
    if (attrs) {
      for (const shield of attrs.shields) {
        uniqueColors.add(shield.color);
        shieldCounts[shield.color] = (shieldCounts[shield.color] ?? 0) + shield.count;
      }
    }
  }

  // 4. Bonus diversité couleurs (rule_024: 2 pts/couleur)
  cardsScore += uniqueColors.size * 2;
  if (uniqueColors.size >= 6) cardsScore += 8;

  // 5. Bonus concentration boucliers (synergies potentielles)
  for (const count of Object.values(shieldCounts)) {
    if (count >= 2) cardsScore += (count - 1) * 2;
    if (count >= 3) cardsScore += Math.floor(count / 3) * 4;
  }

  // 6. Catégories
  let castleCount = 0;
  let villageCount = 0;
  let reductionCount = 0;
  let flippedCount = 0;

  for (const cardId of placedCards) {
    if (cardId === '089' || cardId === '090') {
      flippedCount++;
      continue;
    }
    const attrs = cardAttributes.get(cardId);
    if (attrs) {
      if (attrs.category === 'castle') castleCount++;
      if (attrs.category === 'village') villageCount++;
      if (attrs.has_price_reduction) reductionCount++;
    }
  }

  // Paires château/village
  cardsScore += Math.min(castleCount, villageCount) * 3;

  // Réductions (valeur diminue avec le temps)
  const remainingTurns = Math.max(0, 9 - placedCount);
  cardsScore += reductionCount * remainingTurns * 0.5;

  // 7. Cartes retournées
  if (flippedCount === 0 && placedCount >= 3) {
    cardsScore += 6;
  }

  // 8. Clés
  const keysBonus = keys;
  cardsScore += keys; // Valeur des clés en jeu

  return {
    totalScore: Math.round(cardsScore) + keysBonus,
    cardsScore: Math.round(cardsScore),
    keysBonus,
  };
}

/**
 * Calculate score for a PlayPlayer (convenience function)
 */
export function calculatePlayerScore(
  player: PlayPlayer,
  cardAttributes: Map<string, PlayCard>
): number {
  const cards: string[] = [];
  const coinsOnCards = new Map<string, number>();

  for (let i = 0; i < 9; i++) {
    const placed = player.board[i];
    if (placed) {
      cards.push(placed.cardId);
      if (placed.coinsOnCard > 0) {
        coinsOnCards.set(placed.cardId, placed.coinsOnCard);
      }
    } else {
      cards.push('');
    }
  }

  const placedCount = cards.filter(c => c !== '').length;

  if (placedCount === 9) {
    // Complete board - use full calculation
    const result = calculateScore(cards, player.keys, coinsOnCards, cardAttributes);
    return result.totalScore;
  } else {
    // Partial board - use estimate
    const result = estimatePartialScore(cards, player.keys, coinsOnCards, cardAttributes);
    return result.totalScore;
  }
}
