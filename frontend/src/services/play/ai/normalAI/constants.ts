/**
 * Constantes pour l'IA Normale
 *
 * Ce fichier contient :
 * - La repartition des boucliers par lieu (chateau/village)
 * - Les conflits entre cartes (incompatibilites)
 * - Les definitions de strategies par carte
 */

import type { ShieldColor, Location } from '../../../../types/play';

// =============================================================================
// Repartition des boucliers par lieu
// =============================================================================

/**
 * Nombre de boucliers par couleur et par lieu
 * Calcule depuis card_attributes.json
 */
export const SHIELD_DISTRIBUTION: Record<Location, Record<ShieldColor, number>> = {
  castle: {
    blue: 13,
    pink: 12,
    green: 11,
    red: 8,
    orange: 7,
    yellow: 0,
  },
  village: {
    blue: 1,
    pink: 5,
    green: 6,
    red: 9,
    orange: 11,
    yellow: 20,
  },
};

/**
 * Lieu recommande pour trouver une couleur de bouclier
 */
export function getBestLocationForShield(color: ShieldColor): Location {
  const castle = SHIELD_DISTRIBUTION.castle[color];
  const village = SHIELD_DISTRIBUTION.village[color];
  return castle >= village ? 'castle' : 'village';
}

/**
 * Ratio de disponibilite d'une couleur dans un lieu (0-1)
 */
export function getShieldAvailability(color: ShieldColor, location: Location): number {
  const inLocation = SHIELD_DISTRIBUTION[location][color];
  const total = SHIELD_DISTRIBUTION.castle[color] + SHIELD_DISTRIBUTION.village[color];
  return total > 0 ? inLocation / total : 0;
}

// =============================================================================
// Conflits entre cartes
// =============================================================================

/**
 * Cartes mutuellement exclusives (ne jamais prendre les deux)
 * [cardA, cardB, raison]
 */
export const CARD_CONFLICTS: [string, string, string][] = [
  // Cartes retournees
  ['056', '039', '056 veut 0 retournee, 039 encourage cartes cheres donc risque retournee'],
  ['056', '082', '056 veut 0 retournee, 082 veut 1+ retournee'],

  // Reductions
  ['004', '032', '004 veut 0 reduction, 032 compte les reductions'],

  // Bourses
  ['079', '070', '079 veut 0 bourse, 070 compte les cadenas (souvent avec bourses)'],

  // Boucliers exclusifs - cartes "pas de X couleur"
  ['026', '091', '026 veut pas de jaune, 091 veut pas de bleu - contradictoire'],
];

/**
 * Cartes qui annulent une autre carte si presentes ensemble
 * La cle est la carte "victime", la valeur est la liste des cartes qui l'annulent
 */
export const CARD_NEUTRALIZERS: Record<string, string[]> = {
  // Cartes "pas de X couleur" neutralisees par cartes avec cette couleur
  // On ne liste pas toutes les cartes, juste le principe - l'evaluation dynamique gere ca
};

/**
 * Verifie si deux cartes sont en conflit
 */
export function areCardsInConflict(cardA: string, cardB: string): boolean {
  return CARD_CONFLICTS.some(
    ([a, b]) => (a === cardA && b === cardB) || (a === cardB && b === cardA)
  );
}

// =============================================================================
// Types de strategies
// =============================================================================

