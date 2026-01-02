/**
 * Fonctions d'evaluation pour l'IA Normale
 *
 * Ce module contient les fonctions pour :
 * - Evaluer les cartes a l'achat
 * - Evaluer les positions de placement
 * - Decider de l'utilisation des cles
 * - Gerer l'or et les ressources
 */

import type {
  PlayGameState,
  PlayPlayer,
  ShieldColor,
  Location,
} from '../../../../types/play';
import { getCard, canAffordCard, getCurrentPlayer } from '../../gameEngine';
import type { StrategyAnalysis } from './strategies';
import {
  analyzePlayerStrategies,
  evaluateCardStrategyFit,
} from './strategies';

// =============================================================================
// Types
// =============================================================================

export interface CardEvaluation {
  cardId: string;
  score: number;              // Score global
  strategyFit: number;        // Compatibilite avec les strategies
  resourceValue: number;      // Valeur en ressources (or, cles)
  shieldValue: number;        // Valeur des boucliers
  featureValue: number;       // Valeur des features
  costPenalty: number;        // Malus de cout
  canAfford: boolean;
  effectiveCost: number;
}

export interface PositionEvaluation {
  position: number;
  score: number;
  shieldAlignments: number;   // Bonus d'alignement boucliers
  categoryAlignments: number; // Bonus d'alignement categories
  strategyBonus: number;      // Bonus pour strategies de position
}

export type GoldSituation = 'comfortable' | 'ok' | 'tight' | 'broke';

// =============================================================================
// Evaluation des cartes
// =============================================================================

/**
 * Evalue une carte pour l'achat
 */
export function evaluateCard(
  cardId: string,
  player: PlayPlayer,
  analysis: StrategyAnalysis
): CardEvaluation {
  const card = getCard(cardId);
  const { canAfford, cost } = canAffordCard(player, cardId);

  if (!card) {
    return {
      cardId,
      score: -1000,
      strategyFit: 0,
      resourceValue: 0,
      shieldValue: 0,
      featureValue: 0,
      costPenalty: 0,
      canAfford: false,
      effectiveCost: 0,
    };
  }

  // 1. Compatibilite avec les strategies
  const strategyFit = evaluateCardStrategyFit(cardId, analysis, player);

  // Si la carte est en conflit total, ne pas aller plus loin
  if (strategyFit <= -100) {
    return {
      cardId,
      score: -1000,
      strategyFit,
      resourceValue: 0,
      shieldValue: 0,
      featureValue: 0,
      costPenalty: 0,
      canAfford,
      effectiveCost: cost,
    };
  }

  // 2. Valeur des boucliers selon les strategies
  let shieldValue = 0;
  for (const shield of card.shields) {
    // Bonus si couleur recommandee
    if (analysis.recommendedColors.includes(shield.color)) {
      shieldValue += shield.count * 4;
    } else if (analysis.avoidedColors.includes(shield.color)) {
      shieldValue -= shield.count * 6;
    } else {
      // Valeur de base
      shieldValue += shield.count * 1;
    }
  }

  // 3. Valeur des features
  let featureValue = 0;

  // Reduction - toujours utile sauf si strategie "pas de reduction"
  if (card.has_price_reduction) {
    const hasNoReductionStrategy = analysis.strategies.some(
      s => s.definition.type === 'no_feature' &&
           s.definition.params.feature === 'price_reduction' &&
           !s.isInvalidated
    );
    featureValue += hasNoReductionStrategy ? -20 : 4;
  }

  // Messager - flexibilite
  if (card.has_messenger) {
    featureValue += 2;
  }

  // Bourse - valeur selon strategie
  if (card.has_coin_purse) {
    const hasNoPurseStrategy = analysis.strategies.some(
      s => s.definition.type === 'no_feature' &&
           s.definition.params.feature === 'coin_purse' &&
           !s.isInvalidated
    );
    featureValue += hasNoPurseStrategy ? -20 : (card.max_coins ?? 0) * 0.3;
  }

  // Cadenas - valeur moderee
  if (card.has_lock) {
    featureValue += 1;
  }

  // 4. Valeur des effets de la carte (gain d'or, cles, etc.)
  let resourceValue = 0;
  for (const effect of card.effects) {
    resourceValue += evaluateCardEffect(effect, player, analysis);
  }

  // 5. Malus de cout
  const goldSituation = evaluateGoldSituation(player);
  let costPenalty = cost * 0.3;
  if (goldSituation === 'tight') {
    costPenalty = cost * 0.6;
  } else if (goldSituation === 'broke') {
    costPenalty = cost * 1.0;
  }

  // 6. Score total
  const score = strategyFit + shieldValue + featureValue + resourceValue - costPenalty;

  return {
    cardId,
    score,
    strategyFit,
    resourceValue,
    shieldValue,
    featureValue,
    costPenalty,
    canAfford,
    effectiveCost: cost,
  };
}

