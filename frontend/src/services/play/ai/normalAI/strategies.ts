/**
 * Systeme de strategies pour l'IA Normale
 *
 * L'IA Normale evalue son plateau et maintient une liste de strategies actives.
 * Chaque carte de scoring definit une strategie. L'IA essaie de jouer de maniere
 * coherente avec ses strategies dominantes.
 */

import type { PlayPlayer, ShieldColor } from '../../../../types/play';
import { getCard } from '../../gameEngine';
import type { StrategyDefinition } from './constants';
import {
  CARD_STRATEGIES,
  getStrategyTier,
  areCardsInConflict,
  areShieldStrategiesCompatible,
} from './constants';

// =============================================================================
// Types
// =============================================================================

export interface ActiveStrategy {
  cardId: string;                    // Carte qui definit la strategie
  definition: StrategyDefinition;    // Definition de la strategie
  tier: 'strong' | 'medium' | 'weak' | 'minimal';
  weight: number;                    // Poids calcule (potentiel * coefficient scope)
  isInvalidated: boolean;            // Strategie devenue impossible
  invalidationReason?: string;
}

export interface StrategyAnalysis {
  strategies: ActiveStrategy[];      // Strategies actives triees par poids
  dominantStrategy: ActiveStrategy | null;  // Strategie principale
  conflictingCards: string[];        // Cartes en conflit avec les strategies
  recommendedColors: ShieldColor[];  // Couleurs a privilegier
  avoidedColors: ShieldColor[];      // Couleurs a eviter
}

// =============================================================================
// Extraction des strategies du plateau
// =============================================================================

/**
 * Analyse le plateau du joueur et extrait les strategies actives
 */
export function analyzePlayerStrategies(player: PlayPlayer): StrategyAnalysis {
  const strategies: ActiveStrategy[] = [];
  const conflictingCards: string[] = [];

  // Parcourir toutes les cartes placees
  for (const placed of player.board) {
    if (!placed) continue;

    const cardId = placed.cardId;
    const definition = CARD_STRATEGIES[cardId];

    if (definition) {
      const tier = getStrategyTier(cardId);
      if (tier) {
        // Calculer le poids (potentiel * coefficient scope)
        const scopeCoeff = definition.scope === 'full' ? 1.0 : 0.7;
        const weight = definition.potential * scopeCoeff;

        // Verifier si la strategie est invalidee
        const invalidation = checkStrategyInvalidation(cardId, definition, player);

        strategies.push({
          cardId,
          definition,
          tier,
          weight: invalidation.isInvalidated ? weight * 0.1 : weight,
          isInvalidated: invalidation.isInvalidated,
          invalidationReason: invalidation.reason,
        });
      }
    }
  }

  // Trier par poids decroissant
  strategies.sort((a, b) => b.weight - a.weight);

  // Verifier les conflits entre strategies
  for (let i = 0; i < strategies.length; i++) {
    for (let j = i + 1; j < strategies.length; j++) {
      if (areCardsInConflict(strategies[i].cardId, strategies[j].cardId)) {
        // Marquer la strategie la plus faible comme en conflit
        if (strategies[i].weight > strategies[j].weight) {
          conflictingCards.push(strategies[j].cardId);
        } else {
          conflictingCards.push(strategies[i].cardId);
        }
      }
    }
  }

  // Determiner les couleurs recommandees et a eviter
  const { recommended, avoided } = analyzeColorPreferences(strategies, player);

  return {
    strategies,
    dominantStrategy: strategies.length > 0 ? strategies[0] : null,
    conflictingCards,
    recommendedColors: recommended,
    avoidedColors: avoided,
  };
}

/**
 * Verifie si une strategie est devenue impossible
 */