export type StrategyType =
  // Boucliers sur ligne/colonne
  | 'shield_color_line'      // X pts par bouclier [couleur] sur ligne
  | 'shield_color_col'       // X pts par bouclier [couleur] sur colonne
  | 'shield_color_both'      // X pts par bouclier [couleur] sur ligne ET colonne

  // Boucliers diversifies
  | 'shield_diversity_line'  // X pts par couleur differente sur ligne
  | 'shield_diversity_col'   // X pts par couleur differente sur colonne
  | 'shield_diversity_board' // X pts par couleur differente sur plateau

  // Paires et trios de boucliers
  | 'shield_pairs'           // X pts par paire de 2 couleurs
  | 'shield_trios'           // X pts par trio de 3 couleurs
  | 'shield_sets_of_3'       // X pts par lot de 3 boucliers meme couleur

  // Absence de bouclier
  | 'no_shield_color'        // X pts si aucun bouclier [couleur]
  | 'missing_colors'         // X pts par couleur absente

  // Categories
  | 'category_count'         // X pts par carte [categorie]
  | 'category_pairs'         // X pts par paire chateau/village
  | 'category_sets'          // X pts par lot de 3 [categorie]

  // Position
  | 'position_row'           // X pts si sur ligne [haut/milieu/bas]
  | 'position_col'           // X pts si sur colonne [gauche/milieu/droite]
  | 'position_corner'        // X pts si dans un coin
  | 'position_border'        // X pts si sur un bord

  // Caracteristiques
  | 'feature_count'          // X pts par [reduction/cadenas/bourse]
  | 'no_feature'             // X pts si aucune [reduction/bourse]

  // Cout des cartes
  | 'cost_diversity'         // X pts par cout different
  | 'cost_exact'             // X pts par carte de cout X
  | 'cost_min'               // X pts par carte de cout >= X
  | 'cost_sum_line'          // Somme des couts sur ligne

  // Boucliers par carte
  | 'shield_count_exact'     // X pts par carte avec exactement N boucliers

  // Seuil de boucliers
  | 'shield_threshold'       // X pts si >= 1 bouclier [couleur] sur ligne/col

  // Cles
  | 'keys_count'             // X pts par cle

  // Bourses
  | 'coins_on_card'          // X pts par piece sur la carte

  // Cartes retournees
  | 'no_flipped'             // X pts si aucune carte retournee
  | 'has_flipped';           // X pts si au moins une carte retournee

// =============================================================================
// Definition des strategies par carte
// =============================================================================

export interface StrategyDefinition {
  type: StrategyType;
  potential: number;         // Points max theoriques
  scope: 'full' | 'partial'; // full = tout le plateau, partial = ligne/col
  params: Record<string, unknown>;
}

/**
 * Strategies associees a chaque carte de scoring
 * Les cartes sans strategie specifique (bourses, effets simples) ne sont pas listees
 */
