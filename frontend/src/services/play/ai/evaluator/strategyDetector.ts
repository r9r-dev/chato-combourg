/**
 * Détecteur de stratégie et calculateur de potentiel
 *
 * Ce module permet à l'IA de :
 * 1. Identifier les cartes "build-around" à haut potentiel
 * 2. Détecter la stratégie en cours basée sur le plateau
 * 3. Calculer un bonus de potentiel pour les cartes qui renforcent la stratégie
 * 4. Ajouter de la variance pour des décisions moins prévisibles
 */

import type { PlayPlayer, PlayCard } from '../../../../types/play';

// =============================================================================
// CONFIGURATION DE LA VARIANCE
// =============================================================================

/**
 * Facteur de variance pour les bonus (0 = pas de variance, 0.3 = ±30%)
 * Plus la valeur est haute, plus l'IA sera imprévisible
 */
const VARIANCE_FACTOR = 0.25;

/**
 * Ajoute de la variance à une valeur de bonus
 * @param value Valeur de base
 * @param factor Facteur de variance (défaut: VARIANCE_FACTOR)
 * @returns Valeur avec variance appliquée
 */
function addVariance(value: number, factor: number = VARIANCE_FACTOR): number {
  if (value === 0 || factor === 0) return value;
  // Variance uniforme entre -factor et +factor
  const variance = (Math.random() * 2 - 1) * factor;
  return Math.round(value * (1 + variance));
}

// =============================================================================
// TYPES DE STRATÉGIES
// =============================================================================

export type StrategyType =
  | 'shield_pairs'      // Paires d'écus (008, 022, 068)
  | 'shield_trios'      // Trios d'écus (018, 054)
  | 'shield_sets'       // Sets de 3 écus de même couleur (027)
  | 'keys'              // Accumulation de clés (017, 066)
  | 'coins'             // Pièces sur bourses (020, 036, 053)
  | 'reductions'        // Symboles réduction (032)
  | 'high_cost'         // Cartes coûteuses (039)
  | 'row_sum'           // Somme des coûts en ligne (034)
  | 'col_sum'           // Somme des coûts en colonne (077)
  | 'missing_colors'    // Couleurs absentes (038)
  | 'none';             // Pas de stratégie claire

// =============================================================================
// CARTES BUILD-AROUND
// =============================================================================

export interface BuildAroundCard {
  cardId: string;
  strategy: StrategyType;
  maxPotential: number;       // Score maximum réaliste
  requiredColors?: string[];  // Couleurs nécessaires pour scorer
  requiredFeature?: string;   // Feature nécessaire (reduction, purse, etc.)
  minTurnsToRealize: number;  // Tours minimum pour réaliser le potentiel
  earlyGameBonus: number;     // Bonus si acheté tôt (tours 1-3)
  midGameBonus: number;       // Bonus si acheté milieu (tours 4-6)
  lateGamePenalty: number;    // Pénalité si acheté tard (tours 7-9)
}

/**
 * Définition des cartes build-around avec leur potentiel
 */