function checkStrategyInvalidation(
  cardId: string,
  definition: StrategyDefinition,
  player: PlayPlayer
): { isInvalidated: boolean; reason?: string } {
  const position = player.board.findIndex(p => p?.cardId === cardId);
  if (position === -1) return { isInvalidated: false };

  const row = Math.floor(position / 3);
  const col = position % 3;

  // Verifier les strategies de ligne/colonne
  if (definition.scope === 'partial') {
    if (definition.type === 'shield_color_line' || definition.type === 'position_row') {
      // Verifier si la ligne est complete
      const rowCards = [row * 3, row * 3 + 1, row * 3 + 2];
      const filledInRow = rowCards.filter(i => player.board[i] !== null).length;
      if (filledInRow === 3) {
        // La strategie n'est pas invalidee, mais son potentiel est fixe
        // On ne peut plus l'ameliorer
      }
    }

    if (definition.type === 'shield_color_col' || definition.type === 'position_col') {
      // Verifier si la colonne est complete
      const colCards = [col, col + 3, col + 6];
      const filledInCol = colCards.filter(i => player.board[i] !== null).length;
      if (filledInCol === 3) {
        // Pareil
      }
    }
  }

  // Verifier les strategies "pas de X couleur"
  if (definition.type === 'no_shield_color') {
    const avoidedColor = definition.params.color as ShieldColor;
    if (playerHasShieldColor(player, avoidedColor)) {
      return {
        isInvalidated: true,
        reason: `Le joueur a deja un bouclier ${avoidedColor}`,
      };
    }
  }

  // Verifier "pas de feature"
  if (definition.type === 'no_feature') {
    const feature = definition.params.feature as string;
    if (playerHasFeature(player, feature)) {
      return {
        isInvalidated: true,
        reason: `Le joueur a deja une carte avec ${feature}`,
      };
    }
  }

  // Verifier "pas de carte retournee"
  if (definition.type === 'no_flipped') {
    if (playerHasFlippedCard(player)) {
      return {
        isInvalidated: true,
        reason: 'Le joueur a deja une carte retournee',
      };
    }
  }

  return { isInvalidated: false };
}

// =============================================================================
// Analyse des preferences de couleurs
// =============================================================================

/**
 * Determine les couleurs a privilegier et a eviter selon les strategies
 */
function analyzeColorPreferences(
  strategies: ActiveStrategy[],
  player: PlayPlayer
): { recommended: ShieldColor[]; avoided: ShieldColor[] } {
  const colorScores: Record<ShieldColor, number> = {
    blue: 0,
    pink: 0,
    green: 0,
    red: 0,
    orange: 0,
    yellow: 0,
  };

  for (const strategy of strategies) {
    if (strategy.isInvalidated) continue;

    const { type, params } = strategy.definition;

    // Strategies qui favorisent une couleur
    if (
      type === 'shield_color_line' ||
      type === 'shield_color_col' ||
      type === 'shield_color_both' ||
      type === 'shield_threshold'
    ) {
      const color = params.color as ShieldColor;
      colorScores[color] += strategy.weight;
    }

    // Strategies qui favorisent des paires/trios
    if (type === 'shield_pairs' || type === 'shield_trios') {
      const colors = params.colors as ShieldColor[];
      for (const color of colors) {
        colorScores[color] += strategy.weight / colors.length;
      }
    }

    // Strategies qui evitent une couleur
    if (type === 'no_shield_color') {
      const color = params.color as ShieldColor;
      colorScores[color] -= strategy.weight * 2; // Fort malus
    }

    // Strategie "couleurs manquantes" - eviter d'ajouter des couleurs
    if (type === 'missing_colors') {
      const existingColors = getPlayerShieldColors(player);
      for (const color of Object.keys(colorScores) as ShieldColor[]) {
        if (!existingColors.has(color)) {
          colorScores[color] -= strategy.weight / 6;
        }
      }
    }
  }

  // Trier les couleurs par score
  const sortedColors = (Object.keys(colorScores) as ShieldColor[]).sort(
    (a, b) => colorScores[b] - colorScores[a]
  );

  // Recommander les couleurs avec score positif
  const recommended = sortedColors.filter(c => colorScores[c] > 0);

  // Eviter les couleurs avec score tres negatif
  const avoided = sortedColors.filter(c => colorScores[c] < -5);

  return { recommended, avoided };
}