export const CARD_STRATEGIES: Record<string, StrategyDefinition> = {
  // ---------------------------------------------------------------------------
  // Boucliers sur colonne (scope: partial)
  // ---------------------------------------------------------------------------
  '001': { type: 'shield_color_col', potential: 12, scope: 'partial', params: { color: 'blue', points: 4 } },
  '009': { type: 'shield_color_col', potential: 9, scope: 'partial', params: { color: 'blue', points: 3 } },
  '033': { type: 'shield_color_col', potential: 9, scope: 'partial', params: { color: 'green', points: 3 } },
  '037': { type: 'shield_color_col', potential: 9, scope: 'partial', params: { color: 'pink', points: 3 } },
  '045': { type: 'shield_color_col', potential: 9, scope: 'partial', params: { color: 'red', points: 3 } },
  '055': { type: 'shield_color_col', potential: 9, scope: 'partial', params: { color: 'yellow', points: 3 } },

  // ---------------------------------------------------------------------------
  // Boucliers sur rangee (scope: partial)
  // ---------------------------------------------------------------------------
  '011': { type: 'shield_color_line', potential: 9, scope: 'partial', params: { color: 'green', points: 3 } },
  '013': { type: 'shield_color_line', potential: 12, scope: 'partial', params: { color: 'blue', points: 4 } },
  '028': { type: 'shield_color_line', potential: 9, scope: 'partial', params: { color: 'blue', points: 3 } },
  '043': { type: 'shield_color_line', potential: 9, scope: 'partial', params: { color: 'red', points: 3 } },
  '048': { type: 'shield_color_line', potential: 9, scope: 'partial', params: { color: 'pink', points: 3 } },
  '060': { type: 'shield_color_line', potential: 9, scope: 'partial', params: { color: 'orange', points: 3 } },
  '067': { type: 'shield_color_line', potential: 9, scope: 'partial', params: { color: 'yellow', points: 3 } },
  '073': { type: 'shield_color_line', potential: 9, scope: 'partial', params: { color: 'orange', points: 3 } },

  // ---------------------------------------------------------------------------
  // Boucliers sur rangee ET colonne (scope: partial mais plus flexible)
  // ---------------------------------------------------------------------------
  '019': { type: 'shield_color_both', potential: 12, scope: 'partial', params: { color: 'blue', points: 2 } },
  '023': { type: 'shield_color_both', potential: 18, scope: 'partial', params: { color: 'blue', points: 3 } },
  '042': { type: 'shield_color_both', potential: 18, scope: 'partial', params: { color: 'green', points: 3 } },
  '062': { type: 'shield_color_both', potential: 12, scope: 'partial', params: { color: 'pink', points: 2 } },
  '065': { type: 'shield_color_both', potential: 18, scope: 'partial', params: { color: 'red', points: 3 } },
  '080': { type: 'shield_color_both', potential: 12, scope: 'partial', params: { color: 'orange', points: 2 } },
  '092': { type: 'shield_color_both', potential: 12, scope: 'partial', params: { color: 'yellow', points: 2 } },

  // ---------------------------------------------------------------------------
  // Position (scope: partial)
  // ---------------------------------------------------------------------------
  '003': { type: 'position_row', potential: 8, scope: 'partial', params: { row: 'top', points: 8 } },
  '007': { type: 'position_row', potential: 5, scope: 'partial', params: { row: 'bottom', points: 5 } },
  '021': { type: 'position_col', potential: 8, scope: 'partial', params: { col: 'left', points: 8 } },
  '030': { type: 'position_col', potential: 6, scope: 'partial', params: { col: 'left', points: 6 } },
  '031': { type: 'position_col', potential: 8, scope: 'partial', params: { col: 'right', points: 8 } },
  '047': { type: 'position_row', potential: 5, scope: 'partial', params: { row: 'top', points: 5 } },
  '049': { type: 'position_col', potential: 5, scope: 'partial', params: { col: 'right', points: 5 } },
  '052': { type: 'position_col', potential: 6, scope: 'partial', params: { col: 'middle', points: 6 } },
  '063': { type: 'position_row', potential: 7, scope: 'partial', params: { row: 'bottom', points: 7 } },
  '071': { type: 'position_row', potential: 5, scope: 'partial', params: { row: 'middle', points: 5 } },
  '085': { type: 'position_border', potential: 3, scope: 'partial', params: { points: 3 } },
  '087': { type: 'position_corner', potential: 4, scope: 'partial', params: { points: 4 } },

  // ---------------------------------------------------------------------------
  // Paires de boucliers (scope: full)
  // ---------------------------------------------------------------------------
  '008': { type: 'shield_pairs', potential: 16, scope: 'full', params: { colors: ['pink', 'orange'], points: 4 } },
  '022': { type: 'shield_pairs', potential: 16, scope: 'full', params: { colors: ['blue', 'red'], points: 4 } },
  '068': { type: 'shield_pairs', potential: 16, scope: 'full', params: { colors: ['green', 'yellow'], points: 4 } },

  // ---------------------------------------------------------------------------
  // Trios de boucliers (scope: full) - TRES FORT
  // ---------------------------------------------------------------------------
  '018': { type: 'shield_trios', potential: 30, scope: 'full', params: { colors: ['blue', 'green', 'orange'], points: 10 } },
  '054': { type: 'shield_trios', potential: 21, scope: 'full', params: { colors: ['pink', 'red', 'yellow'], points: 7 } },

  // ---------------------------------------------------------------------------
  // Lots de 3 boucliers meme couleur (scope: full) - TRES FORT
  // ---------------------------------------------------------------------------
  '027': { type: 'shield_sets_of_3', potential: 24, scope: 'full', params: { points: 6 } },

  // ---------------------------------------------------------------------------
  // Pas de bouclier d'une couleur (scope: full)
  // ---------------------------------------------------------------------------
  '026': { type: 'no_shield_color', potential: 10, scope: 'full', params: { color: 'yellow', points: 10 } },
  '044': { type: 'no_shield_color', potential: 10, scope: 'full', params: { color: 'orange', points: 10 } },
  '064': { type: 'no_shield_color', potential: 9, scope: 'full', params: { color: 'pink', points: 9 } },
  '072': { type: 'no_shield_color', potential: 10, scope: 'full', params: { color: 'green', points: 10 } },
  '083': { type: 'no_shield_color', potential: 10, scope: 'full', params: { color: 'red', points: 10 } },
  '091': { type: 'no_shield_color', potential: 9, scope: 'full', params: { color: 'blue', points: 9 } },

  // ---------------------------------------------------------------------------
  // Couleurs absentes (scope: full)
  // ---------------------------------------------------------------------------
  '038': { type: 'missing_colors', potential: 36, scope: 'full', params: { points: 6 } },

  // ---------------------------------------------------------------------------
  // Diversite de couleurs (scope: partial ou full)
  // ---------------------------------------------------------------------------
  '005': { type: 'shield_diversity_line', potential: 12, scope: 'partial', params: { points: 4 } },
  '012': { type: 'shield_diversity_line', potential: 6, scope: 'partial', params: { points: 2 } },
  '024': { type: 'shield_diversity_board', potential: 12, scope: 'full', params: { points: 2 } },
  '029': { type: 'shield_diversity_col', potential: 12, scope: 'partial', params: { points: 4 } },
  '076': { type: 'shield_diversity_col', potential: 6, scope: 'partial', params: { points: 2 } },

  // ---------------------------------------------------------------------------
  // Categories (scope: full)
  // ---------------------------------------------------------------------------
  '006': { type: 'category_count', potential: 18, scope: 'full', params: { category: 'village', points: 2 } },
  '046': { type: 'category_count', potential: 18, scope: 'full', params: { category: 'castle', points: 2 } },
  '074': { type: 'category_count', potential: 18, scope: 'full', params: { category: 'castle', points: 2 } },
  '078': { type: 'category_count', potential: 9, scope: 'full', params: { category: 'village', points: 1 } },
  '084': { type: 'category_count', potential: 9, scope: 'full', params: { category: 'castle', points: 1 } },
  '016': { type: 'category_pairs', potential: 12, scope: 'full', params: { points: 3 } },
  '069': { type: 'category_sets', potential: 21, scope: 'full', params: { category: 'village', points: 7 } },

  // ---------------------------------------------------------------------------
  // Caracteristiques (scope: full)
  // ---------------------------------------------------------------------------
  '004': { type: 'no_feature', potential: 8, scope: 'full', params: { feature: 'price_reduction', points: 8 } },
  '032': { type: 'feature_count', potential: 16, scope: 'full', params: { feature: 'price_reduction', points: 4 } },
  '070': { type: 'feature_count', potential: 16, scope: 'full', params: { feature: 'lock', points: 4 } },
  '079': { type: 'no_feature', potential: 10, scope: 'full', params: { feature: 'coin_purse', points: 10 } },

  // ---------------------------------------------------------------------------
  // Cout des cartes (scope: full ou partial)
  // ---------------------------------------------------------------------------
  '010': { type: 'cost_diversity', potential: 27, scope: 'full', params: { points: 3 } },
  '040': { type: 'cost_exact', potential: 9, scope: 'full', params: { cost: 4, points: 3 } },
  '086': { type: 'cost_exact', potential: 6, scope: 'full', params: { cost: 0, points: 2 } },
  '039': { type: 'cost_min', potential: 15, scope: 'full', params: { minCost: 5, points: 5 } },
  '034': { type: 'cost_sum_line', potential: 24, scope: 'partial', params: {} },
  '077': { type: 'cost_sum_line', potential: 24, scope: 'partial', params: {} },

  // ---------------------------------------------------------------------------
  // Boucliers par carte (scope: full)
  // ---------------------------------------------------------------------------
  '015': { type: 'shield_count_exact', potential: 18, scope: 'full', params: { count: 1, points: 2 } },
  '057': { type: 'shield_count_exact', potential: 18, scope: 'full', params: { count: 2, points: 2 } },

  // ---------------------------------------------------------------------------
  // Seuil de boucliers (scope: partial)
  // ---------------------------------------------------------------------------
  '002': { type: 'shield_threshold', potential: 5, scope: 'partial', params: { color: 'green', zone: 'col', min: 1, points: 5 } },
  '035': { type: 'shield_threshold', potential: 5, scope: 'partial', params: { color: 'pink', zone: 'row', min: 1, points: 5 } },
  '075': { type: 'shield_threshold', potential: 7, scope: 'partial', params: { color: 'red', zone: 'row', min: 1, points: 7 } },
  '088': { type: 'shield_threshold', potential: 3, scope: 'partial', params: { color: 'blue', zone: 'col', min: 1, points: 3 } },

  // ---------------------------------------------------------------------------
  // Cles (scope: full)
  // ---------------------------------------------------------------------------
  '017': { type: 'keys_count', potential: 6, scope: 'full', params: { points: 1 } },
  '066': { type: 'keys_count', potential: 6, scope: 'full', params: { points: 1 } },

  // ---------------------------------------------------------------------------
  // Pieces sur carte (bourses - pas vraiment strategique)
  // ---------------------------------------------------------------------------
  '020': { type: 'coins_on_card', potential: 20, scope: 'full', params: { points: 1 } },

  // ---------------------------------------------------------------------------
  // Cartes retournees (scope: full)
  // ---------------------------------------------------------------------------
  '056': { type: 'no_flipped', potential: 12, scope: 'full', params: { points: 12 } },
  '082': { type: 'has_flipped', potential: 8, scope: 'full', params: { points: 8 } },
};

