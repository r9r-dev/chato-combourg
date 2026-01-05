/**
 * Calculateur de delta de score
 *
 * Pour chaque coup possible, calcule le gain net de score :
 * delta = scoreApres - scoreAvant - coutsIndirects
 *
 * Cette approche est plus efficace que MCTS pour ce jeu car
 * elle utilise le score exact plutôt qu'une estimation.
 */

import type { PlayPlayer, PlayCard, ShiftDirection } from '../../../../types/play';
import { getValidPlacements, getExternalZones, shiftBoard, getEffectiveCost } from '../../../../types/play';
import { calculateScore, Grid, RULES, KEYS_RULES } from './scoreCalculator';
import { detectStrategy, calculatePotentialBonus } from './strategyDetector';

// =============================================================================
// Contraintes "aucun bouclier X" - ces cartes scorent 0 si un bouclier X existe
// =============================================================================

const NO_SHIELD_CONSTRAINTS: Record<string, { color: string; score: number }> = {
  '026': { color: 'yellow', score: 10 },
  '044': { color: 'orange', score: 10 },
  '064': { color: 'pink', score: 9 },
  '072': { color: 'green', score: 10 },
  '083': { color: 'red', score: 10 },
  '091': { color: 'blue', score: 9 },
};

// =============================================================================
// Contrainte "aucune réduction" - carte 004 score 0 si une carte réduction existe
// =============================================================================

const NO_REDUCTION_CARDS: Record<string, number> = {
  '004': 8, // Conspirateur: 8 pts si aucune carte avec réduction
};

// Contrainte "aucune bourse" - carte 079 score 0 si une carte bourse existe
const NO_PURSE_CARDS: Record<string, number> = {
  '079': 10, // 10 pts si aucune carte avec bourse
};

// =============================================================================
// ANTI-SYNERGIES: cartes qui détruisent la valeur d'autres cartes
// Format: { triggerCard: { victimCard: pointsLost } }
// =============================================================================

// Cartes avec has_price_reduction qui détruisent la carte 004
// Source: card_attributes.json has_price_reduction == true
const PRICE_REDUCTION_CARDS = new Set([
  '005', '012', '021', '024', '026', '028', '031', '032', '033',
  '065', '073', '080', '081', '083', '087',
]);

// =============================================================================
// Cartes dont le scoring DÉPEND d'avoir des boucliers d'une couleur spécifique
// Format: { cardId: { color: couleur_requise, score: points_max_perdus } }
// =============================================================================

// Cartes qui nécessitent PLUSIEURS couleurs (trios, paires)
const CARDS_NEED_MULTIPLE_COLORS: Record<string, { colors: string[]; score: number; type: 'trio' | 'pair' }> = {
  '018': { colors: ['blue', 'green', 'orange'], score: 10, type: 'trio' },
  '054': { colors: ['pink', 'red', 'yellow'], score: 7, type: 'trio' },
  '008': { colors: ['pink', 'orange'], score: 8, type: 'pair' },
  '022': { colors: ['blue', 'red'], score: 8, type: 'pair' },
  '068': { colors: ['green', 'yellow'], score: 8, type: 'pair' },
};

const CARDS_NEED_SHIELD_COLOR: Record<string, { color: string; score: number }> = {
  // Boucliers verts requis
  '002': { color: 'green', score: 5 },   // threshold green in col
  '011': { color: 'green', score: 12 },  // shields in row green × 3
  '033': { color: 'green', score: 12 },  // shields in col green × 3
  '042': { color: 'green', score: 12 },  // shields in row AND col green × 3

  // Boucliers roses requis
  '035': { color: 'pink', score: 5 },    // threshold pink in row
  '037': { color: 'pink', score: 12 },   // shields in col pink × 3
  '062': { color: 'pink', score: 8 },    // shields in row AND col pink × 2
  '086': { color: 'pink', score: 12 },   // shields in row pink × 3

  // Boucliers bleus requis
  '001': { color: 'blue', score: 16 },   // shields in col blue × 4
  '009': { color: 'blue', score: 12 },   // shields in col blue × 3
  '013': { color: 'blue', score: 16 },   // shields in row blue × 4
  '019': { color: 'blue', score: 8 },    // shields in row AND col blue × 2
  '023': { color: 'blue', score: 12 },   // shields in row AND col blue × 3
  '028': { color: 'blue', score: 12 },   // shields in row blue × 3

  // Boucliers rouges requis
  '045': { color: 'red', score: 12 },    // shields in col red × 3
  '065': { color: 'red', score: 12 },    // shields in row AND col red × 3
  '075': { color: 'red', score: 7 },     // threshold red in row

  // Boucliers oranges requis
  '010': { color: 'orange', score: 12 }, // shields in col orange × 3
  '027': { color: 'orange', score: 12 }, // shields in row orange × 3

  // Boucliers jaunes requis
  '034': { color: 'yellow', score: 12 }, // shields in col yellow × 3
  '046': { color: 'yellow', score: 8 },  // shields in row AND col yellow × 2
  '057': { color: 'yellow', score: 12 }, // shields in row yellow × 3
};

// =============================================================================
// Cartes conditionnelles qui ont besoin d'un contexte spécifique pour scorer
// Si le contexte n'est pas rempli, la carte a un mauvais ratio coût/valeur
// =============================================================================

interface ConditionalCardRequirement {
  cardId: string;
  cost: number;           // Coût de la carte
  baseScore: number;      // Score si condition non remplie
  maxScore: number;       // Score maximum si condition parfaite
  requirement: string;    // Description de la condition
  checkFunction: (player: PlayPlayer, cards: Map<string, PlayCard>) => number;
}

const CONDITIONAL_CARDS: ConditionalCardRequirement[] = [
  {
    cardId: '020',
    cost: 7,
    baseScore: 0,
    maxScore: 30, // Théorique avec plein de bourses remplies
    requirement: 'pièces sur bourses',
    checkFunction: (player, _cards) => {
      // Compte le total des pièces sur les bourses existantes
      let total = 0;
      for (const placed of player.board) {
        if (placed && placed.coinsOnCard > 0) {
          total += placed.coinsOnCard;
        }
      }
      return total;
    },
  },
];

// Cartes bourse (leur règle dépend des pièces sur la carte)
const COIN_PURSE_CARDS = new Set([
  '014', '025', '036', '041', '050', '051', '053', '058', '059', '061', '081'
]);

// Cartes avec effet fill_purses (remplissent d'autres bourses)
const FILL_PURSE_EFFECT_CARDS = new Set([
  '014', // fill_purses_select (2 cartes)
  '020', // choice: fill_purses(2) ou gain_gold_per_village
  '059', // fill_purses(2)
  '082', // fill_purses(1)
]);

// =============================================================================
// CARTES À HAUT POTENTIEL DE SCALING
// Ces cartes ont un multiplier >= 3 dans leur scoring_rule et gagnent de la
// valeur avec le nombre de cartes posées. Bonus en early/mid game.
// =============================================================================

const HIGH_SCALING_CARDS: Record<string, number> = {
  // Multiplier x10
  '018': 10,  // shield_trios blue/green/orange
  // Multiplier x7
  '054': 7,   // shield_trios pink/red/yellow
  '069': 7,   // category_sets village x3
  // Multiplier x6
  '027': 6,   // shield_sets_on_board set_size=3
  '038': 6,   // missing_colors_on_board
  // Multiplier x5
  '039': 5,   // min_value_count >= 5
  // Multiplier x4
  '001': 4,   // shields_in_col blue
  '005': 4,   // unique_colors row
  '008': 4,   // shield_pairs pink/orange
  '013': 4,   // shields_in_row blue
  '022': 4,   // shield_pairs blue/red
  '029': 4,   // unique_colors col
  '032': 4,   // feature_count price_reduction
  '068': 4,   // shield_pairs green/yellow
  '070': 4,   // feature_count lock
  // Multiplier x3 (cartes importantes)
  '010': 3,   // unique_values_on_board
  '016': 3,   // category_pairs castle/village
};

