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
  max_cards?: number;        // Pour fill_purses_select
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
  playerId?: number;             // ID du joueur en base (pour les humains uniquement)

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
  | 'place_card'           // Placer une carte (avec shift optionnel)
  | 'apply_effect'         // Appliquer l'effet d'une carte
  | 'choose_effect'        // Choisir entre 2 effets [OU]
  | 'end_turn';            // Fin du tour

export type ShiftDirection = 'left' | 'right' | 'up' | 'down';

export interface GameAction {
  type: ActionType;
  playerId: string;

  // Parametres selon le type d'action
  cardId?: string;               // Carte concernee
  position?: number;             // Position sur le plateau
  targetLocation?: Location;     // Lieu cible (pour messager/refresh)
  choiceIndex?: number;          // Index du choix (pour effects [OU])
  lockPosition?: number;         // Position de la carte avec cadenas
  shiftDirection?: ShiftDirection; // Direction du decalage du plateau
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
  keyUsedThisTurn: boolean;      // Une seule cle par tour (messager/refresh)
  lockUsedThisTurn: boolean;     // Un seul cadenas par tour

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
    playerId?: number;           // ID du joueur en base (pour les humains uniquement)
  }[];
  randomSeed?: number;           // Pour parties reproductibles
}

// =============================================================================
// Interface IA
// =============================================================================

/** Decision d'achat de l'IA */
export interface AIBuyDecision {
  cardId: string;
  flipped: boolean;  // Acheter face cachee ?
}

/** Action de cle de l'IA */
export interface AIKeyAction {
  type: 'move_messenger' | 'refresh';
  targetLocation: Location;
}

/** Options d'effet [OU] presentees a l'IA */
export interface AIEffectOption {
  index: number;
  description: string;
}

/**
 * Interface complete pour les IA
 *
 * Chaque IA doit implementer TOUTES ces methodes pour garantir
 * qu'elle peut repondre a n'importe quelle situation de jeu.
 */
export interface AIPlayer {
  level: AILevel;
  name: string;

  // ===========================================================================
  // Actions obligatoires
  // ===========================================================================

  /**
   * Choisir quelle carte acheter
   * @param state Etat actuel du jeu
   * @param availableCards Cartes disponibles a l'achat
   * @returns Decision d'achat (carte + face cachee ou non)
   */
  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision;

  /**
   * Choisir ou placer la carte achetee
   * @param state Etat actuel du jeu
   * @param cardId ID de la carte a placer
   * @param validPositions Positions valides pour le placement
   * @returns Position choisie (0-8)
   */
  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number;

  // ===========================================================================
  // Actions facultatives
  // ===========================================================================

  /**
   * Decider si utiliser une cle (et comment)
   * Appele en phase pre_action si le joueur a des cles
   * @param state Etat actuel du jeu
   * @returns Action de cle ou null si on n'utilise pas de cle
   */
  selectKeyAction(state: PlayGameState): AIKeyAction | null;

  /**
   * Decider si ouvrir un cadenas
   * Appele en phase pre_action/post_action si le joueur a des cles et des cadenas
   * @param state Etat actuel du jeu
   * @param availableLocks Positions des cadenas disponibles (non ouverts)
   * @returns Position du cadenas a ouvrir ou null si on n'ouvre pas
   */
  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null;

  // ===========================================================================
  // Choix d'effets
  // ===========================================================================

  /**
   * Choisir entre plusieurs options d'effet [OU]
   * @param state Etat actuel du jeu
   * @param options Options disponibles avec description
   * @returns Index de l'option choisie
   */
  selectEffectOption(state: PlayGameState, options: AIEffectOption[]): number;

  /**
   * Choisir un lieu (chateau ou village)
   * Pour les effets de type replace_location
   * @param state Etat actuel du jeu
   * @param choice Details du choix de lieu
   * @returns Lieu choisi
   */
  selectLocation(state: PlayGameState, choice: ReplaceLocationChoice): Location;

  /**
   * Choisir une carte a defausser
   * @param state Etat actuel du jeu
   * @param choice Details du choix de defausse
   * @param availableCards Cartes disponibles pour la defausse
   * @returns ID de la carte a defausser
   */
  selectDiscardCard(state: PlayGameState, choice: DiscardChoice, availableCards: string[]): string;

  /**
   * Choisir une carte adjacente a activer
   * @param state Etat actuel du jeu
   * @param choice Details du choix
   * @returns Position de la carte adjacente choisie
   */
  selectAdjacentCard(state: PlayGameState, choice: AdjacentCardChoice): number;