export const BUILD_AROUND_CARDS: Record<string, BuildAroundCard> = {
  // === PAIRES D'ÉCUS (4 pts par paire) ===
  '008': {
    cardId: '008',
    strategy: 'shield_pairs',
    maxPotential: 16,  // 4 paires × 4 pts
    requiredColors: ['pink', 'orange'],
    minTurnsToRealize: 4,
    earlyGameBonus: 8,
    midGameBonus: 4,
    lateGamePenalty: -6,
  },
  '022': {
    cardId: '022',
    strategy: 'shield_pairs',
    maxPotential: 16,
    requiredColors: ['blue', 'red'],
    minTurnsToRealize: 4,
    earlyGameBonus: 8,
    midGameBonus: 4,
    lateGamePenalty: -6,
  },
  '068': {
    cardId: '068',
    strategy: 'shield_pairs',
    maxPotential: 16,
    requiredColors: ['green', 'yellow'],
    minTurnsToRealize: 4,
    earlyGameBonus: 8,
    midGameBonus: 4,
    lateGamePenalty: -6,
  },

  // === TRIOS D'ÉCUS (7-10 pts par trio) ===
  '018': {
    cardId: '018',
    strategy: 'shield_trios',
    maxPotential: 30,  // 3 trios × 10 pts
    requiredColors: ['blue', 'green', 'orange'],
    minTurnsToRealize: 5,
    earlyGameBonus: 12,
    midGameBonus: 6,
    lateGamePenalty: -10,
  },
  '054': {
    cardId: '054',
    strategy: 'shield_trios',
    maxPotential: 21,  // 3 trios × 7 pts
    requiredColors: ['pink', 'red', 'yellow'],
    minTurnsToRealize: 5,
    earlyGameBonus: 10,
    midGameBonus: 5,
    lateGamePenalty: -8,
  },

  // === SETS DE 3 ÉCUS (6 pts par set) ===
  '027': {
    cardId: '027',
    strategy: 'shield_sets',
    maxPotential: 18,  // 3 sets × 6 pts
    minTurnsToRealize: 4,
    earlyGameBonus: 8,
    midGameBonus: 4,
    lateGamePenalty: -6,
  },

  // === CLÉS (1-2 pts par clé) ===
  '017': {
    cardId: '017',
    strategy: 'keys',
    maxPotential: 15,  // 15 clés possibles
    minTurnsToRealize: 3,
    earlyGameBonus: 6,
    midGameBonus: 4,
    lateGamePenalty: -2,
  },
  '066': {
    cardId: '066',
    strategy: 'keys',
    maxPotential: 15,
    minTurnsToRealize: 3,
    earlyGameBonus: 6,
    midGameBonus: 4,
    lateGamePenalty: -2,
  },

  // === PIÈCES SUR BOURSES ===
  '020': {
    cardId: '020',
    strategy: 'coins',
    maxPotential: 25,  // Beaucoup de bourses remplies
    requiredFeature: 'coin_purse',
    minTurnsToRealize: 4,
    earlyGameBonus: 10,
    midGameBonus: 5,
    lateGamePenalty: -8,
  },
  '036': {
    cardId: '036',
    strategy: 'coins',
    maxPotential: 16,  // 8 pièces × 2
    minTurnsToRealize: 3,
    earlyGameBonus: 8,
    midGameBonus: 5,
    lateGamePenalty: -4,
  },
  '053': {
    cardId: '053',
    strategy: 'coins',
    maxPotential: 18,  // 9 pièces × 2
    minTurnsToRealize: 3,
    earlyGameBonus: 8,
    midGameBonus: 5,
    lateGamePenalty: -4,
  },

  // === RÉDUCTIONS ===
  '032': {
    cardId: '032',
    strategy: 'reductions',
    maxPotential: 20,  // 5 cartes réduction × 4
    requiredFeature: 'price_reduction',
    minTurnsToRealize: 4,
    earlyGameBonus: 10,
    midGameBonus: 4,
    lateGamePenalty: -8,
  },

  // === CARTES COÛTEUSES ===
  '039': {
    cardId: '039',
    strategy: 'high_cost',
    maxPotential: 25,  // 5 cartes >= 5 × 5 pts
    minTurnsToRealize: 4,
    earlyGameBonus: 10,
    midGameBonus: 5,
    lateGamePenalty: -6,
  },

  // === SOMME LIGNE/COLONNE ===
  '034': {
    cardId: '034',
    strategy: 'row_sum',
    maxPotential: 21,  // 7 + 7 + 7
    minTurnsToRealize: 3,
    earlyGameBonus: 6,
    midGameBonus: 4,
    lateGamePenalty: -4,
  },
  '077': {
    cardId: '077',
    strategy: 'col_sum',
    maxPotential: 21,
    minTurnsToRealize: 3,
    earlyGameBonus: 6,
    midGameBonus: 4,
    lateGamePenalty: -4,
  },

  // === COULEURS ABSENTES ===
  '038': {
    cardId: '038',
    strategy: 'missing_colors',
    maxPotential: 18,  // 3 couleurs absentes × 6 pts
    minTurnsToRealize: 2,
    earlyGameBonus: 8,
    midGameBonus: 4,
    lateGamePenalty: -6,
  },
};