// =============================================================================
// BILAN BOURSES GLOBAL
// Calcule le déficit entre capacité des bourses et or disponible en fin de partie
// =============================================================================

interface PurseBudget {
  totalCapacity: number;      // Capacité totale des bourses
  currentCoins: number;       // Pièces déjà sur les bourses
  emptySlots: number;         // Slots vides à remplir
  estimatedFinalGold: number; // Or estimé en fin de partie
  deficit: number;            // Déficit = emptySlots - estimatedFinalGold (si > 0, bourses vides)
  surplus: number;            // Surplus = estimatedFinalGold - emptySlots (si > 0, or perdu)
  effectiveGoldGeneration: number; // Or généré par les effets des cartes
}

/**
 * Calcule le bilan bourses global pour un joueur.
 *
 * Prend en compte :
 * - Capacité totale des bourses sur le plateau
 * - Or actuel et coût de l'achat
 * - Tours restants et dépenses estimées
 * - Effets de génération d'or des cartes posées
 */
function calculatePurseBudget(
  player: PlayPlayer,
  goldAfterBuy: number,
  turnsRemaining: number,
  newPurseCard: PlayCard | null,
  cards: Map<string, PlayCard>
): PurseBudget {
  let totalCapacity = 0;
  let currentCoins = 0;
  let effectiveGoldGeneration = 0;

  // Compter les bourses existantes
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (!card) continue;

    if (card.has_coin_purse) {
      totalCapacity += card.max_coins;
      currentCoins += placed.coinsOnCard;
    }

    // Estimer la génération d'or par les effets des cartes placées
    // (ces effets se déclenchent quand on place d'autres cartes)
    for (const effect of card.effects) {
      switch (effect.type) {
        case 'gain_gold':
          // Effet one-shot déjà appliqué
          break;
        case 'gain_gold_per_village':
        case 'gain_gold_per_castle':
        case 'gain_gold_per_card':
          // Ces effets génèrent de l'or à chaque tour
          effectiveGoldGeneration += (effect.amount ?? 1) * 0.5; // Estimation moyenne
          break;
        case 'fill_purses':
          // Remplit les bourses directement (pas l'or du joueur)
          // Mais on peut compter ça comme de l'or effectif pour les bourses
          effectiveGoldGeneration += (effect.amount ?? 2);
          break;
      }
    }
  }

  // Ajouter la nouvelle bourse si applicable
  if (newPurseCard?.has_coin_purse) {
    totalCapacity += newPurseCard.max_coins;
  }

  const emptySlots = totalCapacity - currentCoins;

  // Estimation de l'or en fin de partie
  // Plus conservatrice : on dépense en moyenne 3-4 or par tour (cartes moins chères en fin de partie)
  // MAIS on gagne aussi de l'or via les effets
  const avgCostPerTurn = 3.5;
  const estimatedSpending = turnsRemaining * avgCostPerTurn;
  const estimatedGoldFromEffects = effectiveGoldGeneration * turnsRemaining;
  const estimatedFinalGold = Math.max(0, goldAfterBuy - estimatedSpending + estimatedGoldFromEffects);

  const deficit = Math.max(0, emptySlots - estimatedFinalGold);
  const surplus = Math.max(0, estimatedFinalGold - emptySlots);

  return {
    totalCapacity,
    currentCoins,
    emptySlots,
    estimatedFinalGold,
    deficit,
    surplus,
    effectiveGoldGeneration,
  };
}

/**
 * Calcule la pénalité pour un déficit de bourses.
 *
 * Si on a beaucoup de bourses vides et pas assez d'or pour les remplir,
 * c'est une catastrophe car chaque slot vide = 2 points perdus.
 */
function calculatePurseDeficitPenalty(budget: PurseBudget): number {
  if (budget.deficit <= 0) return 0;

  // Chaque slot de bourse vide = 2 points perdus (règle du jeu)
  // Pénalité proportionnelle au déficit
  let penalty = budget.deficit * 2;

  // Malus supplémentaire si le déficit est énorme (signe de mauvaise stratégie)
  if (budget.deficit > 10) {
    penalty += (budget.deficit - 10) * 0.5;
  }

  return penalty;
}

// Cartes avec contraintes de position et leurs positions optimales
const POSITION_CONSTRAINTS: Record<string, { positions: number[]; score: number }> = {
  '003': { positions: [0, 1, 2], score: 8 },       // top_row
  '007': { positions: [6, 7, 8], score: 5 },       // bottom_row
  '021': { positions: [0, 3, 6], score: 8 },       // left_col
  '030': { positions: [0, 3, 6], score: 6 },       // left_col
  '031': { positions: [2, 5, 8], score: 8 },       // right_col
  '047': { positions: [0, 1, 2], score: 5 },       // top_row
  '049': { positions: [2, 5, 8], score: 5 },       // right_col
  '052': { positions: [1, 4, 7], score: 6 },       // middle_col
  '063': { positions: [6, 7, 8], score: 7 },       // bottom_row
  '071': { positions: [3, 4, 5], score: 5 },       // middle_row
};

/**
 * Calcule la pénalité TOTALE pour les anti-synergies
 *
 * Inclut:
 * 1. Contraintes "no shield X" (ex: carte 064 détruite par bouclier rose)
 * 2. Contraintes "no reduction" (ex: carte 004 détruite par carte réduction)
 * 3. Cartes conditionnelles avec mauvais ratio coût/valeur
 */