// =============================================================================
// Classification des strategies par force
// =============================================================================

/**
 * Strategies classees par potentiel de points
 */
export const STRATEGY_TIERS = {
  // Tres fort (20+ pts potentiels)
  strong: ['018', '054', '027', '010', '020', '069', '038'],

  // Fort (12-19 pts)
  medium: [
    '001', '013', '023', '008', '022', '068', '042', '065',
    '006', '046', '074', '032', '070', '016', '039', '056',
    '005', '029', '024', '015', '057',
  ],

  // Moyen (8-11 pts)
  weak: [
    '009', '033', '037', '045', '055', '011', '028', '043',
    '048', '060', '067', '073', '019', '062', '080', '092',
    '003', '021', '031', '026', '044', '064', '072', '083',
    '091', '004', '079', '082', '040',
  ],

  // Faible (< 8 pts) - cartes de positionnement simple
  minimal: [
    '007', '030', '047', '049', '052', '063', '071', '085',
    '087', '012', '076', '002', '035', '075', '088', '017',
    '066', '086', '078', '084',
  ],
};

/**
 * Retourne le tier d'une strategie
 */
export function getStrategyTier(cardId: string): 'strong' | 'medium' | 'weak' | 'minimal' | null {
  if (STRATEGY_TIERS.strong.includes(cardId)) return 'strong';
  if (STRATEGY_TIERS.medium.includes(cardId)) return 'medium';
  if (STRATEGY_TIERS.weak.includes(cardId)) return 'weak';
  if (STRATEGY_TIERS.minimal.includes(cardId)) return 'minimal';
  return null;
}