/**
 * Evalue un effet de carte
 */
function evaluateCardEffect(
  effect: { type: string; amount?: number; color?: ShieldColor },
  _player: PlayPlayer,
  analysis: StrategyAnalysis
): number {
  let value = 0;

  switch (effect.type) {
    // Effets de gain d'or - tres utiles
    case 'gain_gold':
      value += (effect.amount ?? 0) * 0.8;
      break;
    case 'gain_gold_per_castle':
    case 'gain_gold_per_village':
      // Valeur selon le nombre de cartes de la categorie
      value += (effect.amount ?? 0) * 1.5;
      break;
    case 'gain_gold_per_card':
    case 'gain_gold_per_shield':
      value += (effect.amount ?? 0) * 1.0;
      break;

    // Effets de gain de cles
    case 'gain_keys':
      // Les cles valent plus si on a 017 ou 066
      const hasKeyScoring = analysis.strategies.some(
        s => s.definition.type === 'keys_count'
      );
      value += (effect.amount ?? 0) * (hasKeyScoring ? 2 : 0.5);
      break;

    // Effets de remplissage de bourses
    case 'fill_purses':
    case 'fill_purses_select':
      value += 2;
      break;

    // Effets de reduction
    case 'reduction_castle':
    case 'reduction_village':
    case 'reduction_both':
      value += 3;
      break;

    // Choix - valeur moyenne
    case 'choice':
      value += 2;
      break;

    default:
      value += 1;
  }

  return value;
}

/**
 * Evalue toutes les cartes disponibles et les trie
 */
export function evaluateAvailableCards(
  state: PlayGameState,
  availableCards: string[]
): CardEvaluation[] {
  const player = getCurrentPlayer(state);
  const analysis = analyzePlayerStrategies(player);

  const evaluations = availableCards.map(cardId =>
    evaluateCard(cardId, player, analysis)
  );

  // Trier par score decroissant
  evaluations.sort((a, b) => b.score - a.score);

  return evaluations;
}

// =============================================================================
// Evaluation des positions
// =============================================================================

/**
 * Evalue une position de placement
 */