function calculateAntiSynergyPenalty(
  player: PlayPlayer,
  newCardId: string,
  cards: Map<string, PlayCard>
): { penalty: number; reasons: string[] } {
  const newCard = cards.get(newCardId);
  if (!newCard) return { penalty: 0, reasons: [] };

  let penalty = 0;
  const reasons: string[] = [];

  // ==========================================================================
  // 1. Vérifier si la nouvelle carte DÉTRUIT une contrainte "no shield"
  // ==========================================================================
  const newColors = new Set<string>();
  for (const shield of newCard.shields) {
    newColors.add(shield.color);
  }

  for (const placed of player.board) {
    if (!placed) continue;

    const constraint = NO_SHIELD_CONSTRAINTS[placed.cardId];
    if (!constraint) continue;

    // Si la nouvelle carte a la couleur interdite par cette contrainte
    if (newColors.has(constraint.color)) {
      // Vérifier si le plateau actuel respecte la contrainte
      const boardHasColor = player.board.some(p => {
        if (!p) return false;
        const card = cards.get(p.cardId);
        return card?.shields.some(s => s.color === constraint.color);
      });

      // Si la contrainte était respectée, la casser = pénalité FORTE (1.5x le score)
      if (!boardHasColor) {
        const penaltyAmount = Math.ceil(constraint.score * 1.5);
        penalty += penaltyAmount;
        reasons.push(`Détruit ${placed.cardId} (${penaltyAmount} pts): bouclier ${constraint.color}`);
      }
    }
  }

  // ==========================================================================
  // 2. Vérifier si la nouvelle carte DÉTRUIT une contrainte "no reduction"
  // ==========================================================================
  if (PRICE_REDUCTION_CARDS.has(newCardId) || newCard.has_price_reduction) {
    for (const placed of player.board) {
      if (!placed) continue;

      const reductionPenalty = NO_REDUCTION_CARDS[placed.cardId];
      if (!reductionPenalty) continue;

      // Vérifier si le plateau actuel respecte la contrainte (pas de réduction)
      const boardHasReduction = player.board.some(p => {
        if (!p) return false;
        const card = cards.get(p.cardId);
        return card?.has_price_reduction || PRICE_REDUCTION_CARDS.has(p.cardId);
      });

      if (!boardHasReduction) {
        penalty += reductionPenalty;
        reasons.push(`Détruit ${placed.cardId} (${reductionPenalty} pts): carte avec réduction`);
      }
    }
  }

  // ==========================================================================
  // 3. Vérifier si la nouvelle carte est ELLE-MÊME une carte "no shield"
  //    et si le plateau actuel viole DÉJÀ sa contrainte
  // ==========================================================================
  const newCardConstraint = NO_SHIELD_CONSTRAINTS[newCardId];
  if (newCardConstraint) {
    const boardHasColor = player.board.some(p => {
      if (!p) return false;
      const card = cards.get(p.cardId);
      return card?.shields.some(s => s.color === newCardConstraint.color);
    });

    if (boardHasColor) {
      // La contrainte est DÉJÀ violée, cette carte ne scorera que 0
      // Pénalité forte (1.5x) car c'est une erreur majeure
      const penaltyAmount = Math.ceil(newCardConstraint.score * 1.5);
      penalty += penaltyAmount;
      reasons.push(`${newCardId} ne scorera pas: bouclier ${newCardConstraint.color} déjà présent`);
    }
  }

  // ==========================================================================
  // 4. Vérifier si la nouvelle carte est "no reduction" (004)
  //    et si le plateau a déjà une carte réduction
  // ==========================================================================
  const newCardReductionPenalty = NO_REDUCTION_CARDS[newCardId];
  if (newCardReductionPenalty) {
    const boardHasReduction = player.board.some(p => {
      if (!p) return false;
      const card = cards.get(p.cardId);
      return card?.has_price_reduction || PRICE_REDUCTION_CARDS.has(p.cardId);
    });

    if (boardHasReduction) {
      penalty += newCardReductionPenalty;
      reasons.push(`${newCardId} ne scorera pas: réduction déjà présente`);
    }
  }

  // ==========================================================================
  // 5. Carte 056 ("Roi des gueux"): 12 pts si AUCUNE carte retournée
  //    Ne pas acheter 056 si on a déjà une carte retournée !
  // ==========================================================================
  if (newCardId === '056') {
    const hasFlippedCard = player.board.some(p => p?.cardId === '089' || p?.cardId === '090');
    if (hasFlippedCard) {
      // Pénalité très forte (1.5x 12 = 18) car c'est une erreur catastrophique
      penalty += 18;
      reasons.push(`056 ne scorera pas: carte retournée déjà présente`);
    }
    // Conflit avec 082 qui NÉCESSITE des cartes retournées
    const has082 = player.board.some(p => p?.cardId === '082');
    if (has082) {
      penalty += 8; // 082 perdra ses 8 pts
      reasons.push(`056 + 082 conflit: 082 nécessite des retournées`);
    }
  }

  // ==========================================================================
  // 5a. Carte 082 ("Charpentier"): 8 pts si AU MOINS UNE carte retournée
  //     Ne pas acheter 082 si on a 056 (conflit) ou si on évite les retournées
  // ==========================================================================
  if (newCardId === '082') {
    const has056 = player.board.some(p => p?.cardId === '056');
    const hasFlippedCard = player.board.some(p => p?.cardId === '089' || p?.cardId === '090');
    const placedCount = player.board.filter(p => p !== null).length;
    const turnsRemaining = 9 - placedCount;

    if (has056) {
      // Conflit direct: 056 interdit les retournées, 082 les nécessite
      penalty += 12; // 082 perdra 8 pts ET on compromet 056
      reasons.push(`082 + 056 conflit: impossible de scorer les deux`);
    } else if (!hasFlippedCard && turnsRemaining <= 2) {
      // Fin de partie sans carte retournée = 082 ne scorera pas
      penalty += 8;
      reasons.push(`082 ne scorera pas: pas de carte retournée en fin de partie`);
    } else if (!hasFlippedCard) {
      // Pas de retournée mais il reste du temps - risque modéré
      penalty += 3;
      reasons.push(`082 risque de ne pas scorer sans retournée`);
    }
  }

  // ==========================================================================
  // 5b. CONFLIT no_shield_color vs cards_need_shield_color
  //     Ex: 072 (no green) + 042 (needs green) = CATASTROPHE
  // ==========================================================================

  // D'abord, collecter les couleurs INTERDITES par les cartes "no_shield" sur le plateau
  const forbiddenColors = new Map<string, number>(); // color -> points perdus si on ajoute cette couleur
  for (const placed of player.board) {
    if (!placed) continue;
    const constraint = NO_SHIELD_CONSTRAINTS[placed.cardId];
    if (constraint) {
      // Vérifier si la contrainte est ENCORE respectée (pas déjà violée)
      const boardHasColor = player.board.some(p => {
        if (!p) return false;
        const card = cards.get(p.cardId);
        return card?.shields.some(s => s.color === constraint.color);
      });
      if (!boardHasColor) {
        // Contrainte active: cette couleur est interdite
        const existing = forbiddenColors.get(constraint.color) ?? 0;
        forbiddenColors.set(constraint.color, existing + constraint.score);
      }
    }
  }

  // Si la nouvelle carte NÉCESSITE une couleur interdite, pénalité
  const needsColor = CARDS_NEED_SHIELD_COLOR[newCardId];
  if (needsColor && forbiddenColors.has(needsColor.color)) {
    // Cette carte ne pourra JAMAIS scorer car on ne peut pas ajouter sa couleur
    penalty += needsColor.score;
    reasons.push(`${newCardId} ne scorera pas: ${needsColor.color} interdit par carte no_shield`);
  }

  // ==========================================================================
  // 5c. Si la carte nécessite une couleur ABSENTE du plateau, pénalité
  //     (même sans contrainte "no_shield", si la couleur n'existe pas c'est risqué)
  // ==========================================================================
  if (needsColor) {
    // Compter les boucliers de cette couleur sur le plateau
    let colorCount = 0;
    for (const placed of player.board) {
      if (!placed) continue;
      const card = cards.get(placed.cardId);
      if (card) {
        for (const shield of card.shields) {
          if (shield.color === needsColor.color) {
            colorCount += shield.count;
          }
        }
      }
    }

    const placedCount = player.board.filter(p => p !== null).length;
    const turnsRemaining = 9 - placedCount;

    // Si aucun bouclier de cette couleur et peu de tours restants
    if (colorCount === 0) {
      if (turnsRemaining <= 2) {
        // Peu de chances d'ajouter la couleur
        penalty += Math.ceil(needsColor.score * 0.8);
        reasons.push(`${newCardId} risque fort: aucun ${needsColor.color} et fin de partie`);
      } else if (turnsRemaining <= 4) {
        // Risque modéré
        penalty += Math.ceil(needsColor.score * 0.4);
        reasons.push(`${newCardId} risque: aucun ${needsColor.color} sur le plateau`);
      }
    } else if (colorCount === 1 && turnsRemaining <= 3) {
      // Un seul bouclier, difficile de scorer beaucoup
      penalty += Math.ceil(needsColor.score * 0.2);
      reasons.push(`${newCardId} risque: seulement 1 ${needsColor.color}`);
    }
  }

  // ==========================================================================
  // 5d. Cartes qui nécessitent PLUSIEURS couleurs (trios, paires)
  // ==========================================================================
  const multiColorCard = CARDS_NEED_MULTIPLE_COLORS[newCardId];
  if (multiColorCard) {
    // Compter les couleurs présentes sur le plateau
    const colorsOnBoard = new Set<string>();
    for (const placed of player.board) {
      if (!placed) continue;
      const card = cards.get(placed.cardId);
      if (card) {
        for (const shield of card.shields) {
          colorsOnBoard.add(shield.color);
        }
      }
    }

    // Compter combien des couleurs requises sont absentes
    const missingColors = multiColorCard.colors.filter(c => !colorsOnBoard.has(c));
    const placedCount = player.board.filter(p => p !== null).length;
    const turnsRemaining = 9 - placedCount;

    if (missingColors.length >= 2 && turnsRemaining <= 3) {
      // Il manque 2+ couleurs et peu de tours → impossible de scorer
      penalty += multiColorCard.score;
      reasons.push(`${newCardId} ne scorera pas: manque ${missingColors.join(', ')}`);
    } else if (missingColors.length >= 2) {
      // Risque élevé
      penalty += Math.ceil(multiColorCard.score * 0.6);
      reasons.push(`${newCardId} risque: manque ${missingColors.join(', ')}`);
    } else if (missingColors.length === 1 && turnsRemaining <= 2) {
      // Manque 1 couleur en fin de partie
      penalty += Math.ceil(multiColorCard.score * 0.4);
      reasons.push(`${newCardId} risque: manque ${missingColors[0]} en fin de partie`);
    }
  }

  // Inversement: si la nouvelle carte est "no_shield X", vérifier si on a des cartes
  // qui NÉCESSITENT la couleur X
  const newCardConstraint2 = NO_SHIELD_CONSTRAINTS[newCardId];
  if (newCardConstraint2) {
    for (const placed of player.board) {
      if (!placed) continue;
      const needsThisColor = CARDS_NEED_SHIELD_COLOR[placed.cardId];
      if (needsThisColor && needsThisColor.color === newCardConstraint2.color) {
        // On a une carte qui a BESOIN de cette couleur, mais on achète une carte
        // qui INTERDIT cette couleur → les deux cartes vont mal scorer
        penalty += needsThisColor.score;
        reasons.push(`${placed.cardId} ne scorera plus: ${newCardId} interdit ${needsThisColor.color}`);
      }
    }
  }

  // ==========================================================================
  // 6. Contrainte "aucune bourse" - carte 079 (10 pts si aucune bourse)
  // ==========================================================================

  // Si on achète une carte bourse et qu'on a déjà 079 sur le plateau
  if (newCard.has_coin_purse) {
    for (const placed of player.board) {
      if (!placed) continue;
      const pursePenalty = NO_PURSE_CARDS[placed.cardId];
      if (pursePenalty) {
        // Vérifier si le plateau actuel respecte la contrainte (pas de bourse)
        const boardHasPurse = player.board.some(p => {
          if (!p) return false;
          const card = cards.get(p.cardId);
          return card?.has_coin_purse;
        });
        if (!boardHasPurse) {
          penalty += pursePenalty;
          reasons.push(`Détruit ${placed.cardId} (${pursePenalty} pts): carte avec bourse`);
        }
      }
    }
  }

  // Si on achète 079 et qu'il y a déjà une bourse sur le plateau
  const newCardPursePenalty = NO_PURSE_CARDS[newCardId];
  if (newCardPursePenalty) {
    const boardHasPurse = player.board.some(p => {
      if (!p) return false;
      const card = cards.get(p.cardId);
      return card?.has_coin_purse;
    });
    if (boardHasPurse) {
      penalty += newCardPursePenalty;
      reasons.push(`${newCardId} ne scorera pas: bourse déjà présente`);
    }
  }

  // ==========================================================================
  // 5. Vérifier les cartes conditionnelles (mauvais ratio coût/valeur)
  // ==========================================================================
  const conditional = CONDITIONAL_CARDS.find(c => c.cardId === newCardId);
  if (conditional) {
    const expectedScore = conditional.checkFunction(player, cards);
    const effectiveCost = getEffectiveCost(
      conditional.cost,
      newCard.category,
      player.reductionCastle,
      player.reductionVillage
    );

    // Si le score attendu est très inférieur au coût, c'est une mauvaise affaire
    if (expectedScore < effectiveCost) {
      const lostValue = effectiveCost - expectedScore;
      penalty += lostValue;
      reasons.push(`${newCardId} coûte ${effectiveCost} mais ne rapporte que ~${expectedScore} pts`);
    }
  }

  return { penalty, reasons };
}