// =============================================================================
// Evaluation de la compatibilite d'une carte
// =============================================================================

/**
 * Evalue la compatibilite d'une carte avec les strategies actives
 * Retourne un score entre -100 et +100
 */
export function evaluateCardStrategyFit(
  cardId: string,
  analysis: StrategyAnalysis,
  player: PlayPlayer
): number {
  let score = 0;
  const card = getCard(cardId);
  if (!card) return 0;

  // 1. Verifier les conflits directs avec les cartes existantes
  for (const strategy of analysis.strategies) {
    if (areCardsInConflict(cardId, strategy.cardId)) {
      return -100; // Ne jamais prendre une carte en conflit
    }
  }

  // 2. Verifier la compatibilite des strategies de boucliers
  for (const strategy of analysis.strategies) {
    if (!areShieldStrategiesCompatible(cardId, strategy.cardId)) {
      score -= 30;
    }
  }

  // 3. Verifier si la carte a une strategie qui serait immediatement neutralisee
  const cardStrategy = CARD_STRATEGIES[cardId];
  if (cardStrategy) {
    if (cardStrategy.type === 'no_shield_color') {
      const avoidedColor = cardStrategy.params.color as ShieldColor;
      if (playerHasShieldColor(player, avoidedColor)) {
        return -100; // Ne jamais prendre une carte deja neutralisee
      }
    }

    if (cardStrategy.type === 'no_feature') {
      const feature = cardStrategy.params.feature as string;
      if (playerHasFeature(player, feature)) {
        return -100;
      }
    }

    if (cardStrategy.type === 'no_flipped' && playerHasFlippedCard(player)) {
      return -100;
    }
  }

  // 4. Bonus si la carte renforce une strategie existante
  for (const strategy of analysis.strategies) {
    if (strategy.isInvalidated) continue;

    const bonus = calculateStrategyReinforcement(cardId, card, strategy, player);
    score += bonus;
  }

  // 5. Bonus/Malus pour les couleurs
  for (const shield of card.shields) {
    if (analysis.recommendedColors.includes(shield.color)) {
      score += 10 * shield.count;
    }
    if (analysis.avoidedColors.includes(shield.color)) {
      score -= 20 * shield.count;
    }
  }

  // 6. Verifier si la carte neutraliserait une strategie existante
  if (wouldNeutralizeStrategy(cardId, card, analysis, player)) {
    return -100;
  }

  return Math.max(-100, Math.min(100, score));
}

/**
 * Calcule le bonus de renforcement d'une strategie par une carte
 */
