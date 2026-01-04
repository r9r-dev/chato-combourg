/**
 * Easy AI - IA Facile (Debutant naif)
 *
 * Simule un joueur qui decouvre le jeu pour la premiere fois :
 * - Adore les cartes de positionnement (023, 037, 051, 076...)
 * - Prefere les cartes simples qui donnent de l'or
 * - Attire par les cartes a haute valeur (effet "gros score")
 * - Evite les cartes compliquees (cadenas, reductions)
 * - Garde ses cles "pour plus tard" (ne les utilise presque jamais)
 * - Place ses cartes intelligemment (aligne boucliers et categories)
 *   -> C'est la premiere mecanique qu'on apprend !
 * - N'achete face cachee que quand il est fauche
 */

import type {
  AIPlayer,
  AILevel,
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  PlayGameState,
  PlayCard,
  PlacedCard,
  ShieldColor,
  DiscardChoice,
  ReplaceLocationChoice,
  AdjacentCardChoice,
  PurseSelectionChoice,
  Location,
} from '../../../types/play';
import {
  canAffordCard,
  getCurrentPlayer,
  getCard,
} from '../gameEngine';

// =============================================================================
// Helpers pour le placement intelligent (boucliers alignes)
// =============================================================================

/** Positions dans la meme ligne */
const ROW_POSITIONS: number[][] = [
  [0, 1, 2], // ligne 0
  [3, 4, 5], // ligne 1
  [6, 7, 8], // ligne 2
];

/** Positions dans la meme colonne */
const COL_POSITIONS: number[][] = [
  [0, 3, 6], // colonne 0
  [1, 4, 7], // colonne 1
  [2, 5, 8], // colonne 2
];

/** Retourne la ligne et colonne d'une position */
function getRowCol(position: number): { row: number; col: number } {
  return {
    row: Math.floor(position / 3),
    col: position % 3,
  };
}

/** Compte les boucliers d'une couleur dans une ligne ou colonne */
function countShieldsInLine(
  board: (PlacedCard | null)[],
  positions: number[],
  color: ShieldColor
): number {
  let count = 0;
  for (const pos of positions) {
    const placed = board[pos];
    if (placed) {
      const card = getCard(placed.cardId);
      if (card) {
        for (const shield of card.shields) {
          if (shield.color === color) {
            count += shield.count;
          }
        }
      }
    }
  }
  return count;
}