/**
 * Vérifie si le joueur possède une carte avec contrainte "no shield"
 * et retourne les couleurs à éviter avec leur pénalité
 */
export function getActiveConstraints(
  player: PlayPlayer,
  cards: Map<string, PlayCard>
): Map<string, number> {
  const constraints = new Map<string, number>();

  for (const placed of player.board) {
    if (!placed) continue;

    const constraint = NO_SHIELD_CONSTRAINTS[placed.cardId];
    if (!constraint) continue;

    // Vérifier si la contrainte est actuellement respectée
    const boardHasColor = player.board.some(p => {
      if (!p) return false;
      const card = cards.get(p.cardId);
      return card?.shields.some(s => s.color === constraint.color);
    });

    if (!boardHasColor) {
      // La contrainte est active, ajouter la pénalité
      const existing = constraints.get(constraint.color) ?? 0;
      constraints.set(constraint.color, existing + constraint.score);
    }
  }

  return constraints;
}

export interface BuyOption {
  cardId: string;
  flipped: boolean;
  cost: number; // Or dépensé
  goldGained: number; // Or gagné (si retourné)
  keysGained: number; // Clés gagnées (si retourné)
  keysCost: number; // Coût en clés (messager)
  hasMessenger: boolean;
}

export interface PlaceOption {
  position: number;
  deltaScore: number; // Changement de score net
  newScore: number; // Score après placement
  shiftDirection?: ShiftDirection; // Direction du shift (pour zones externes)
}

export interface MoveEvaluation {
  buyOption: BuyOption;
  placeOption: PlaceOption;
  totalDelta: number; // Delta total incluant tous les coûts
  reasoning: string;
}

/**
 * Évalue toutes les options d'achat disponibles
 */
export function evaluateBuyOptions(
  player: PlayPlayer,
  availableCards: string[],
  _messengerLocation: 'castle' | 'village',
  cards: Map<string, PlayCard>
): BuyOption[] {
  const options: BuyOption[] = [];

  for (const cardId of availableCards) {
    const card = cards.get(cardId);
    if (!card) continue;

    // Coût effectif avec réductions
    const cost = getEffectiveCost(
      card.value,
      card.category,
      player.reductionCastle,
      player.reductionVillage
    );

    // Option achat normal (si assez d'or)
    if (player.gold >= cost) {
      options.push({
        cardId,
        flipped: false,
        cost,
        goldGained: 0,
        keysGained: 0,
        keysCost: 0,
        hasMessenger: card.has_messenger,
      });
    }

    // Option achat retourné (toujours possible)
    options.push({
      cardId,
      flipped: true,
      cost: 0,
      goldGained: 6,
      keysGained: 2,
      keysCost: 0,
      hasMessenger: false,
    });
  }

  return options;
}