function calculateStrategyReinforcement(
  _cardId: string,
  card: ReturnType<typeof getCard>,
  strategy: ActiveStrategy,
  player: PlayPlayer
): number {
  if (!card) return 0;

  const { type, params } = strategy.definition;
  let bonus = 0;

  // Strategie couleur sur ligne/colonne - la carte a cette couleur ?
  if (
    type === 'shield_color_line' ||
    type === 'shield_color_col' ||
    type === 'shield_color_both' ||
    type === 'shield_threshold'
  ) {
    const targetColor = params.color as ShieldColor;
    for (const shield of card.shields) {
      if (shield.color === targetColor) {
        bonus += shield.count * strategy.weight * 0.3;
      }
    }
  }

  // Strategie paires/trios - la carte a une des couleurs ?
  if (type === 'shield_pairs' || type === 'shield_trios') {
    const targetColors = params.colors as ShieldColor[];
    for (const shield of card.shields) {
      if (targetColors.includes(shield.color)) {
        bonus += shield.count * strategy.weight * 0.2;
      }
    }
  }

  // Strategie categories - la carte est de la bonne categorie ?
  if (type === 'category_count' || type === 'category_sets') {
    const targetCategory = params.category as string;
    if (card.category === targetCategory) {
      bonus += strategy.weight * 0.3;
    }
  }

  // Strategie features - la carte a la feature ?
  if (type === 'feature_count') {
    const targetFeature = params.feature as string;
    if (
      (targetFeature === 'price_reduction' && card.has_price_reduction) ||
      (targetFeature === 'lock' && card.has_lock) ||
      (targetFeature === 'coin_purse' && card.has_coin_purse)
    ) {
      bonus += strategy.weight * 0.4;
    }
  }

  // Strategie diversite de couts
  if (type === 'cost_diversity') {
    const existingCosts = getPlayerCardCosts(player);
    if (!existingCosts.has(card.value)) {
      bonus += strategy.weight * 0.3;
    }
  }

  // Strategie cout minimum
  if (type === 'cost_min') {
    const minCost = params.minCost as number;
    if (card.value >= minCost) {
      bonus += strategy.weight * 0.3;
    }
  }

  return bonus;
}

/**
 * Verifie si une carte neutraliserait une strategie existante
 */
function wouldNeutralizeStrategy(
  cardId: string,
  card: ReturnType<typeof getCard>,
  analysis: StrategyAnalysis,
  _player: PlayPlayer
): boolean {
  if (!card) return false;

  for (const strategy of analysis.strategies) {
    if (strategy.isInvalidated) continue;

    const { type, params } = strategy.definition;

    // Ajouter une couleur qui neutralise "pas de X couleur"
    if (type === 'no_shield_color') {
      const avoidedColor = params.color as ShieldColor;
      for (const shield of card.shields) {
        if (shield.color === avoidedColor) {
          return true;
        }
      }
    }

    // Ajouter une feature qui neutralise "pas de feature"
    if (type === 'no_feature') {
      const feature = params.feature as string;
      if (
        (feature === 'price_reduction' && card.has_price_reduction) ||
        (feature === 'coin_purse' && card.has_coin_purse)
      ) {
        return true;
      }
    }

    // Carte retournee qui neutralise "pas de retournee"
    if (type === 'no_flipped' && (cardId === '089' || cardId === '090')) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Verifie si le joueur a un bouclier d'une couleur donnee
 */
export function playerHasShieldColor(player: PlayPlayer, color: ShieldColor): boolean {
  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      if (shield.color === color) return true;
    }
  }
  return false;
}

/**
 * Retourne les couleurs de boucliers du joueur
 */
export function getPlayerShieldColors(player: PlayPlayer): Set<ShieldColor> {
  const colors = new Set<ShieldColor>();
  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      colors.add(shield.color);
    }
  }
  return colors;
}

/**
 * Verifie si le joueur a une feature donnee
 */
export function playerHasFeature(player: PlayPlayer, feature: string): boolean {
  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    if (feature === 'price_reduction' && card.has_price_reduction) return true;
    if (feature === 'lock' && card.has_lock) return true;
    if (feature === 'coin_purse' && card.has_coin_purse) return true;
  }
  return false;
}

/**
 * Verifie si le joueur a une carte retournee
 */
export function playerHasFlippedCard(player: PlayPlayer): boolean {
  for (const placed of player.board) {
    if (placed?.isFlipped) return true;
  }
  return false;
}

/**
 * Retourne les couts des cartes du joueur
 */
export function getPlayerCardCosts(player: PlayPlayer): Set<number> {
  const costs = new Set<number>();
  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card) costs.add(card.value);
  }
  return costs;
}

/**
 * Compte les boucliers d'une couleur sur le plateau du joueur
 */
export function countPlayerShields(player: PlayPlayer, color: ShieldColor): number {
  let count = 0;
  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      if (shield.color === color) {
        count += shield.count;
      }
    }
  }
  return count;
}