export function evaluatePosition(
  cardId: string,
  position: number,
  player: PlayPlayer,
  analysis: StrategyAnalysis
): PositionEvaluation {
  const card = getCard(cardId);
  if (!card) {
    return { position, score: 0, shieldAlignments: 0, categoryAlignments: 0, strategyBonus: 0 };
  }

  const row = Math.floor(position / 3);
  const col = position % 3;

  let shieldAlignments = 0;
  let categoryAlignments = 0;
  let strategyBonus = 0;

  // 1. Alignement des boucliers sur ligne et colonne
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
            // Bonus plus eleve si couleur recommandee
            const bonus = analysis.recommendedColors.includes(shield.color) ? 4 : 2;
            shieldAlignments += bonus;
          }
        }
      }
    }

    // Meme colonne
    if (placedCol === col) {
      for (const shield of card.shields) {
        for (const placedShield of placedCard.shields) {
          if (shield.color === placedShield.color) {
            const bonus = analysis.recommendedColors.includes(shield.color) ? 4 : 2;
            shieldAlignments += bonus;
          }
        }
      }
    }

    // Meme ligne ou colonne - alignement categories
    if (placedRow === row || placedCol === col) {
      if (card.category && card.category === placedCard.category) {
        categoryAlignments += 2;
      }
    }
  }

  // 2. Bonus pour strategies de position
  for (const strategy of analysis.strategies) {
    if (strategy.isInvalidated) continue;

    const { type, params } = strategy.definition;

    // Si c'est la carte de la strategie, elle doit etre bien placee
    if (strategy.cardId === cardId) {
      if (type === 'position_row') {
        const targetRow = params.row === 'top' ? 0 : params.row === 'middle' ? 1 : 2;
        if (row === targetRow) {
          strategyBonus += strategy.weight * 0.5;
        }
      }
      if (type === 'position_col') {
        const targetCol = params.col === 'left' ? 0 : params.col === 'middle' ? 1 : 2;
        if (col === targetCol) {
          strategyBonus += strategy.weight * 0.5;
        }
      }
      if (type === 'position_corner' && [0, 2, 6, 8].includes(position)) {
        strategyBonus += strategy.weight * 0.5;
      }
      if (type === 'position_border' && [1, 3, 5, 7].includes(position)) {
        strategyBonus += strategy.weight * 0.5;
      }
    }

    // Si strategie de couleur sur ligne/colonne, placer pour maximiser
    if (type === 'shield_color_line' || type === 'shield_color_col' || type === 'shield_color_both') {
      const targetColor = params.color as ShieldColor;
      const hasTargetColor = card.shields.some(s => s.color === targetColor);

      if (hasTargetColor) {
        // Trouver la position de la carte de strategie
        const strategyPos = player.board.findIndex(p => p?.cardId === strategy.cardId);
        if (strategyPos !== -1) {
          const strategyRow = Math.floor(strategyPos / 3);
          const strategyCol = strategyPos % 3;

          if (type === 'shield_color_line' && row === strategyRow) {
            strategyBonus += 10;
          }
          if (type === 'shield_color_col' && col === strategyCol) {
            strategyBonus += 10;
          }
          if (type === 'shield_color_both' && (row === strategyRow || col === strategyCol)) {
            strategyBonus += 8;
          }
        }
      }
    }
  }

  const score = shieldAlignments + categoryAlignments + strategyBonus;

  return { position, score, shieldAlignments, categoryAlignments, strategyBonus };
}

/**
 * Evalue toutes les positions valides
 */
export function evaluatePositions(
  cardId: string,
  validPositions: number[],
  player: PlayPlayer,
  analysis: StrategyAnalysis
): PositionEvaluation[] {
  const evaluations = validPositions.map(pos =>
    evaluatePosition(cardId, pos, player, analysis)
  );

  evaluations.sort((a, b) => b.score - a.score);

  return evaluations;
}

// =============================================================================
// Gestion de l'or
// =============================================================================

/**
 * Evalue la situation financiere du joueur
 */
export function evaluateGoldSituation(player: PlayPlayer): GoldSituation {
  const gold = player.gold;
  const cardCount = player.board.filter(c => c !== null).length;

  // En debut de partie, on peut etre plus a l'aise
  const avgCardCost = 3.5;

  // Estimation du nombre de tours restants
  const turnsLeft = 9 - cardCount;

  if (turnsLeft <= 0) return 'comfortable'; // Partie finie

  // Or moyen necessaire par tour
  const goldPerTurn = gold / turnsLeft;

  if (goldPerTurn >= avgCardCost * 1.5) return 'comfortable';
  if (goldPerTurn >= avgCardCost) return 'ok';
  if (goldPerTurn >= avgCardCost * 0.5) return 'tight';
  return 'broke';
}

/**
 * Verifie si le joueur devrait considerer un achat face cachee
 */
export function shouldConsiderFlippedPurchase(
  player: PlayPlayer,
  analysis: StrategyAnalysis,
  availableCards: CardEvaluation[]
): boolean {
  // Ne jamais acheter face cachee si strategie "pas de retournee"
  const hasNoFlippedStrategy = analysis.strategies.some(
    s => s.definition.type === 'no_flipped' && !s.isInvalidated
  );
  if (hasNoFlippedStrategy) return false;

  // Situation financiere desespere ?
  const goldSituation = evaluateGoldSituation(player);
  if (goldSituation !== 'broke') return false;

  // Aucune carte abordable interessante ?
  const affordableInteresting = availableCards.filter(
    e => e.canAfford && e.score > 0
  );
  if (affordableInteresting.length > 0) return false;

  return true;
}