/**
 * Calcule le score actuel basé sur les règles de toutes les cartes placées.
 *
 * Même pour un plateau partiel, on calcule le score réel de chaque carte
 * en fonction de l'état actuel. Cela permet de détecter correctement les
 * violations de contraintes (ex: "no pink" qui passe de 9 à 0).
 */
function calculateRulesScore(
  cardIds: string[],
  keys: number,
  coinsOnCards: Map<string, number>,
  cards: Map<string, PlayCard>
): number {
  const placedCount = cardIds.filter(c => c !== '').length;

  if (placedCount === 9) {
    // Plateau complet : score exact
    const result = calculateScore(cardIds, keys, coinsOnCards, cards);
    return result.totalScore;
  }

  if (placedCount === 0) {
    return keys;
  }

  // Plateau partiel : calculer le score réel de chaque carte placée
  // en utilisant les règles sur l'état actuel du plateau
  const grid = new Grid(cardIds, coinsOnCards, cards);
  let score = 0;

  for (let position = 0; position < 9; position++) {
    const cardId = cardIds[position];
    if (!cardId) continue;

    const rule = RULES[cardId];
    if (rule) {
      if (KEYS_RULES.has(cardId)) {
        score += rule(grid, position, keys);
      } else {
        score += rule(grid, position);
      }
    }
  }

  // Ajouter les clés et pièces
  score += keys;
  for (const coins of coinsOnCards.values()) {
    score += coins;
  }

  return score;
}

/**
 * Évalue toutes les positions de placement pour une carte
 *
 * IMPORTANT: Calcule le vrai delta de score (score après - score avant)
 * pour détecter correctement les violations de contraintes comme "no shield".
 */
export function evaluatePlaceOptions(
  player: PlayPlayer,
  cardId: string,
  keys: number,
  coinsOnCards: Map<string, number>,
  cards: Map<string, PlayCard>
): PlaceOption[] {
  const validPositions = getValidPlacements(player.board);
  const options: PlaceOption[] = [];

  // État actuel du plateau
  const currentCards = player.board.map(p => p?.cardId ?? '');

  // Calculer le score actuel AVANT placement
  const currentScore = calculateRulesScore(currentCards, keys, coinsOnCards, cards);

  for (const position of validPositions) {
    // Créer le plateau APRÈS placement
    const newCards = [...currentCards];
    newCards[position] = cardId;

    // Calculer le score APRÈS placement
    const newScore = calculateRulesScore(newCards, keys, coinsOnCards, cards);

    // Delta = différence réelle de score
    const deltaScore = newScore - currentScore;

    // Bonus pour positions stratégiques (seulement si le delta n'est pas négatif)
    let positionBonus = 0;
    if (deltaScore >= 0) {
      // Bonus pour le centre (plus de synergies possibles)
      // MAIS seulement si on a déjà plusieurs cartes (le centre n'existe pas au tour 1)
      const placedCount = currentCards.filter(c => c !== '').length;
      if (position === 4 && placedCount >= 4) positionBonus += 1;

      // Bonus pour compléter ligne/colonne
      const row = Math.floor(position / 3);
      const col = position % 3;
      const rowPositions = [row * 3, row * 3 + 1, row * 3 + 2].filter(p => p !== position);
      const colPositions = [col, col + 3, col + 6].filter(p => p !== position);

      const rowOccupied = rowPositions.filter(p => currentCards[p] !== '').length;
      const colOccupied = colPositions.filter(p => currentCards[p] !== '').length;

      if (rowOccupied === 2) positionBonus += 2; // Complete une ligne
      if (colOccupied === 2) positionBonus += 2; // Complete une colonne
    }

    options.push({
      position,
      deltaScore: deltaScore + positionBonus,
      newScore: newScore + positionBonus,
    });
  }

  // Évaluer les zones externes (placement avec shift)
  const externalZones = getExternalZones(player.board);
  for (const zone of externalZones) {
    // Simuler le shift d'abord
    const shiftedBoard = shiftBoard(player.board, zone.shiftDirection);
    const shiftedCards = shiftedBoard.map(p => p?.cardId ?? '');

    // Placer la carte à la position (maintenant vide après shift)
    const newCards = [...shiftedCards];
    newCards[zone.position] = cardId;

    // Calculer le score APRÈS shift + placement
    const newScore = calculateRulesScore(newCards, keys, coinsOnCards, cards);

    // Delta = différence réelle de score
    const deltaScore = newScore - currentScore;

    // Bonus pour positions stratégiques après shift
    let positionBonus = 0;
    if (deltaScore >= 0) {
      const placedCount = shiftedCards.filter(c => c !== '').length;
      if (zone.position === 4 && placedCount >= 4) positionBonus += 1;

      const row = Math.floor(zone.position / 3);
      const col = zone.position % 3;
      const rowPositions = [row * 3, row * 3 + 1, row * 3 + 2].filter(p => p !== zone.position);
      const colPositions = [col, col + 3, col + 6].filter(p => p !== zone.position);

      const rowOccupied = rowPositions.filter(p => shiftedCards[p] !== '').length;
      const colOccupied = colPositions.filter(p => shiftedCards[p] !== '').length;

      if (rowOccupied === 2) positionBonus += 2;
      if (colOccupied === 2) positionBonus += 2;
    }

    options.push({
      position: zone.position,
      deltaScore: deltaScore + positionBonus,
      newScore: newScore + positionBonus,
      shiftDirection: zone.shiftDirection,
    });
  }

  // Trier par delta décroissant
  options.sort((a, b) => b.deltaScore - a.deltaScore);

  return options;
}

/**
 * Évalue le meilleur coup complet (achat + placement)
 */