// =============================================================================
// DÉTECTION DE STRATÉGIE
// =============================================================================

export interface DetectedStrategy {
  type: StrategyType;
  strength: number;       // Force de la stratégie (0-1)
  buildAroundCards: string[];  // Cartes build-around sur le plateau
  supportingColors: Set<string>;
  supportingFeatures: Set<string>;
}

/**
 * Détecte la stratégie dominante sur le plateau du joueur
 */
export function detectStrategy(
  player: PlayPlayer,
  cards: Map<string, PlayCard>
): DetectedStrategy {
  const strategies: Map<StrategyType, number> = new Map();
  const buildAroundOnBoard: string[] = [];
  const colorsOnBoard = new Set<string>();
  const featuresOnBoard = new Set<string>();

  // Analyser chaque carte sur le plateau
  for (const placed of player.board) {
    if (!placed) continue;

    const card = cards.get(placed.cardId);
    if (!card) continue;

    // Collecter les couleurs
    for (const shield of card.shields) {
      colorsOnBoard.add(shield.color);
    }

    // Collecter les features
    if (card.has_price_reduction) featuresOnBoard.add('price_reduction');
    if (card.has_coin_purse) featuresOnBoard.add('coin_purse');
    if (card.has_lock) featuresOnBoard.add('lock');
    if (card.has_messenger) featuresOnBoard.add('messenger');

    // Vérifier si c'est une carte build-around
    const buildAround = BUILD_AROUND_CARDS[placed.cardId];
    if (buildAround) {
      buildAroundOnBoard.push(placed.cardId);
      const currentScore = strategies.get(buildAround.strategy) ?? 0;
      strategies.set(buildAround.strategy, currentScore + 1);
    }
  }

  // Trouver la stratégie dominante
  let dominantStrategy: StrategyType = 'none';
  let maxScore = 0;

  for (const [strategy, score] of strategies) {
    if (score > maxScore) {
      maxScore = score;
      dominantStrategy = strategy;
    }
  }

  // Calculer la force de la stratégie
  const placedCount = player.board.filter(p => p !== null).length;
  const strength = placedCount > 0 ? maxScore / placedCount : 0;

  return {
    type: dominantStrategy,
    strength,
    buildAroundCards: buildAroundOnBoard,
    supportingColors: colorsOnBoard,
    supportingFeatures: featuresOnBoard,
  };
}

// =============================================================================
// CALCUL DU BONUS DE POTENTIEL
// =============================================================================

/**
 * Calcule le bonus de potentiel pour une carte d'achat
 *
 * @param cardId - ID de la carte à acheter
 * @param player - État du joueur
 * @param turnNumber - Numéro du tour actuel
 * @param detectedStrategy - Stratégie détectée
 * @param cards - Map des cartes
 * @returns Bonus de potentiel (positif = carte recommandée)
 */