// =============================================================================
// Evaluation de l'utilisation des cles
// =============================================================================

/**
 * Evalue si l'IA devrait utiliser une cle pour deplacer le messager
 */
export function evaluateMessengerMove(
  state: PlayGameState,
  targetLocation: Location
): { shouldMove: boolean; reason: string; gain: number } {
  const player = getCurrentPlayer(state);
  const analysis = analyzePlayerStrategies(player);

  const currentLocation = state.board.messengerLocation;
  if (currentLocation === targetLocation) {
    return { shouldMove: false, reason: 'Deja sur ce lieu', gain: 0 };
  }

  // Cout de la cle en points
  let keyCost = 1;
  const hasKeyScoring = analysis.strategies.some(
    s => s.definition.type === 'keys_count' && !s.isInvalidated
  );
  if (hasKeyScoring) {
    // 017 = 1pt/cle, 066 = 1pt/cle, les deux = 2pts/cle
    const keyCards = analysis.strategies.filter(s => s.definition.type === 'keys_count');
    keyCost += keyCards.length;
  }

  // Risque si derniere cle
  if (player.keys === 1) {
    keyCost += 2;
  }

  // Evaluer les cartes du lieu cible vs lieu actuel
  const currentCards = currentLocation === 'castle'
    ? state.board.castleCards
    : state.board.villageCards;
  const targetCards = targetLocation === 'castle'
    ? state.board.castleCards
    : state.board.villageCards;

  const currentEvals = currentCards.map(id => evaluateCard(id, player, analysis));
  const targetEvals = targetCards.map(id => evaluateCard(id, player, analysis));

  const bestCurrent = Math.max(...currentEvals.map(e => e.score));
  const bestTarget = Math.max(...targetEvals.map(e => e.score));

  const gain = bestTarget - bestCurrent - keyCost;

  if (gain > 3) {
    return {
      shouldMove: true,
      reason: `Carte interessante (gain net: ${gain.toFixed(1)})`,
      gain,
    };
  }

  return { shouldMove: false, reason: 'Pas assez de gain', gain };
}

/**
 * Evalue si l'IA devrait utiliser une cle pour rafraichir le marche
 */
export function evaluateMarketRefresh(
  state: PlayGameState,
  location: Location
): { shouldRefresh: boolean; reason: string } {
  const player = getCurrentPlayer(state);
  const analysis = analyzePlayerStrategies(player);

  // Cout de la cle
  let keyCost = 1;
  const hasKeyScoring = analysis.strategies.some(
    s => s.definition.type === 'keys_count' && !s.isInvalidated
  );
  if (hasKeyScoring) {
    keyCost += 1;
  }

  // Evaluer les cartes actuelles
  const cards = location === 'castle'
    ? state.board.castleCards
    : state.board.villageCards;

  const evals = cards.map(id => evaluateCard(id, player, analysis));
  const bestScore = Math.max(...evals.map(e => e.score));
  const avgScore = evals.reduce((sum, e) => sum + e.score, 0) / evals.length;

  // Refresh si toutes les cartes sont mauvaises
  if (bestScore < -10 && avgScore < -5) {
    return {
      shouldRefresh: true,
      reason: 'Toutes les cartes sont mauvaises pour la strategie',
    };
  }

  // Refresh si toutes les cartes sont inabordables et situation serree
  const anyAffordable = evals.some(e => e.canAfford);
  if (!anyAffordable && evaluateGoldSituation(player) === 'broke') {
    // Verifier si le refresh pourrait aider (cartes moins cheres possibles)
    return {
      shouldRefresh: true,
      reason: 'Aucune carte abordable, tentative de refresh',
    };
  }

  return { shouldRefresh: false, reason: '' };
}

/**
 * Decide de l'action de cle a effectuer
 */