export function evaluateBestMove(
  player: PlayPlayer,
  availableCards: string[],
  messengerLocation: 'castle' | 'village',
  cards: Map<string, PlayCard>,
  turnNumber: number = 1
): MoveEvaluation | null {
  const buyOptions = evaluateBuyOptions(player, availableCards, messengerLocation, cards);

  if (buyOptions.length === 0) return null;

  let bestMove: MoveEvaluation | null = null;
  let bestDelta = -Infinity;

  // Calculer les pièces sur cartes
  const coinsOnCards = new Map<string, number>();
  for (const placed of player.board) {
    if (placed && placed.coinsOnCard > 0) {
      coinsOnCards.set(placed.cardId, placed.coinsOnCard);
    }
  }

  // Détecter la stratégie en cours
  const detectedStrategy = detectStrategy(player, cards);

  for (const buyOption of buyOptions) {
    // Déterminer l'ID de la carte réellement placée
    const placedCardId = buyOption.flipped
      ? (cards.get(buyOption.cardId)?.category === 'village' ? '089' : '090')
      : buyOption.cardId;

    // Calculer les clés après achat
    const keysAfterBuy = player.keys + buyOption.keysGained - buyOption.keysCost;

    // Évaluer les positions (le delta inclut automatiquement les pénalités de contraintes)
    const placeOptions = evaluatePlaceOptions(
      player,
      placedCardId,
      keysAfterBuy,
      coinsOnCards,
      cards
    );

    if (placeOptions.length === 0) continue;

    const bestPlace = placeOptions[0]; // Déjà trié par delta

    // Calculer la valeur des clés
    // Cartes 017 et 066 donnent 2 points par clé en fin de partie
    const keyCardCount = player.board.filter(
      p => p?.cardId === '017' || p?.cardId === '066'
    ).length;

    // Calculer le bonus/malus économique
    let economyBonus = 0;
    const placedCount = player.board.filter(p => p !== null).length;
    const turnsRemaining = 9 - placedCount - 1;

    if (buyOption.flipped) {
      // Une carte retournée (089/090) ne donne pas de points directement.
      // MAIS si on a la carte 056 (12 pts si aucune carte retournée),
      // alors retourner = perdre ces 12 points !

      // Valeur des clés (2 pts/clé si on a cartes clé)
      const keyPointValue = keyCardCount > 0 ? 2 * keyCardCount : 0;
      economyBonus += buyOption.keysGained * keyPointValue;

      // L'or a peu de valeur car on ne peut pas acheter avec
      economyBonus += buyOption.goldGained * 0.1;

      // Vérifier si le joueur a la carte 056 ou pourrait l'avoir
      const has056 = player.board.some(p => p?.cardId === '056');
      const alreadyHasFlipped = player.board.some(p => p?.cardId === '089' || p?.cardId === '090');

      if (has056 && !alreadyHasFlipped) {
        // On a 056 et pas encore de carte retournée → retourner = -18 points !
        // (1.5x la valeur de 056 pour être très dissuasif)
        economyBonus -= 18;
      } else if (!has056 && turnsRemaining > 3) {
        // On pourrait encore acheter 056 plus tard → malus préventif FORT
        // Une carte retournée empêche d'acheter 056 (12 pts perdus)
        economyBonus -= 10;
      } else {
        // Déjà une carte retournée ou fin de partie sans 056
        // Pas de malus supplémentaire, juste le coût d'opportunité
        economyBonus -= 2;
      }

      // Une carte normale rapporte généralement 5-10 pts
      // Retourner = perdre cette opportunité
      economyBonus -= 5;
    } else {
      // Acheter une vraie carte - presque toujours mieux que retourner
      // Bonus modéré pour cartes chères (la contribution le gère déjà)

      if (buyOption.cost >= 6) {
        economyBonus += 2; // Petit bonus pour cartes chères
      }

      // =========================================================================
      // BONUS RÉDUCTION EARLY GAME
      // Les cartes avec réduction sont sous-évaluées car leur effet n'est pas
      // immédiat. Mais elles permettent d'acheter des cartes plus chères ensuite.
      // Analyse des parties <40pts: les high scorers achètent ces cartes tôt.
      // =========================================================================
      const card = cards.get(buyOption.cardId);
      if (card?.has_price_reduction && turnNumber <= 4) {
        // Bonus dégressif: +6 tour 1, +4.5 tour 2, +3 tour 3, +1.5 tour 4
        const reductionEarlyBonus = (5 - turnNumber) * 1.5;
        economyBonus += reductionEarlyBonus;
      }

      // =========================================================================
      // MALUS CARTES CHÈRES SANS RÉDUCTION EN EARLY GAME
      // Analyse des parties <40pts: les low scorers achètent des cartes à 5-6 or
      // sans réduction au tour 1-3, ce qui bloque leurs ressources.
      // =========================================================================
      if (turnNumber <= 3 && buyOption.cost >= 5 && !card?.has_price_reduction) {
        // Malus proportionnel au coût: -1 pour 5 or, -2 pour 6 or, etc.
        const expensiveEarlyMalus = (buyOption.cost - 4) * 1.0;
        economyBonus -= expensiveEarlyMalus;
      }

      // =========================================================================
      // BONUS SCALING POUR CARTES À HAUT MULTIPLICATEUR
      // DÉSACTIVÉ: Les tests montrent que ce bonus dégrade les performances.
      // Hypothèse: ces cartes sont contextuelles et leur valeur dépend des
      // autres cartes disponibles, pas d'un bonus fixe.
      // =========================================================================
      // const scalingMultiplier = HIGH_SCALING_CARDS[buyOption.cardId];
      // if (scalingMultiplier && turnNumber <= 4) {
      //   const scalingBonus = (scalingMultiplier - 2) * 0.3 * (5 - turnNumber);
      //   economyBonus += scalingBonus;
      // }

      // Malus si on épuise tout l'or trop tôt
      const goldAfterBuy = player.gold - buyOption.cost;
      if (goldAfterBuy < 4 && turnsRemaining > 4) {
        economyBonus -= 1;
      }

      // =======================================================================
      // PROTECTION 056: Ne JAMAIS tomber à 0 or si on a 056 !
      // Sinon on sera FORCÉ de retourner une carte et perdre 12 pts
      // =======================================================================
      const has056 = player.board.some(p => p?.cardId === '056');
      const alreadyHasFlipped = player.board.some(p => p?.cardId === '089' || p?.cardId === '090');

      if (has056 && !alreadyHasFlipped && turnsRemaining > 0) {
        // Vérifier si on va tomber à risque de banqueroute
        if (goldAfterBuy <= 0) {
          // CATASTROPHE: on sera forcé de retourner une carte au prochain tour
          economyBonus -= 20;
        } else if (goldAfterBuy < 3 && turnsRemaining > 2) {
          // RISQUE: on a très peu d'or, danger de devoir retourner
          economyBonus -= 8;
        } else if (goldAfterBuy < 5 && turnsRemaining > 3) {
          // PRÉCAUTION: garder une marge de sécurité
          economyBonus -= 3;
        }
      }

      // =========================================================================
      // BILAN BOURSES GLOBAL
      // Utilise le nouveau système de calcul de déficit pour évaluer
      // l'impact de l'achat sur les bourses en fin de partie
      // =========================================================================
      const goldAfterBuyCalc = player.gold - buyOption.cost;
      const cardBeingBought = cards.get(buyOption.cardId);
      const newPurseCard = COIN_PURSE_CARDS.has(buyOption.cardId) ? cardBeingBought : null;

      const purseBudget = calculatePurseBudget(
        player,
        goldAfterBuyCalc,
        turnsRemaining,
        newPurseCard ?? null,
        cards
      );

      // Pénalité pour déficit de bourses (bourses vides en fin de partie)
      const purseDeficitPenalty = calculatePurseDeficitPenalty(purseBudget);
      if (purseDeficitPenalty > 0) {
        economyBonus -= purseDeficitPenalty;
      }

      // Bonus si on a un surplus d'or (on pourrait stocker plus)
      // et qu'on achète une bourse qui peut l'absorber
      if (purseBudget.surplus > 0 && newPurseCard?.has_coin_purse) {
        const maxCoins = newPurseCard.max_coins;
        const goldThisPurseCanAbsorb = Math.min(maxCoins, purseBudget.surplus);
        // Chaque pièce stockée = 2 pts (règle du jeu)
        economyBonus += goldThisPurseCanAbsorb * 2;
      }

      // Pénalité FORTE si on achète une bourse alors qu'on a déjà un déficit
      if (COIN_PURSE_CARDS.has(buyOption.cardId) && purseBudget.deficit > 5) {
        // Acheter une bourse quand on n'a pas d'or = mauvaise idée
        // La nouvelle bourse ne sera pas remplie non plus
        economyBonus -= purseBudget.deficit * 0.5;
      }

      // Bonus si la carte a un effet fill_purses et qu'il y a des bourses vides
      if (FILL_PURSE_EFFECT_CARDS.has(buyOption.cardId)) {
        // Compter les bourses existantes vides
        let existingEmptySlots = 0;
        for (const placed of player.board) {
          if (!placed) continue;
          const placedCard = cards.get(placed.cardId);
          if (placedCard?.has_coin_purse) {
            existingEmptySlots += placedCard.max_coins - placed.coinsOnCard;
          }
        }
        if (existingEmptySlots > 0) {
          // L'effet va remplir des bourses → bonus
          economyBonus += Math.min(existingEmptySlots, 4) * 2;
        }
      }

      // =========================================================================
      // PÉNALITÉ POUR CARTES AVEC CONTRAINTE DE POSITION
      // Si les positions optimales sont déjà prises, la carte ne scorera pas !
      // =========================================================================
      const positionConstraint = POSITION_CONSTRAINTS[buyOption.cardId];
      if (positionConstraint) {
        // Compter combien de positions optimales sont encore disponibles
        const availableOptimalPositions = positionConstraint.positions.filter(
          pos => player.board[pos] === null
        ).length;

        if (availableOptimalPositions === 0) {
          // AUCUNE position optimale disponible → cette carte ne scorera PAS !
          // Grosse pénalité = score perdu
          economyBonus -= positionConstraint.score;
        } else if (availableOptimalPositions === 1) {
          // Une seule position dispo → risqué
          economyBonus -= 2;
        }
      }

    }

    // =========================================================================
    // PÉNALITÉ D'ANTI-SYNERGIE
    // Calculer si cette carte va DÉTRUIRE la valeur d'autres cartes
    // =========================================================================
    let antiSynergyPenalty = 0;
    let antiSynergyReason = '';

    if (!buyOption.flipped) {
      const antiSynergy = calculateAntiSynergyPenalty(player, buyOption.cardId, cards);
      antiSynergyPenalty = antiSynergy.penalty;
      if (antiSynergy.reasons.length > 0) {
        antiSynergyReason = ` [ANTI: ${antiSynergy.reasons.join(', ')}]`;
      }
    }

    // =========================================================================
    // BONUS DE POTENTIEL (build-around + stratégie)
    // Calculer le bonus pour les cartes à haut potentiel et celles qui
    // renforcent la stratégie détectée
    // =========================================================================
    let potentialBonus = 0;
    let potentialReason = '';

    if (!buyOption.flipped) {
      const potential = calculatePotentialBonus(
        buyOption.cardId,
        player,
        turnNumber,
        detectedStrategy,
        cards
      );
      potentialBonus = potential.bonus;
      if (potential.reasons.length > 0) {
        potentialReason = ` [POT: ${potential.reasons.join(', ')}]`;
      }
    }

    // Delta total = delta réel + économie - anti-synergie + potentiel
    const totalDelta = bestPlace.deltaScore + economyBonus - antiSynergyPenalty + potentialBonus;

    // Ajouter un bonus d'exploration aléatoire pour introduire de la variance
    // Ce bonus permet de parfois choisir des options proches du meilleur choix
    // Variance uniforme entre 0 et 3 points
    const explorationBonus = Math.random() * 3;
    const totalDeltaWithExploration = totalDelta + explorationBonus;

    if (totalDeltaWithExploration > bestDelta) {
      bestDelta = totalDeltaWithExploration;
      bestMove = {
        buyOption,
        placeOption: bestPlace,
        totalDelta, // On garde le delta réel (sans exploration) pour le reporting
        reasoning: buyOption.flipped
          ? `Retourner pour +${buyOption.goldGained} or, +${buyOption.keysGained} clés (bonus éco: ${economyBonus.toFixed(1)})`
          : `Acheter ${buyOption.cardId} (coût: ${buyOption.cost}), pos ${bestPlace.position} (delta: ${bestPlace.deltaScore}, éco: ${economyBonus.toFixed(1)}, anti: -${antiSynergyPenalty}, pot: +${potentialBonus})${antiSynergyReason}${potentialReason}`,
      };
    }
  }

  return bestMove;
}

