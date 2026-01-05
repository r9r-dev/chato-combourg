/**
 * Calculateur de delta de score
 *
 * Pour chaque coup possible, calcule le gain net de score :
 * delta = scoreApres - scoreAvant - coutsIndirects
 *
 * Cette approche est plus efficace que MCTS pour ce jeu car
 * elle utilise le score exact plutôt qu'une estimation.
 */

import type { PlayPlayer, PlayCard } from '../../../../types/play';
import { getValidPlacements, getEffectiveCost } from '../../../../types/play';
import { calculateScore, Grid, RULES, KEYS_RULES } from './scoreCalculator';

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
    checkFunction: (player, cards) => {
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

// Cartes avec effet fill_purses dans le lock
const FILL_PURSE_LOCK_CARDS = new Set([
  '049', // lock: fill_purses_select(2)
]);

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

      // Si la contrainte était respectée, la casser = pénalité
      if (!boardHasColor) {
        penalty += constraint.score;
        reasons.push(`Détruit ${placed.cardId} (${constraint.score} pts): bouclier ${constraint.color}`);
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
      penalty += newCardConstraint.score;
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
      penalty += 12;
      reasons.push(`056 ne scorera pas: carte retournée déjà présente`);
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
 * Version simplifiée pour compatibilité (retourne juste le nombre)
 */
function calculateConstraintPenalty(
  player: PlayPlayer,
  newCardId: string,
  cards: Map<string, PlayCard>
): number {
  return calculateAntiSynergyPenalty(player, newCardId, cards).penalty;
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
  messengerLocation: 'castle' | 'village',
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

    // Coût en clés si le messager doit bouger
    const cardLocation = card.category;
    const keysCost = card.has_messenger ? 0 : 0; // Le messager est gratuit sur achat

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
      if (position === 4) positionBonus += 1;

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

  // Trier par delta décroissant
  options.sort((a, b) => b.deltaScore - a.deltaScore);

  return options;
}

/**
 * Calcule le score actuel d'un plateau (complet ou partiel)
 */
function calculateCurrentScore(
  cardIds: string[],
  keys: number,
  coinsOnCards: Map<string, number>,
  cards: Map<string, PlayCard>
): number {
  // Vérifier si le plateau est complet
  const placedCount = cardIds.filter(c => c !== '').length;

  if (placedCount === 9) {
    // Plateau complet : score exact
    const result = calculateScore(cardIds, keys, coinsOnCards, cards);
    return result.totalScore;
  }

  // Plateau partiel : utiliser une estimation simple basée sur les cartes placées
  // On ne peut pas calculer les règles exactes sans plateau complet
  let score = 0;

  for (const cardId of cardIds) {
    if (!cardId) continue;
    const card = cards.get(cardId);
    if (card) {
      // Score approximatif basé sur la valeur
      score += card.value;
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
 * Évalue le meilleur coup complet (achat + placement)
 */
export function evaluateBestMove(
  player: PlayPlayer,
  availableCards: string[],
  messengerLocation: 'castle' | 'village',
  cards: Map<string, PlayCard>
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
        // On a 056 et pas encore de carte retournée → retourner = -12 points !
        economyBonus -= 12;
      } else if (!has056 && turnsRemaining > 3) {
        // On pourrait encore acheter 056 plus tard → malus préventif
        economyBonus -= 4;
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

      // Malus si on épuise tout l'or trop tôt
      const goldAfterBuy = player.gold - buyOption.cost;
      if (goldAfterBuy < 4 && turnsRemaining > 4) {
        economyBonus -= 1;
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

    // Delta total = delta réel du score + bonus économique - pénalité anti-synergie
    const totalDelta = bestPlace.deltaScore + economyBonus - antiSynergyPenalty;

    if (totalDelta > bestDelta) {
      bestDelta = totalDelta;
      bestMove = {
        buyOption,
        placeOption: bestPlace,
        totalDelta,
        reasoning: buyOption.flipped
          ? `Retourner pour +${buyOption.goldGained} or, +${buyOption.keysGained} clés (bonus éco: ${economyBonus.toFixed(1)})`
          : `Acheter ${buyOption.cardId} (coût: ${buyOption.cost}), pos ${bestPlace.position} (delta: ${bestPlace.deltaScore}, éco: ${economyBonus.toFixed(1)}, anti: -${antiSynergyPenalty})${antiSynergyReason}`,
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
  const basicBest = evaluateBestMove(player, availableCards, messengerLocation, cards);

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