  /**
   * Choisir quelles bourses remplir
   * @param state Etat actuel du jeu
   * @param choice Details du choix
   * @returns Positions des bourses a remplir
   */
  selectPurses(state: PlayGameState, choice: PurseSelectionChoice): number[];

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  /**
   * Verifie si l'IA peut tourner (pour ML qui peut necessiter le serveur)
   */
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

/** Map d'adjacence pour la grille 3x3 (positions orthogonales uniquement) */
export const ADJACENCY_MAP: Record<number, number[]> = {
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

/** Positions valides pour le placement selon les cartes deja placees */
export function getValidPlacements(board: (PlacedCard | null)[]): number[] {
  const occupied = board.map((c, i) => c !== null ? i : -1).filter(i => i >= 0);

  if (occupied.length === 0) {
    // Premiere carte : n'importe ou
    return [0, 1, 2, 3, 4, 5, 6, 7, 8];
  }

  // Positions adjacentes aux cartes existantes
  const adjacent = new Set<number>();

  for (const pos of occupied) {
    for (const adj of ADJACENCY_MAP[pos]) {
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

// =============================================================================
// Helpers pour le decalage du plateau
// =============================================================================

/** Verifie si le plateau peut etre decale dans une direction */
export function canShiftBoard(
  board: (PlacedCard | null)[],
  direction: ShiftDirection
): boolean {
  // Si le plateau est vide, pas de decalage possible
  const hasCards = board.some(c => c !== null);
  if (!hasCards) return false;

  switch (direction) {
    case 'left':
      // Possible si la colonne gauche (0, 3, 6) est vide
      return board[0] === null && board[3] === null && board[6] === null;
    case 'right':
      // Possible si la colonne droite (2, 5, 8) est vide
      return board[2] === null && board[5] === null && board[8] === null;
    case 'up':
      // Possible si la ligne du haut (0, 1, 2) est vide
      return board[0] === null && board[1] === null && board[2] === null;
    case 'down':
      // Possible si la ligne du bas (6, 7, 8) est vide
      return board[6] === null && board[7] === null && board[8] === null;
    default:
      return false;
  }
}

/** Retourne les directions de decalage possibles */
export function getAvailableShifts(board: (PlacedCard | null)[]): ShiftDirection[] {
  const directions: ShiftDirection[] = ['left', 'right', 'up', 'down'];
  return directions.filter(d => canShiftBoard(board, d));
}

/**
 * Zone externe pour placement avec shift automatique
 * Position apres shift + direction du shift necessaire
 */
export interface ExternalZone {
  position: number;           // Position finale apres shift (0-8)
  shiftDirection: ShiftDirection;  // Direction du shift a effectuer
  edge: 'left' | 'right' | 'top' | 'bottom';  // Bord du plateau
  edgeIndex: number;          // Index sur ce bord (0, 1, 2)
}

/**
 * Calcule les zones externes valides pour le placement
 * Une zone est valide si:
 * 1. Il y a une carte adjacente (orthogonale) dans la grille
 * 2. Le shift dans la direction opposee est possible
 */
export function getExternalZones(board: (PlacedCard | null)[]): ExternalZone[] {
  const zones: ExternalZone[] = [];

  // Zones a gauche (shift right pour faire de la place)
  if (canShiftBoard(board, 'right')) {
    // Position 0 si carte en 0, position 3 si carte en 3, position 6 si carte en 6
    if (board[0] !== null) zones.push({ position: 0, shiftDirection: 'right', edge: 'left', edgeIndex: 0 });
    if (board[3] !== null) zones.push({ position: 3, shiftDirection: 'right', edge: 'left', edgeIndex: 1 });
    if (board[6] !== null) zones.push({ position: 6, shiftDirection: 'right', edge: 'left', edgeIndex: 2 });
  }

  // Zones a droite (shift left pour faire de la place)
  if (canShiftBoard(board, 'left')) {
    if (board[2] !== null) zones.push({ position: 2, shiftDirection: 'left', edge: 'right', edgeIndex: 0 });
    if (board[5] !== null) zones.push({ position: 5, shiftDirection: 'left', edge: 'right', edgeIndex: 1 });
    if (board[8] !== null) zones.push({ position: 8, shiftDirection: 'left', edge: 'right', edgeIndex: 2 });
  }

  // Zones en haut (shift down pour faire de la place)
  if (canShiftBoard(board, 'down')) {
    if (board[0] !== null) zones.push({ position: 0, shiftDirection: 'down', edge: 'top', edgeIndex: 0 });
    if (board[1] !== null) zones.push({ position: 1, shiftDirection: 'down', edge: 'top', edgeIndex: 1 });
    if (board[2] !== null) zones.push({ position: 2, shiftDirection: 'down', edge: 'top', edgeIndex: 2 });
  }

  // Zones en bas (shift up pour faire de la place)
  if (canShiftBoard(board, 'up')) {
    if (board[6] !== null) zones.push({ position: 6, shiftDirection: 'up', edge: 'bottom', edgeIndex: 0 });
    if (board[7] !== null) zones.push({ position: 7, shiftDirection: 'up', edge: 'bottom', edgeIndex: 1 });
    if (board[8] !== null) zones.push({ position: 8, shiftDirection: 'up', edge: 'bottom', edgeIndex: 2 });
  }

  return zones;
}

/** Decale le plateau dans une direction */
export function shiftBoard(
  board: (PlacedCard | null)[],
  direction: ShiftDirection
): (PlacedCard | null)[] {
  if (!canShiftBoard(board, direction)) return board;

  const newBoard = Array(9).fill(null) as (PlacedCard | null)[];

  for (let i = 0; i < 9; i++) {
    if (board[i] === null) continue;

    let newPos: number;
    switch (direction) {
      case 'left':
        newPos = i - 1;
        break;
      case 'right':
        newPos = i + 1;
        break;
      case 'up':
        newPos = i - 3;
        break;
      case 'down':
        newPos = i + 3;
        break;
    }

    if (newPos >= 0 && newPos < 9) {
      newBoard[newPos] = { ...board[i]!, position: newPos };
    }
  }

  return newBoard;
}

// =============================================================================
// Logs de partie
// =============================================================================

export type LogActionType =
  | 'buy'           // Achat de carte
  | 'place'         // Placement de carte
  | 'effect'        // Effet de carte
  | 'key'           // Utilisation de cle
  | 'shift'         // Decalage plateau
  | 'other';        // Autre action

export interface GameLogEntry {
  id: string;                    // UUID unique
  timestamp: number;             // Date.now()
  turnNumber: number;
  playerName: string;
  playerColor: string;
  actionType: LogActionType;     // Type d'action pour l'icone
  cardName?: string;             // Nom de la carte (ex: "Devot") - pour buy
  description?: string;          // Description (position pour place, effet pour effect)
  position?: number;             // Position sur le plateau (0-8) - pour buy et place
  isFlipped?: boolean;           // Achat face cachee
  resourcesBefore?: { gold: number; keys: number };
  resourcesAfter?: { gold: number; keys: number };
}

// =============================================================================
// Choix de defausse (effets type "discard_village_gain_keys")
// =============================================================================

export interface DiscardChoice {
  location: Location;            // Lieu ou defausser (village ou castle)
  resource: 'gold' | 'keys';     // Ressource gagnee
  cardId: string;                // ID de la carte qui declenche l'effet
}

// =============================================================================
// Choix de remplacement de lieu (effets type "replace_location")
// =============================================================================

export type ReplaceLocationEffectType =
  | 'replace_location'                      // Remplacement simple
  | 'replace_location_gain_keys_per_feature'  // +X cles par carte avec feature
  | 'replace_location_gain_keys_per_shield';  // +X cles par carte avec bouclier

export interface ReplaceLocationChoice {
  effectType: ReplaceLocationEffectType;
  cardId: string;                // ID de la carte qui declenche l'effet
  position: number;              // Position de la carte avec cadenas
  // Parametres pour les variantes
  feature?: string;              // "price_reduction" ou "coin_purse"
  color?: ShieldColor;           // Couleur du bouclier
  keysPerCard?: number;          // Nombre de cles par carte
}

// =============================================================================
// Choix de carte adjacente (effet "activate_adjacent")
// =============================================================================

export interface AdjacentCardChoice {
  triggerPosition: number;       // Position de la carte avec l'effet activate_adjacent
  triggerCardId: string;         // ID de la carte declencheuse
  adjacentPositions: number[];   // Positions adjacentes valides (cartes avec effets)
}

// =============================================================================
// Choix de bourses a remplir (effet "fill_purses_select")
// =============================================================================

export interface PurseSelectionChoice {
  maxCards: number;              // Nombre max de cartes a selectionner (ex: 2)
  availablePositions: number[];  // Positions des cartes bourse non pleines
}