/**
 * Version améliorée qui considère aussi les synergies futures
 */
export function evaluateBestMoveWithLookahead(
  player: PlayPlayer,
  availableCards: string[],
  messengerLocation: 'castle' | 'village',
  cards: Map<string, PlayCard>,
  turnNumber: number
): MoveEvaluation | null {
  // Passer turnNumber à evaluateBestMove pour le calcul du bonus de potentiel
  const basicBest = evaluateBestMove(player, availableCards, messengerLocation, cards, turnNumber);

  if (!basicBest) return null;

  // En début de partie, favoriser les cartes avec réduction
  if (turnNumber <= 3) {
    const buyOptions = evaluateBuyOptions(player, availableCards, messengerLocation, cards);

    for (const buyOption of buyOptions) {
      if (buyOption.flipped) continue;

      const card = cards.get(buyOption.cardId);
      if (card?.has_price_reduction) {
        // IMPORTANT: Vérifier les anti-synergies d'abord
        const antiSynergy = calculateAntiSynergyPenalty(player, buyOption.cardId, cards);
        if (antiSynergy.penalty > 0) {
          // Cette carte causerait une anti-synergie, ne pas prioriser
          continue;
        }

        // Bonus significatif pour les réductions en début de partie
        const remainingTurns = 9 - turnNumber;
        const reductionBonus = remainingTurns * 1.5;

        if (basicBest.totalDelta + reductionBonus > basicBest.totalDelta) {
          // Recalculer avec le bonus
          const coinsOnCards = new Map<string, number>();
          for (const placed of player.board) {
            if (placed && placed.coinsOnCard > 0) {
              coinsOnCards.set(placed.cardId, placed.coinsOnCard);
            }
          }

          const placeOptions = evaluatePlaceOptions(
            player,
            buyOption.cardId,
            player.keys,
            coinsOnCards,
            cards
          );

          if (placeOptions.length > 0) {
            const totalDelta = placeOptions[0].deltaScore + reductionBonus;
            if (totalDelta > basicBest.totalDelta) {
              return {
                buyOption,
                placeOption: placeOptions[0],
                totalDelta,
                reasoning: `Réduction prioritaire: ${buyOption.cardId} (économie future estimée: ${reductionBonus.toFixed(1)})`,
              };
            }
          }
        }
      }
    }
  }

  // Favoriser la diversité des couleurs
  // ATTENTION: Ne pas donner de bonus aux cartes "no shield" (064, 044, etc.)
  // car elles ne veulent pas de diversité - elles veulent l'absence de certaines couleurs
  const existingColors = new Set<string>();
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (card) {
      for (const shield of card.shields) {
        existingColors.add(shield.color);
      }
    }
  }

  if (existingColors.size < 6) {
    const buyOptions = evaluateBuyOptions(player, availableCards, messengerLocation, cards);

    for (const buyOption of buyOptions) {
      if (buyOption.flipped) continue;

      const card = cards.get(buyOption.cardId);
      if (!card) continue;

      // IMPORTANT: Ne pas donner de bonus "nouvelle couleur" aux cartes "no shield"
      // Ces cartes ne veulent PAS de diversité, elles veulent l'ABSENCE d'une couleur
      if (NO_SHIELD_CONSTRAINTS[buyOption.cardId]) {
        continue;
      }

      let newColors = 0;
      for (const shield of card.shields) {
        if (!existingColors.has(shield.color)) {
          newColors++;
        }
      }

      if (newColors > 0) {
        // Bonus pour nouvelle couleur (potentiel rule_024 et autres)
        const colorBonus = newColors * 3;

        // IMPORTANT: Vérifier les anti-synergies avant de donner un bonus
        const antiSynergy = calculateAntiSynergyPenalty(player, buyOption.cardId, cards);
        if (antiSynergy.penalty > 0) {
          // Cette carte causerait une anti-synergie, ne pas donner de bonus couleur
          continue;
        }

        const coinsOnCards = new Map<string, number>();
        for (const placed of player.board) {
          if (placed && placed.coinsOnCard > 0) {
            coinsOnCards.set(placed.cardId, placed.coinsOnCard);
          }
        }

        const placeOptions = evaluatePlaceOptions(
          player,
          buyOption.cardId,
          player.keys,
          coinsOnCards,
          cards
        );

        if (placeOptions.length > 0) {
          const totalDelta = placeOptions[0].deltaScore + colorBonus;
          if (totalDelta > basicBest.totalDelta) {
            return {
              buyOption,
              placeOption: placeOptions[0],
              totalDelta,
              reasoning: `Nouvelle(s) couleur(s): ${buyOption.cardId} (+${newColors} couleurs)`,
            };
          }
        }
      }
    }
  }

  return basicBest;
}