export function calculatePotentialBonus(
  cardId: string,
  player: PlayPlayer,
  turnNumber: number,
  detectedStrategy: DetectedStrategy,
  cards: Map<string, PlayCard>
): { bonus: number; reasons: string[] } {
  const reasons: string[] = [];
  let bonus = 0;

  const card = cards.get(cardId);
  if (!card) return { bonus: 0, reasons: [] };

  const placedCount = player.board.filter(p => p !== null).length;
  const turnsRemaining = 9 - placedCount;

  // ==========================================================================
  // 1. BONUS SI LA CARTE EST BUILD-AROUND (avec variance)
  // ==========================================================================
  const buildAround = BUILD_AROUND_CARDS[cardId];
  if (buildAround) {
    // Déterminer la phase de jeu
    if (turnNumber <= 3) {
      // Early game: gros bonus avec variance
      const earlyBonus = addVariance(buildAround.earlyGameBonus);
      bonus += earlyBonus;
      reasons.push(`Build-around tôt: +${earlyBonus}`);
    } else if (turnNumber <= 6) {
      // Mid game: bonus modéré avec variance
      const midBonus = addVariance(buildAround.midGameBonus);
      bonus += midBonus;
      reasons.push(`Build-around milieu: +${midBonus}`);
    } else {
      // Late game: pénalité si pas assez de tours pour réaliser
      if (turnsRemaining < buildAround.minTurnsToRealize) {
        const latePenalty = addVariance(buildAround.lateGamePenalty);
        bonus += latePenalty;
        reasons.push(`Build-around tard: ${latePenalty}`);
      }
    }

    // Bonus supplémentaire si les couleurs requises sont déjà présentes
    if (buildAround.requiredColors) {
      const colorsPresent = buildAround.requiredColors.filter(
        c => detectedStrategy.supportingColors.has(c)
      ).length;
      const colorBonus = addVariance(colorsPresent * 2);
      if (colorBonus > 0) {
        bonus += colorBonus;
        reasons.push(`Couleurs présentes (${colorsPresent}/${buildAround.requiredColors.length}): +${colorBonus}`);
      }
    }

    // Bonus si la feature requise est présente
    if (buildAround.requiredFeature && detectedStrategy.supportingFeatures.has(buildAround.requiredFeature)) {
      const featureBonus = addVariance(3);
      bonus += featureBonus;
      reasons.push(`Feature ${buildAround.requiredFeature} présente: +${featureBonus}`);
    }
  }

  // ==========================================================================
  // 2. BONUS SI LA CARTE RENFORCE LA STRATÉGIE DÉTECTÉE (avec variance)
  // ==========================================================================
  if (detectedStrategy.type !== 'none' && detectedStrategy.strength > 0.2) {
    const rawStrategyBonus = calculateStrategySupportBonus(
      cardId,
      card,
      detectedStrategy,
      turnsRemaining
    );
    if (rawStrategyBonus > 0) {
      const strategyBonus = addVariance(rawStrategyBonus);
      bonus += strategyBonus;
      reasons.push(`Renforce stratégie ${detectedStrategy.type}: +${strategyBonus}`);
    }
  }

  // ==========================================================================
  // 3. BONUS SI LA CARTE A DES COULEURS QUI MATCHENT UNE BUILD-AROUND (avec variance)
  // ==========================================================================
  for (const buildAroundCardId of detectedStrategy.buildAroundCards) {
    const buildAroundDef = BUILD_AROUND_CARDS[buildAroundCardId];
    if (!buildAroundDef?.requiredColors) continue;

    // Compter combien de couleurs de la nouvelle carte matchent
    let matchingColors = 0;
    for (const shield of card.shields) {
      if (buildAroundDef.requiredColors.includes(shield.color)) {
        matchingColors += shield.count;
      }
    }

    if (matchingColors > 0) {
      const matchBonus = addVariance(matchingColors * 3);
      bonus += matchBonus;
      reasons.push(`Match ${buildAroundCardId} (${matchingColors} écus): +${matchBonus}`);
    }
  }

  return { bonus, reasons };
}

/**
 * Calcule le bonus si la carte supporte la stratégie détectée
 */