export function decideKeyAction(
  state: PlayGameState
): { type: 'move_messenger' | 'refresh'; targetLocation: Location } | null {
  const player = getCurrentPlayer(state);

  if (player.keys === 0) return null;

  const currentLocation = state.board.messengerLocation;
  const otherLocation = currentLocation === 'castle' ? 'village' : 'castle';

  // 1. Evaluer le deplacement du messager
  const moveEval = evaluateMessengerMove(state, otherLocation);
  if (moveEval.shouldMove) {
    return { type: 'move_messenger', targetLocation: otherLocation };
  }

  // 2. Evaluer le refresh du marche actuel
  const refreshCurrent = evaluateMarketRefresh(state, currentLocation);
  if (refreshCurrent.shouldRefresh) {
    return { type: 'refresh', targetLocation: currentLocation };
  }

  // 3. Evaluer le refresh de l'autre marche (si on ne peut pas y aller)
  const refreshOther = evaluateMarketRefresh(state, otherLocation);
  if (refreshOther.shouldRefresh && player.keys >= 2) {
    // On peut refresh l'autre lieu puis y aller au tour suivant
    return { type: 'refresh', targetLocation: otherLocation };
  }

  return null;
}

// =============================================================================
// Evaluation des cadenas
// =============================================================================

/**
 * Evalue l'utilisation d'un cadenas
 */
export function evaluateLockUsage(
  state: PlayGameState,
  lockPosition: number
): { shouldUse: boolean; value: number; reason: string } {
  const player = getCurrentPlayer(state);
  const analysis = analyzePlayerStrategies(player);
  const placed = player.board[lockPosition];

  if (!placed) return { shouldUse: false, value: 0, reason: 'Pas de carte' };

  const card = getCard(placed.cardId);
  if (!card || !card.lock_effect) {
    return { shouldUse: false, value: 0, reason: 'Pas d\'effet cadenas' };
  }

  const lockEffect = card.lock_effect;
  let value = 0;
  let reason = '';

  // Evaluer selon le type d'effet
  switch (lockEffect.type) {
    case 'gain_gold':
      // Utiliser si on manque d'or
      const goldSituation = evaluateGoldSituation(player);
      if (goldSituation === 'tight' || goldSituation === 'broke') {
        value = (lockEffect.amount ?? 0) * 1.5;
        reason = 'Besoin d\'or';
      } else {
        value = (lockEffect.amount ?? 0) * 0.5;
        reason = 'Or supplementaire';
      }
      break;

    case 'gain_keys':
      // Utiliser si strategie cles
      const hasKeyScoring = analysis.strategies.some(
        s => s.definition.type === 'keys_count'
      );
      value = (lockEffect.amount ?? 0) * (hasKeyScoring ? 3 : 1);
      reason = hasKeyScoring ? 'Bonus cles pour scoring' : 'Cles supplementaires';
      break;

    case 'replace_location':
    case 'replace_location_gain_keys_per_feature':
    case 'replace_location_gain_keys_per_shield':
      // Evaluer si les cartes actuelles sont mauvaises
      const location = state.board.messengerLocation;
      const refreshEval = evaluateMarketRefresh(state, location);
      if (refreshEval.shouldRefresh) {
        value = 5;
        reason = 'Refresh necessaire';
      } else {
        value = 1;
        reason = 'Refresh optionnel';
      }
      break;

    default:
      value = 2;
      reason = 'Effet utile';
  }

  // Seuil pour utiliser
  const shouldUse = value >= 3;

  return { shouldUse, value, reason };
}

/**
 * Choisit le meilleur cadenas a utiliser
 */
export function chooseBestLock(
  state: PlayGameState,
  availableLocks: number[]
): number | null {
  const player = getCurrentPlayer(state);
  const cardCount = player.board.filter(c => c !== null).length;

  // En debut de partie, garder les cadenas
  if (cardCount < 5) return null;

  let bestLock: number | null = null;
  let bestValue = 0;

  for (const pos of availableLocks) {
    const { shouldUse, value } = evaluateLockUsage(state, pos);
    if (shouldUse && value > bestValue) {
      bestValue = value;
      bestLock = pos;
    }
  }

  return bestLock;
}