// =============================================================================
// ÉVALUATION DES CARTES DISPONIBLES (pour décider si refresh)
// =============================================================================

export interface CardEvaluation {
  cardId: string;
  affordable: boolean;
  antiSynergyPenalty: number;
  antiSynergyReasons: string[];
  estimatedValue: number; // Delta estimé si on achète cette carte
}

export interface AvailableCardsAnalysis {
  evaluations: CardEvaluation[];
  bestCard: CardEvaluation | null;
  allHaveAntiSynergies: boolean;
  avgAntiSynergyPenalty: number;
  shouldRefresh: boolean;
  refreshReason: string;
}

/**
 * Évalue les cartes disponibles pour déterminer si un refresh serait bénéfique.
 *
 * Retourne une analyse complète incluant:
 * - L'évaluation de chaque carte (anti-synergies, valeur estimée)
 * - Si toutes les cartes ont des anti-synergies
 * - Si un refresh est recommandé
 */
export function evaluateAvailableCards(
  player: PlayPlayer,
  availableCards: string[],
  _messengerLocation: 'castle' | 'village',
  cards: Map<string, PlayCard>
): AvailableCardsAnalysis {
  const evaluations: CardEvaluation[] = [];

  // Calculer les pièces sur cartes une seule fois
  const coinsOnCards = new Map<string, number>();
  for (const placed of player.board) {
    if (placed && placed.coinsOnCard > 0) {
      coinsOnCards.set(placed.cardId, placed.coinsOnCard);
    }
  }

  for (const cardId of availableCards) {
    const card = cards.get(cardId);
    if (!card) continue;

    // Vérifier si le joueur peut acheter cette carte
    const cost = getEffectiveCost(
      card.value,
      card.category,
      player.reductionCastle,
      player.reductionVillage
    );
    const affordable = player.gold >= cost;

    // Calculer les anti-synergies
    const antiSynergy = calculateAntiSynergyPenalty(player, cardId, cards);

    // Estimer la valeur de la carte (delta score si on l'achète)
    let estimatedValue = 0;
    if (affordable) {
      const placeOptions = evaluatePlaceOptions(
        player,
        cardId,
        player.keys,
        coinsOnCards,
        cards
      );
      if (placeOptions.length > 0) {
        estimatedValue = placeOptions[0].deltaScore - antiSynergy.penalty;
      }
    }

    evaluations.push({
      cardId,
      affordable,
      antiSynergyPenalty: antiSynergy.penalty,
      antiSynergyReasons: antiSynergy.reasons,
      estimatedValue,
    });
  }

  // Trouver la meilleure carte
  const affordableCards = evaluations.filter(e => e.affordable);
  const bestCard = affordableCards.length > 0
    ? affordableCards.reduce((best, curr) =>
        curr.estimatedValue > best.estimatedValue ? curr : best
      )
    : null;

  // Analyser les anti-synergies
  const cardsWithAntiSynergies = evaluations.filter(e => e.antiSynergyPenalty > 0);
  const allHaveAntiSynergies = affordableCards.length > 0 &&
    affordableCards.every(e => e.antiSynergyPenalty > 0);

  const totalPenalty = cardsWithAntiSynergies.reduce((sum, e) => sum + e.antiSynergyPenalty, 0);
  const avgAntiSynergyPenalty = cardsWithAntiSynergies.length > 0
    ? totalPenalty / cardsWithAntiSynergies.length
    : 0;

  // Décider si un refresh est recommandé
  // Conditions plus relaxées pour utiliser les clés plus souvent
  let shouldRefresh = false;
  let refreshReason = '';

  if (allHaveAntiSynergies && affordableCards.length > 0) {
    shouldRefresh = true;
    refreshReason = 'Toutes les cartes achetables ont des anti-synergies';
  } else if (bestCard && bestCard.estimatedValue < 2) {
    // Relaxé: delta < 2 (était < -5)
    shouldRefresh = true;
    refreshReason = `Meilleure carte a un faible delta (${bestCard.estimatedValue.toFixed(1)})`;
  } else if (avgAntiSynergyPenalty > 5 && cardsWithAntiSynergies.length >= 2) {
    // Relaxé: seuil de 5 (était 8)
    shouldRefresh = true;
    refreshReason = `Pénalité moyenne d'anti-synergie (${avgAntiSynergyPenalty.toFixed(1)})`;
  } else if (affordableCards.length === 0) {
    // Aucune carte achetable = refresh fortement conseillé
    shouldRefresh = true;
    refreshReason = 'Aucune carte achetable';
  }

  return {
    evaluations,
    bestCard,
    allHaveAntiSynergies,
    avgAntiSynergyPenalty,
    shouldRefresh,
    refreshReason,
  };
}

/**
 * Compare deux lieux (château vs village) pour déterminer lequel a les meilleures cartes.
 *
 * Retourne le lieu recommandé pour le messager et si un déplacement vaut le coup.
 */
export function compareLevels(
  player: PlayPlayer,
  castleCards: string[],
  villageCards: string[],
  currentLocation: 'castle' | 'village',
  cards: Map<string, PlayCard>
): {
  recommendedLocation: 'castle' | 'village';
  shouldMove: boolean;
  currentAnalysis: AvailableCardsAnalysis;
  otherAnalysis: AvailableCardsAnalysis;
  moveReason: string;
} {
  const currentCards = currentLocation === 'castle' ? castleCards : villageCards;
  const otherCards = currentLocation === 'castle' ? villageCards : castleCards;
  const otherLocation = currentLocation === 'castle' ? 'village' : 'castle';

  const currentAnalysis = evaluateAvailableCards(player, currentCards, currentLocation, cards);
  const otherAnalysis = evaluateAvailableCards(player, otherCards, otherLocation, cards);

  // Comparer les meilleures cartes de chaque lieu
  const currentBestValue = currentAnalysis.bestCard?.estimatedValue ?? -Infinity;
  const otherBestValue = otherAnalysis.bestCard?.estimatedValue ?? -Infinity;

  // Seuil pour justifier un déplacement (la différence doit être significative)
  const MOVE_THRESHOLD = 5;

  let shouldMove = false;
  let moveReason = '';

  if (otherBestValue > currentBestValue + MOVE_THRESHOLD) {
    shouldMove = true;
    moveReason = `L'autre lieu a une meilleure carte (${otherBestValue.toFixed(1)} vs ${currentBestValue.toFixed(1)})`;
  } else if (currentAnalysis.allHaveAntiSynergies && !otherAnalysis.allHaveAntiSynergies) {
    shouldMove = true;
    moveReason = 'Le lieu actuel n\'a que des anti-synergies, l\'autre lieu est meilleur';
  } else if (currentAnalysis.shouldRefresh && !otherAnalysis.shouldRefresh) {
    shouldMove = true;
    moveReason = 'Le lieu actuel nécessite un refresh, mais l\'autre lieu est OK';
  }

  return {
    recommendedLocation: shouldMove ? otherLocation : currentLocation,
    shouldMove,
    currentAnalysis,
    otherAnalysis,
    moveReason,
  };
}