function calculateStrategySupportBonus(
  _cardId: string,
  card: PlayCard,
  strategy: DetectedStrategy,
  turnsRemaining: number
): number {
  let bonus = 0;

  switch (strategy.type) {
    case 'shield_pairs':
    case 'shield_trios':
    case 'shield_sets': {
      // Bonus pour chaque écu qui match une couleur supportée
      for (const shield of card.shields) {
        if (strategy.supportingColors.has(shield.color)) {
          bonus += shield.count * 2;
        }
      }
      break;
    }

    case 'keys': {
      // Bonus pour les cartes qui génèrent des clés
      for (const effect of card.effects) {
        if (effect.type === 'gain_keys' || effect.type === 'gain_keys_per_shield') {
          bonus += 4;
        }
      }
      // Bonus pour les cartes avec écus rouges (souvent liées aux clés)
      for (const shield of card.shields) {
        if (shield.color === 'red') {
          bonus += shield.count;
        }
      }
      break;
    }

    case 'coins': {
      // Bonus pour les cartes bourse
      if (card.has_coin_purse) {
        bonus += Math.min(card.max_coins, turnsRemaining) * 1.5;
      }
      // Bonus pour les cartes qui remplissent les bourses
      for (const effect of card.effects) {
        if (effect.type === 'fill_purses' || effect.type === 'fill_purses_select') {
          bonus += (effect.amount ?? 2) * 2;
        }
      }
      break;
    }

    case 'reductions': {
      // Bonus pour les cartes avec réduction
      if (card.has_price_reduction) {
        bonus += 4;
      }
      break;
    }

    case 'high_cost': {
      // Bonus pour les cartes coûteuses
      if (card.value >= 5) {
        bonus += 5;
      } else if (card.value >= 4) {
        bonus += 2;
      }
      break;
    }

    case 'row_sum':
    case 'col_sum': {
      // Bonus pour les cartes coûteuses (augmentent la somme)
      if (card.value >= 6) {
        bonus += 4;
      } else if (card.value >= 4) {
        bonus += 2;
      }
      break;
    }

    case 'missing_colors': {
      // Pénalité pour les nouvelles couleurs (stratégie veut limiter les couleurs)
      let newColors = 0;
      for (const shield of card.shields) {
        if (!strategy.supportingColors.has(shield.color)) {
          newColors++;
        }
      }
      bonus -= newColors * 3;
      break;
    }
  }

  // Multiplier par la force de la stratégie
  return Math.round(bonus * (0.5 + strategy.strength));
}

// =============================================================================
// CARTES QUI SUPPORTENT CHAQUE STRATÉGIE
// =============================================================================

/**
 * Retourne les cartes qui supportent une stratégie donnée
 * (pour le debug et l'analyse)
 */
export function getStrategySupportCards(
  strategy: StrategyType,
  cards: Map<string, PlayCard>
): string[] {
  const supportCards: string[] = [];

  for (const [cardId, card] of cards) {
    switch (strategy) {
      case 'shield_pairs':
        // Cartes avec pink/orange, blue/red, ou green/yellow
        if (card.shields.some(s => ['pink', 'orange', 'blue', 'red', 'green', 'yellow'].includes(s.color))) {
          supportCards.push(cardId);
        }
        break;

      case 'shield_trios':
        // Cartes avec blue/green/orange ou pink/red/yellow
        if (card.shields.some(s => ['blue', 'green', 'orange', 'pink', 'red', 'yellow'].includes(s.color))) {
          supportCards.push(cardId);
        }
        break;

      case 'keys':
        // Cartes qui génèrent des clés
        if (card.effects.some(e => e.type.includes('key'))) {
          supportCards.push(cardId);
        }
        break;

      case 'coins':
        // Cartes bourse ou qui remplissent des bourses
        if (card.has_coin_purse || card.effects.some(e => e.type.includes('purse'))) {
          supportCards.push(cardId);
        }
        break;

      case 'reductions':
        if (card.has_price_reduction) {
          supportCards.push(cardId);
        }
        break;

      case 'high_cost':
        if (card.value >= 5) {
          supportCards.push(cardId);
        }
        break;
    }
  }

  return supportCards;
}