/** Compte les cartes d'une categorie dans une ligne ou colonne */
function countCategoryInLine(
  board: (PlacedCard | null)[],
  positions: number[],
  category: 'castle' | 'village'
): number {
  let count = 0;
  for (const pos of positions) {
    const placed = board[pos];
    if (placed) {
      const card = getCard(placed.cardId);
      if (card?.category === category) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Evalue le score d'une position pour une carte donnee
 * Le debutant essaie d'aligner les boucliers et les categories
 */
function evaluatePosition(
  board: (PlacedCard | null)[],
  position: number,
  cardToPlace: PlayCard
): number {
  const { row, col } = getRowCol(position);
  let score = 0;

  // Compter les alignements de boucliers
  for (const shield of cardToPlace.shields) {
    const color = shield.color;
    const shieldCount = shield.count;

    // Boucliers alignes dans la ligne
    const rowShields = countShieldsInLine(board, ROW_POSITIONS[row], color);
    score += rowShields * shieldCount;

    // Boucliers alignes dans la colonne
    const colShields = countShieldsInLine(board, COL_POSITIONS[col], color);
    score += colShields * shieldCount;
  }

  // Bonus pour aligner les categories (chateau avec chateau, village avec village)
  if (cardToPlace.category) {
    const rowCategory = countCategoryInLine(board, ROW_POSITIONS[row], cardToPlace.category);
    const colCategory = countCategoryInLine(board, COL_POSITIONS[col], cardToPlace.category);
    score += (rowCategory + colCategory) * 2;
  }

  // Petite variance aleatoire
  score += Math.random() * 0.5;

  return score;
}

// =============================================================================
// Systeme de preferences pour un debutant naif
// =============================================================================

/**
 * Cartes avec gros score "brut" affiche
 * Le debutant est attire par les gros chiffres meme si le potentiel reel est moindre
 */

// 10-12 points affiches : le debutant les ADORE
const BIG_SCORE_CARDS_TIER1 = new Set([
  '026', // 10 pts si pas de jaune
  '044', // 10 pts si pas d'orange
  '072', // 10 pts si pas de vert
  '083', // 10 pts si pas de rouge
  '018', // 10 pts par trio bleu/vert/orange
  '056', // 12 pts si pas de carte retournee
  '079', // 10 pts si pas de bourse
]);

// 8-9 points affiches : le debutant les aime bien
const BIG_SCORE_CARDS_TIER2 = new Set([
  '064', // 9 pts si pas de rose
  '091', // 9 pts si pas de bleu
  '003', // 8 pts si ligne du haut
  '021', // 8 pts si colonne gauche
  '031', // 8 pts si colonne droite
  '004', // 8 pts si pas de reduction
  '082', // 8 pts si carte retournee
]);

// 7 points affiches : le debutant trouve ca pas mal
const BIG_SCORE_CARDS_TIER3 = new Set([
  '054', // 7 pts par trio rose/rouge/jaune
  '063', // 7 pts si ligne du bas
  '069', // 7 pts par lot de 3 villages
  '075', // 7 pts si 1+ rouge sur ligne
]);

// Cartes "X points si pas de [couleur]" - neutralisees si la couleur est presente
const NO_SHIELD_CARDS: Record<string, ShieldColor> = {
  '026': 'yellow',
  '044': 'orange',
  '064': 'pink',
  '072': 'green',
  '083': 'red',
  '091': 'blue',
};

// Cartes qui comptent les features (reduction, cadenas, bourse)
const FEATURE_COUNT_CARDS: Record<string, 'price_reduction' | 'lock' | 'coin_purse'> = {
  '032': 'price_reduction', // 4 pts par reduction
  '004': 'price_reduction', // 8 pts si aucune reduction (inverse - on garde)
  '070': 'lock',            // 4 pts par cadenas
  '079': 'coin_purse',      // 10 pts si aucune bourse (inverse - on garde)
};

// Cartes qui comptent les categories
const CATEGORY_COUNT_CARDS: Record<string, 'castle' | 'village'> = {
  '006': 'village',  // 2 pts par village
  '046': 'castle',   // 2 pts par chateau
  '074': 'castle',   // 2 pts par chateau
  '078': 'village',  // 1 pt par village
  '084': 'castle',   // 1 pt par chateau
  '069': 'village',  // 7 pts par lot de 3 villages
};

/**
 * Verifie si le joueur a un bouclier d'une couleur donnee sur son plateau
 */
function hasShieldColor(board: (PlacedCard | null)[], color: ShieldColor): boolean {
  for (const placed of board) {
    if (placed) {
      const card = getCard(placed.cardId);
      if (card) {
        for (const shield of card.shields) {
          if (shield.color === color) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Compte les cartes avec une feature donnee sur le plateau
 */
function countFeature(board: (PlacedCard | null)[], feature: 'price_reduction' | 'lock' | 'coin_purse'): number {
  let count = 0;
  for (const placed of board) {
    if (placed) {
      const card = getCard(placed.cardId);
      if (card) {
        if (feature === 'price_reduction' && card.has_price_reduction) count++;
        if (feature === 'lock' && card.has_lock) count++;
        if (feature === 'coin_purse' && card.has_coin_purse) count++;
      }
    }
  }
  return count;
}

/**
 * Compte les cartes d'une categorie donnee sur le plateau
 */
function countCategory(board: (PlacedCard | null)[], category: 'castle' | 'village'): number {
  let count = 0;
  for (const placed of board) {
    if (placed) {
      const card = getCard(placed.cardId);
      if (card?.category === category) count++;
    }
  }
  return count;
}

/**
 * Verifie si une carte rapporterait 0 points actuellement
 * Le debutant n'anticipe pas - il ne prend pas une carte qui ne rapporte rien maintenant
 */
function wouldScore0Points(cardId: string, board: (PlacedCard | null)[]): boolean {
  // Cartes qui comptent les features
  const feature = FEATURE_COUNT_CARDS[cardId];
  if (feature) {
    // 004 et 079 sont des cartes "si aucune X" - on ne les filtre pas ici
    if (cardId === '004' || cardId === '079') return false;
    // Les autres donnent 0 si aucune feature
    if (countFeature(board, feature) === 0) return true;
  }

  // Cartes qui comptent les categories
  const category = CATEGORY_COUNT_CARDS[cardId];
  if (category) {
    if (countCategory(board, category) === 0) return true;
  }

  return false;
}

/**
 * Calcule un score de preference pour une carte
 * Plus le score est eleve, plus le debutant est attire par la carte
 *
 * @param cardId - ID de la carte a evaluer
 * @param board - Plateau du joueur (pour verifier les cartes neutralisees)
 */
function getCardPreference(cardId: string, board: (PlacedCard | null)[]): number {
  const card = getCard(cardId);
  if (!card) return 0;

  let score = 0;

  // ==========================================================================
  // CARTES QUE LE DEBUTANT N'ACHETE JAMAIS
  // ==========================================================================

  // Le debutant ne prend JAMAIS une carte "X pts si pas de [couleur]"
  // s'il a deja cette couleur sur son plateau (ce serait 0 points POUR TOUJOURS)
  const requiredAbsentColor = NO_SHIELD_CARDS[cardId];
  if (requiredAbsentColor && hasShieldColor(board, requiredAbsentColor)) {
    return -100; // N'achete JAMAIS - la carte serait neutralisee definitivement
  }

  // ==========================================================================
  // CARTES QUI RAPPORTENT 0 POINTS ACTUELLEMENT
  // Le debutant n'anticipe pas, il evite ces cartes (mais pas impossible)
  // ==========================================================================
  if (wouldScore0Points(cardId, board)) {
    score -= 10; // Gros malus mais pas impossible
  }

  // ==========================================================================
  // GROS SCORE BRUT - Le debutant adore les cartes qui affichent des gros chiffres
  // Meme si en realite une carte "4 par paire" peut faire plus de points
  // ==========================================================================
  if (BIG_SCORE_CARDS_TIER1.has(cardId)) {
    score += 8; // "Woah, 10 points !"
  } else if (BIG_SCORE_CARDS_TIER2.has(cardId)) {
    score += 5; // "8-9 points c'est pas mal !"
  } else if (BIG_SCORE_CARDS_TIER3.has(cardId)) {
    score += 3; // "7 points, ca peut aller"
  }

  // Le debutant prefere les cartes simples avec des effets directs
  score += getEffectSimplicityBonus(card);

  // Le debutant evite les cartes avec cadenas (trop complique)
  if (card.has_lock) {
    score -= 3;
  }

  // Le debutant ne pense pas aux reductions (ne voit pas l'interet)
  if (card.has_price_reduction) {
    score -= 2;
  }

  // Petite variance aleatoire pour ne pas etre trop previsible
  score += Math.random() * 2 - 1; // -1 a +1

  return score;
}

/**
 * Bonus de simplicite basee sur les effets de la carte
 * Le debutant prefere les effets qui donnent de l'or directement
 * et ADORE les cartes de positionnement (c'est la premiere mecanique qu'il apprend)
 */
function getEffectSimplicityBonus(card: PlayCard): number {
  let bonus = 0;

  for (const effect of card.effects) {
    switch (effect.type) {
      // ============================================================
      // CARTES DE POSITIONNEMENT - Les preferees du debutant !
      // C'est la premiere mecanique qu'on apprend au jeu
      // ============================================================
      case 'gain_gold_per_castle':    // 023 Ecuyer, 037 Chapelain
      case 'gain_gold_per_village':   // 051 Lingere, 076 Jardiniere
        bonus += 6; // GROS bonus - le debutant adore ces cartes
        break;

      // Effets simples que le debutant comprend et aime
      case 'gain_gold':
        bonus += 4;
        break;
      case 'fill_purses':
        bonus += 3; // Aime les bourses (or visible)
        break;
      case 'gain_gold_per_card':
        bonus += 3; // Comprend "plus de cartes = plus d'or"
        break;
      case 'gain_gold_per_shield':
      case 'gain_gold_per_unique_shield':
      case 'gain_gold_per_card_with_shields':
        bonus += 3; // Comprend les boucliers (mecanique de base)
        break;

      // Effets avec cles - le debutant ne les comprend pas bien
      case 'gain_keys':
      case 'gain_keys_per_shield':
        bonus -= 1; // Ne sait pas quoi faire des cles
        break;

      // Effets complexes - le debutant evite
      case 'choice':
        bonus -= 1; // Trop de reflexion
        break;
      case 'discard_village_gain_keys':
      case 'discard_village_gain_gold':
      case 'discard_castle_gain_gold':
        bonus -= 2; // Trop complique
        break;

      // Effets de reduction - ne voit pas l'interet
      case 'reduction_castle':
      case 'reduction_village':
      case 'reduction_both':
        bonus -= 2;
        break;
    }
  }

  // Bonus pour les cartes avec bourse (le debutant aime voir l'or s'accumuler)
  if (card.has_coin_purse) {
    bonus += 2;
  }

  return bonus;
}

// =============================================================================
// Implementation de l'IA
// =============================================================================

export class EasyAI implements AIPlayer {
  level: AILevel = 'easy';
  name = 'Tom';

  // ===========================================================================
  // Actions obligatoires
  // ===========================================================================

  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const player = getCurrentPlayer(state);

    // Filtrer les cartes abordables
    const affordableCards = availableCards.filter(cardId => {
      const { canAfford } = canAffordCard(player, cardId);
      return canAfford;
    });

    // Le debutant n'achete face cachee que s'il n'a pas les moyens
    if (affordableCards.length === 0) {
      // Prendre la carte la moins chere face cachee
      const sortedByValue = [...availableCards].sort((a, b) => {
        const cardA = getCard(a);
        const cardB = getCard(b);
        return (cardA?.value ?? 0) - (cardB?.value ?? 0);
      });
      // Prend une des cartes les moins cheres (avec un peu de variance)
      const cheaperCards = sortedByValue.slice(0, 2);
      const selectedCard = cheaperCards[Math.floor(Math.random() * cheaperCards.length)];
      return { cardId: selectedCard, flipped: true };
    }

    // Choisir la carte avec le meilleur score de preference
    const cardsWithScores = affordableCards.map(cardId => ({
      cardId,
      score: getCardPreference(cardId, player.board),
    }));

    // Trier par score decroissant
    cardsWithScores.sort((a, b) => b.score - a.score);

    return { cardId: cardsWithScores[0].cardId, flipped: false };
  }

  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    const player = getCurrentPlayer(state);
    const cardToPlace = getCard(cardId);

    // Si on n'a pas d'info sur la carte, placement aleatoire
    if (!cardToPlace || validPositions.length === 0) {
      return validPositions[Math.floor(Math.random() * validPositions.length)] ?? 4;
    }

    // Le debutant essaie d'aligner les boucliers et les categories
    const positionsWithScores = validPositions.map(position => ({
      position,
      score: evaluatePosition(player.board, position, cardToPlace),
    }));

    // Trier par score decroissant
    positionsWithScores.sort((a, b) => b.score - a.score);

    return positionsWithScores[0].position;
  }

  // ===========================================================================
  // Actions facultatives
  // ===========================================================================

  selectKeyAction(_state: PlayGameState): AIKeyAction | null {
    // Le debutant garde ses cles "pour plus tard"
    // Il ne les utilise presque jamais (seulement 5% de chance)
    if (Math.random() < 0.05) {
      // S'il decide d'utiliser une cle, il prefere deplacer le messager
      return {
        type: 'move_messenger',
        targetLocation: Math.random() < 0.5 ? 'castle' : 'village',
      };
    }
    return null;
  }

  selectLockAction(_state: PlayGameState, availableLocks: number[]): number | null {
    // Le debutant garde ses cles "pour plus tard"
    // Seulement 5% de chance d'utiliser un cadenas
    if (Math.random() < 0.05 && availableLocks.length > 0) {
      return availableLocks[Math.floor(Math.random() * availableLocks.length)];
    }
    return null;
  }

  // ===========================================================================
  // Choix d'effets
  // ===========================================================================

  selectEffectOption(_state: PlayGameState, options: AIEffectOption[]): number {
    // Le debutant prefere l'or aux cles (80% du temps option 0)
    // Dans la plupart des cartes, l'option 0 donne de l'or
    if (options.length === 0) return 0;
    return Math.random() < 0.8 ? 0 : Math.min(1, options.length - 1);
  }

  selectLocation(_state: PlayGameState, _choice: ReplaceLocationChoice): Location {
    // Le debutant choisit au hasard
    return Math.random() < 0.5 ? 'castle' : 'village';
  }

  selectDiscardCard(_state: PlayGameState, _choice: DiscardChoice, availableCards: string[]): string {
    // Le debutant choisit la carte la plus chere (il pense que c'est mieux)
    let bestCard = availableCards[0];
    let bestValue = 0;
    for (const cardId of availableCards) {
      const card = getCard(cardId);
      if (card && card.value > bestValue) {
        bestValue = card.value;
        bestCard = cardId;
      }
    }
    return bestCard;
  }

  selectAdjacentCard(_state: PlayGameState, choice: AdjacentCardChoice): number {
    // Le debutant choisit au hasard parmi les cartes adjacentes
    const positions = choice.adjacentPositions;
    return positions[Math.floor(Math.random() * positions.length)];
  }

  selectPurses(_state: PlayGameState, choice: PurseSelectionChoice): number[] {
    // Le debutant remplit les premieres bourses disponibles
    return choice.availablePositions.slice(0, choice.maxCards);
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  async isAvailable(): Promise<boolean> {
    return true; // Toujours disponible
  }
}
