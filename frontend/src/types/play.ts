/**
 * Types pour le mode "Jouer" (Play Mode)
 *
 * Ce fichier definit les types pour :
 * - L'etat du jeu en cours
 * - Les joueurs (humains et IA)
 * - Le plateau central (village/chateau)
 * - Les actions possibles
 * - Les effets des cartes
 */

// =============================================================================
// Couleurs et categories
// =============================================================================

export type ShieldColor = 'blue' | 'pink' | 'green' | 'red' | 'orange' | 'yellow';
export type CardCategory = 'castle' | 'village';
export type Location = 'castle' | 'village';

// =============================================================================
// Carte et attributs
// =============================================================================

export interface CardEffect {
  type: string;
  amount?: number;
  color?: ShieldColor;
  shield_count?: number;
  value?: number;
  feature?: string;
  keys_per_card?: number;
  options?: CardEffect[];  // Pour les choix [OU]
}

export interface CardEffectData {
  has_messenger: boolean;
  effects: CardEffect[];
  lock_effect: CardEffect | null;
  is_flipped?: boolean;
  flipped_from?: Location;
}

export interface PlayCard {
  id: string;                    // "001" - "092"
  value: number;                 // Cout en or
  shields: { count: number; color: ShieldColor }[];
  category: CardCategory | null;
  has_messenger: boolean;
  has_price_reduction: boolean;
  has_lock: boolean;
  has_coin_purse: boolean;
  max_coins: number;
  effects: CardEffect[];
  lock_effect: CardEffect | null;
}

// =============================================================================
// Joueur
// =============================================================================

export type AILevel = 'easy' | 'normal' | 'hard' | 'neural';

export interface PlayPlayer {
  id: string;                    // UUID ou "ai-easy", "ai-normal", etc.
  name: string;
  color: string;
  isAI: boolean;
  aiLevel?: AILevel;

  // Ressources
  gold: number;
  keys: number;

  // Reductions permanentes
  reductionCastle: number;       // Nombre de reductions chateau
  reductionVillage: number;      // Nombre de reductions village

  // Plateau du joueur (3x3, positions 0-8)
  board: (PlacedCard | null)[];  // null = emplacement vide

  // Cartes avec cadenas actives (cles disponibles)
  lockedCards: Map<number, boolean>;  // position -> a une cle disponible
}

export interface PlacedCard {
  cardId: string;
  position: number;              // 0-8 sur le plateau du joueur
  coinsOnCard: number;           // Pieces sur la bourse
  hasKeyOnLock: boolean;         // Cle sur le cadenas
  isFlipped: boolean;            // Carte retournee (089/090)
}

// =============================================================================
// Plateau central
// =============================================================================

export interface CentralBoard {
  // Cartes visibles (3 par lieu)
  castleCards: string[];         // 3 card IDs
  villageCards: string[];        // 3 card IDs

  // Position du messager
  messengerLocation: Location;

  // Pioches et defausses
  castleDeck: string[];
  villageDeck: string[];
  castleDiscard: string[];
  villageDiscard: string[];
}

// =============================================================================
// Actions
// =============================================================================

export type ActionType =
  | 'use_key_on_lock'      // Utiliser une cle sur un cadenas
  | 'spend_key'            // Depenser une cle (move messager ou refresh)
  | 'buy_card'             // Acheter une carte
  | 'buy_card_flipped'     // Acheter une carte face cachee
  | 'place_card'           // Placer une carte sur le plateau
  | 'apply_effect'         // Appliquer l'effet d'une carte
  | 'choose_effect'        // Choisir entre 2 effets [OU]
  | 'end_turn';            // Fin du tour

export interface GameAction {
  type: ActionType;
  playerId: string;

  // Parametres selon le type d'action
  cardId?: string;               // Carte concernee
  position?: number;             // Position sur le plateau
  targetLocation?: Location;     // Lieu cible (pour messager/refresh)
  choiceIndex?: number;          // Index du choix (pour effects [OU])
  lockPosition?: number;         // Position de la carte avec cadenas
}

// =============================================================================
// Etat de la partie
// =============================================================================

export type GamePhase =
  | 'setup'                // Configuration initiale
  | 'playing'              // Partie en cours
  | 'ended';               // Partie terminee

export type TurnPhase =
  | 'pre_action'           // Avant l'achat (peut utiliser cle/cadenas)
  | 'buy'                  // Doit acheter une carte
  | 'place'                // Doit placer la carte achetee
  | 'effect'               // Doit appliquer l'effet
  | 'post_action'          // Apres l'effet (peut utiliser cadenas)
  | 'end';                 // Tour termine