// =============================================================================
// Cartes qui demandent beaucoup/peu de boucliers
// =============================================================================

/**
 * Cartes qui beneficient de BEAUCOUP de boucliers (diversite ou quantite)
 */
export const CARDS_WANT_MANY_SHIELDS = new Set([
  '018', '054', '027', // Trios, lots de 3
  '005', '012', '024', '029', '076', // Diversite
  '008', '022', '068', // Paires
  '015', '057', // Cartes avec N boucliers
]);

/**
 * Cartes qui beneficient de PEU ou AUCUN bouclier d'une couleur
 */
export const CARDS_WANT_FEW_SHIELDS = new Set([
  '026', '044', '064', '072', '083', '091', // Pas de couleur X
  '038', // Couleurs manquantes
]);

/**
 * Verifie la compatibilite entre deux strategies de boucliers
 */
export function areShieldStrategiesCompatible(cardA: string, cardB: string): boolean {
  const aWantsMany = CARDS_WANT_MANY_SHIELDS.has(cardA);
  const aWantsFew = CARDS_WANT_FEW_SHIELDS.has(cardA);
  const bWantsMany = CARDS_WANT_MANY_SHIELDS.has(cardB);
  const bWantsFew = CARDS_WANT_FEW_SHIELDS.has(cardB);

  // Conflit si l'une veut beaucoup et l'autre peu
  if ((aWantsMany && bWantsFew) || (aWantsFew && bWantsMany)) {
    return false;
  }

  return true;
}