export interface PlayGameState {
  // Identifiant unique de la partie
  gameId: string;

  // Phase globale
  phase: GamePhase;

  // Joueurs (dans l'ordre de jeu)
  players: PlayPlayer[];
  currentPlayerIndex: number;

  // Tour en cours
  turnNumber: number;            // 1-9 (chaque joueur fait 9 tours)
  turnPhase: TurnPhase;

  // Carte achetee ce tour (en attente de placement)
  purchasedCard: string | null;
  purchasedCardCost: number;     // Cout effectif paye

  // Plateau central
  board: CentralBoard;

  // Historique des actions (pour replay/undo)
  actionHistory: GameAction[];

  // Scores finaux (apres calcul)
  finalScores?: Map<string, number>;
}

// =============================================================================
// Configuration de partie
// =============================================================================

export interface PlayGameConfig {
  players: {
    name: string;
    color: string;
    isAI: boolean;
    aiLevel?: AILevel;
  }[];
  randomSeed?: number;           // Pour parties reproductibles
}

// =============================================================================
// Interface IA
// =============================================================================

export interface AIPlayer {
  level: AILevel;
  name: string;

  // Selectionne la meilleure action a effectuer
  selectAction(state: PlayGameState): Promise<GameAction>;

  // Verifie si l'IA peut tourner (pour ML qui peut necessiter le serveur)
  isAvailable(): Promise<boolean>;
}

// =============================================================================
// Resultats et statistiques
// =============================================================================

export interface PlayResult {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  board: PlacedCard[];
  finalGold: number;
  finalKeys: number;
}

export interface PlayGameResult {
  gameId: string;
  results: PlayResult[];
  winner: PlayResult;
  totalTurns: number;
  duration?: number;             // Duree en secondes
}

// =============================================================================
// Validations de placement
// =============================================================================

export interface PlacementValidation {
  position: number;
  isValid: boolean;
  reason?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/** Positions valides pour le placement selon les cartes deja placees */
export function getValidPlacements(board: (PlacedCard | null)[]): number[] {
  const occupied = board.map((c, i) => c !== null ? i : -1).filter(i => i >= 0);

  if (occupied.length === 0) {
    // Premiere carte : n'importe ou
    return [0, 1, 2, 3, 4, 5, 6, 7, 8];
  }

  // Positions adjacentes aux cartes existantes
  const adjacent = new Set<number>();
  const adjacencyMap: Record<number, number[]> = {
    0: [1, 3],
    1: [0, 2, 4],
    2: [1, 5],
    3: [0, 4, 6],
    4: [1, 3, 5, 7],
    5: [2, 4, 8],
    6: [3, 7],
    7: [4, 6, 8],
    8: [5, 7],
  };

  for (const pos of occupied) {
    for (const adj of adjacencyMap[pos]) {
      if (board[adj] === null) {
        adjacent.add(adj);
      }
    }
  }

  // Verifier que le placement permet toujours une grille 3x3
  const validPositions: number[] = [];
  for (const pos of adjacent) {
    if (canFormValidGrid([...occupied, pos])) {
      validPositions.push(pos);
    }
  }

  return validPositions;
}

/** Verifie si les positions peuvent former une grille 3x3 valide */
function canFormValidGrid(positions: number[]): boolean {
  if (positions.length === 0) return true;
  if (positions.length > 9) return false;

  // Calculer les lignes et colonnes occupees
  const rows = new Set(positions.map(p => Math.floor(p / 3)));
  const cols = new Set(positions.map(p => p % 3));

  // Une grille 3x3 valide ne peut pas avoir plus de 3 lignes ou colonnes
  if (rows.size > 3 || cols.size > 3) return false;

  // Si on a deja 9 cartes, verifier que c'est exactement 3x3
  if (positions.length === 9) {
    return rows.size === 3 && cols.size === 3;
  }

  return true;
}

/** Calcule le cout effectif d'une carte avec les reductions */
export function getEffectiveCost(
  cardValue: number,
  cardCategory: CardCategory | null,
  reductionCastle: number,
  reductionVillage: number
): number {
  let reduction = 0;

  if (cardCategory === 'castle') {
    reduction = reductionCastle;
  } else if (cardCategory === 'village') {
    reduction = reductionVillage;
  }

  return Math.max(0, cardValue - reduction);
}
