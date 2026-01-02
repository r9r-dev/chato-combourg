/**
 * Game Engine - Moteur de jeu pour le mode "Jouer"
 *
 * Gere :
 * - L'initialisation d'une partie
 * - La validation et l'execution des actions
 * - La gestion des tours
 * - La fin de partie et le calcul des scores
 */

import type {
  PlayGameState,
  PlayGameConfig,
  PlayPlayer,
  CentralBoard,
  GameAction,
  PlacedCard,
  Location,
  PlayCard,
  CardCategory,
} from '../../types/play';

// Importer les helpers depuis les types
import { getValidPlacements as getValidPlacementsHelper, getEffectiveCost as getEffectiveCostHelper } from '../../types/play';

// =============================================================================
// Constantes
// =============================================================================

const INITIAL_GOLD = 15;
const INITIAL_KEYS = 2;
const FLIPPED_CARD_GOLD = 6;
const FLIPPED_CARD_KEYS = 2;
const FLIPPED_VILLAGE_ID = '089';
const FLIPPED_CASTLE_ID = '090';

// =============================================================================
// Chargement des donnees des cartes
// =============================================================================

let cardAttributesCache: Record<string, PlayCard> | null = null;

export async function loadCardData(): Promise<Record<string, PlayCard>> {
  if (cardAttributesCache) return cardAttributesCache;

  // Charger les attributs et les effets
  const [attributesResponse, effectsResponse] = await Promise.all([
    fetch('/api/cards/attributes'),
    fetch('/api/cards/effects'),
  ]);

  if (!attributesResponse.ok || !effectsResponse.ok) {
    throw new Error('Failed to load card data from API');
  }

  const attributes = await attributesResponse.json();
  const effects = await effectsResponse.json();

  cardAttributesCache = mergeCardData(attributes, effects);
  return cardAttributesCache;
}

function mergeCardData(
  attributes: Record<string, unknown>,
  effects: Record<string, unknown>
): Record<string, PlayCard> {
  const result: Record<string, PlayCard> = {};

  for (const [id, attrs] of Object.entries(attributes)) {
    const attr = attrs as {
      value: number;
      shields: { count: number; color: string }[];
      category: string | null;
      has_messenger: boolean;
      has_price_reduction: boolean;
      has_lock: boolean;
      has_coin_purse: boolean;
      max_coins: number;
    };

    const effect = (effects as Record<string, unknown>)[id] as {
      effects: unknown[];
      lock_effect: unknown | null;
    } | undefined;

    result[id] = {
      id,
      value: attr.value,
      shields: attr.shields as PlayCard['shields'],
      category: attr.category as CardCategory | null,
      has_messenger: attr.has_messenger,
      has_price_reduction: attr.has_price_reduction,
      has_lock: attr.has_lock,
      has_coin_purse: attr.has_coin_purse,
      max_coins: attr.max_coins,
      effects: effect?.effects as PlayCard['effects'] ?? [],
      lock_effect: effect?.lock_effect as PlayCard['lock_effect'] ?? null,
    };
  }

  return result;
}

export function getCard(cardId: string): PlayCard | undefined {
  return cardAttributesCache?.[cardId];
}

// =============================================================================
// Initialisation de la partie
// =============================================================================

export function createGame(config: PlayGameConfig): PlayGameState {
  const gameId = crypto.randomUUID();

  // Creer les joueurs
  const players: PlayPlayer[] = config.players.map((p, index) => ({
    id: p.isAI ? `ai-${p.aiLevel}-${index}` : `human-${index}`,
    name: p.name,
    color: p.color,
    isAI: p.isAI,
    aiLevel: p.aiLevel,
    gold: INITIAL_GOLD,
    keys: INITIAL_KEYS,
    reductionCastle: 0,
    reductionVillage: 0,
    board: Array(9).fill(null),
    lockedCards: new Map(),
  }));

  // Creer le plateau central
  const board = createCentralBoard(config.randomSeed);

  // Choisir le premier joueur aleatoirement
  const firstPlayerIndex = Math.floor(Math.random() * players.length);

  return {
    gameId,
    phase: 'playing',
    players,
    currentPlayerIndex: firstPlayerIndex,
    turnNumber: 1,
    turnPhase: 'pre_action',
    purchasedCard: null,
    purchasedCardCost: 0,
    board,
    actionHistory: [],
  };
}

function createCentralBoard(seed?: number): CentralBoard {
  // Generer la liste des cartes par categorie
  const castleCards: string[] = [];
  const villageCards: string[] = [];

  if (!cardAttributesCache) {
    throw new Error('Card data not loaded. Call loadCardData() first.');
  }

  for (const [id, card] of Object.entries(cardAttributesCache)) {
    if (card.category === 'castle') {
      castleCards.push(id);
    } else if (card.category === 'village') {
      villageCards.push(id);
    }
  }

  // Melanger les pioches
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;
  shuffle(castleCards, rng);
  shuffle(villageCards, rng);

  return {
    castleCards: castleCards.splice(0, 3),
    villageCards: villageCards.splice(0, 3),
    messengerLocation: 'village',
    castleDeck: castleCards,
    villageDeck: villageCards,
    castleDiscard: [],
    villageDiscard: [],
  };
}

// =============================================================================
// Validation des actions
// =============================================================================

export interface ActionValidation {
  isValid: boolean;
  reason?: string;
}

export function validateAction(
  state: PlayGameState,
  action: GameAction
): ActionValidation {
  const player = state.players.find(p => p.id === action.playerId);
  if (!player) {
    return { isValid: false, reason: 'Joueur non trouve' };
  }

  if (state.players[state.currentPlayerIndex].id !== action.playerId) {
    return { isValid: false, reason: "Ce n'est pas votre tour" };
  }

  switch (action.type) {
    case 'use_key_on_lock':
      return validateUseKeyOnLock(state, player, action);

    case 'spend_key':
      return validateSpendKey(state, player, action);

    case 'buy_card':
    case 'buy_card_flipped':
      return validateBuyCard(state, player, action);

    case 'place_card':
      return validatePlaceCard(state, player, action);

    case 'choose_effect':
      return validateChooseEffect(state, player, action);

    case 'end_turn':
      return validateEndTurn(state);

    default:
      return { isValid: false, reason: 'Action inconnue' };
  }
}

function validateUseKeyOnLock(
  state: PlayGameState,
  player: PlayPlayer,
  action: GameAction
): ActionValidation {
  if (state.turnPhase !== 'pre_action' && state.turnPhase !== 'post_action') {
    return { isValid: false, reason: 'Vous ne pouvez pas utiliser de cadenas maintenant' };
  }

  if (action.lockPosition === undefined) {
    return { isValid: false, reason: 'Position du cadenas non specifiee' };
  }

  const hasKey = player.lockedCards.get(action.lockPosition);
  if (!hasKey) {
    return { isValid: false, reason: 'Pas de cle disponible sur cette carte' };
  }

  return { isValid: true };
}

function validateSpendKey(
  state: PlayGameState,
  player: PlayPlayer,
  action: GameAction
): ActionValidation {
  if (state.turnPhase !== 'pre_action') {
    return { isValid: false, reason: 'Vous ne pouvez depenser une cle que avant l\'achat' };
  }

  if (player.keys < 1) {
    return { isValid: false, reason: 'Vous n\'avez pas de cle' };
  }

  if (!action.targetLocation) {
    return { isValid: false, reason: 'Action cible non specifiee' };
  }

  return { isValid: true };
}

function validateBuyCard(
  state: PlayGameState,
  player: PlayPlayer,
  action: GameAction
): ActionValidation {
  if (state.turnPhase !== 'pre_action' && state.turnPhase !== 'buy') {
    return { isValid: false, reason: 'Vous ne pouvez pas acheter maintenant' };
  }

  if (!action.cardId) {
    return { isValid: false, reason: 'Carte non specifiee' };
  }

  // Verifier que la carte est disponible
  const availableCards = state.board.messengerLocation === 'castle'
    ? state.board.castleCards
    : state.board.villageCards;

  if (!availableCards.includes(action.cardId)) {
    return { isValid: false, reason: 'Cette carte n\'est pas disponible' };
  }

  // Verifier le cout (sauf si carte retournee)
  if (action.type === 'buy_card') {
    const card = getCard(action.cardId);
    if (!card) {
      return { isValid: false, reason: 'Carte inconnue' };
    }

    const cost = getEffectiveCostHelper(
      card.value,
      card.category,
      player.reductionCastle,
      player.reductionVillage
    );

    if (player.gold < cost) {
      return { isValid: false, reason: `Vous n'avez pas assez d'or (${player.gold}/${cost})` };
    }
  }

  return { isValid: true };
}

function validatePlaceCard(
  state: PlayGameState,
  player: PlayPlayer,
  action: GameAction
): ActionValidation {
  if (state.turnPhase !== 'place') {
    return { isValid: false, reason: 'Vous ne pouvez pas placer de carte maintenant' };
  }

  if (!state.purchasedCard) {
    return { isValid: false, reason: 'Aucune carte a placer' };
  }

  if (action.position === undefined || action.position < 0 || action.position > 8) {
    return { isValid: false, reason: 'Position invalide' };
  }

  const validPositions = getValidPlacementsHelper(player.board);
  if (!validPositions.includes(action.position)) {
    return { isValid: false, reason: 'Position non valide pour le placement' };
  }

  return { isValid: true };
}

function validateChooseEffect(
  state: PlayGameState,
  _player: PlayPlayer,
  action: GameAction
): ActionValidation {
  if (state.turnPhase !== 'effect') {
    return { isValid: false, reason: 'Pas de choix d\'effet a faire' };
  }

  if (action.choiceIndex === undefined) {
    return { isValid: false, reason: 'Choix non specifie' };
  }

  return { isValid: true };
}

function validateEndTurn(state: PlayGameState): ActionValidation {
  if (state.turnPhase !== 'post_action' && state.turnPhase !== 'end') {
    return { isValid: false, reason: 'Vous devez terminer vos actions obligatoires' };
  }

  return { isValid: true };
}

// =============================================================================
// Execution des actions
// =============================================================================

export function executeAction(
  state: PlayGameState,
  action: GameAction
): PlayGameState {
  const validation = validateAction(state, action);
  if (!validation.isValid) {
    console.error('Invalid action:', validation.reason);
    return state;
  }

  let newState = { ...state };
  newState.actionHistory = [...state.actionHistory, action];

  switch (action.type) {
    case 'use_key_on_lock':
      newState = executeUseKeyOnLock(newState, action);
      break;

    case 'spend_key':
      newState = executeSpendKey(newState, action);
      break;

    case 'buy_card':
      newState = executeBuyCard(newState, action, false);
      break;

    case 'buy_card_flipped':
      newState = executeBuyCard(newState, action, true);
      break;

    case 'place_card':
      newState = executePlaceCard(newState, action);
      break;

    case 'choose_effect':
      newState = executeChooseEffect(newState, action);
      break;

    case 'end_turn':
      newState = executeEndTurn(newState);
      break;
  }

  return newState;
}

function executeUseKeyOnLock(
  state: PlayGameState,
  action: GameAction
): PlayGameState {
  const playerIndex = state.currentPlayerIndex;
  const players = [...state.players];
  const player = { ...players[playerIndex] };

  // Retirer la cle du cadenas
  const lockedCards = new Map(player.lockedCards);
  lockedCards.set(action.lockPosition!, false);
  player.lockedCards = lockedCards;

  // L'effet du cadenas sera applique par l'executeur d'effets
  players[playerIndex] = player;

  return { ...state, players };
}

function executeSpendKey(
  state: PlayGameState,
  action: GameAction
): PlayGameState {
  const playerIndex = state.currentPlayerIndex;
  const players = [...state.players];
  const player = { ...players[playerIndex] };

  // Depenser la cle
  player.keys -= 1;
  players[playerIndex] = player;

  // Appliquer l'action (deplacer messager ou refresh)
  let board = { ...state.board };

  if (action.targetLocation && action.targetLocation !== board.messengerLocation) {
    // Deplacer le messager
    board.messengerLocation = action.targetLocation;
  } else {
    // Refresh du lieu actuel
    board = refreshLocation(board, board.messengerLocation);
  }

  return { ...state, players, board };
}

function executeBuyCard(
  state: PlayGameState,
  action: GameAction,
  isFlipped: boolean
): PlayGameState {
  const playerIndex = state.currentPlayerIndex;
  const players = [...state.players];
  const player = { ...players[playerIndex] };

  const cardId = action.cardId!;
  const card = getCard(cardId);

  let cost = 0;

  if (!isFlipped && card) {
    // Calculer et payer le cout
    cost = getEffectiveCostHelper(
      card.value,
      card.category,
      player.reductionCastle,
      player.reductionVillage
    );
    player.gold -= cost;
  }

  if (isFlipped) {
    // Bonus carte retournee
    player.gold += FLIPPED_CARD_GOLD;
    player.keys += FLIPPED_CARD_KEYS;
  }

  players[playerIndex] = player;

  // Retirer la carte du plateau central
  let board = { ...state.board };
  if (board.messengerLocation === 'castle') {
    board.castleCards = board.castleCards.filter(c => c !== cardId);
  } else {
    board.villageCards = board.villageCards.filter(c => c !== cardId);
  }

  // Determiner la carte a placer (retournee = 089 ou 090)
  let purchasedCard = cardId;
  if (isFlipped) {
    purchasedCard = card?.category === 'village' ? FLIPPED_VILLAGE_ID : FLIPPED_CASTLE_ID;
  }

  return {
    ...state,
    players,
    board,
    purchasedCard,
    purchasedCardCost: cost,
    turnPhase: 'place',
  };
}

function executePlaceCard(
  state: PlayGameState,
  action: GameAction
): PlayGameState {
  const playerIndex = state.currentPlayerIndex;
  const players = [...state.players];
  const player = { ...players[playerIndex] };

  const cardId = state.purchasedCard!;
  const card = getCard(cardId);
  const position = action.position!;

  // Placer la carte
  const board = [...player.board];
  const placedCard: PlacedCard = {
    cardId,
    position,
    coinsOnCard: 0,
    hasKeyOnLock: card?.has_lock ?? false,
    isFlipped: cardId === FLIPPED_VILLAGE_ID || cardId === FLIPPED_CASTLE_ID,
  };
  board[position] = placedCard;
  player.board = board;

  // Si la carte a un cadenas, enregistrer qu'elle a une cle
  if (card?.has_lock) {
    const lockedCards = new Map(player.lockedCards);
    lockedCards.set(position, true);
    player.lockedCards = lockedCards;
  }

  players[playerIndex] = player;

  return {
    ...state,
    players,
    purchasedCard: null,
    turnPhase: 'effect',
  };
}

function executeChooseEffect(
  state: PlayGameState,
  _action: GameAction
): PlayGameState {
  // L'effet sera applique par l'executeur d'effets
  // On passe juste a la phase suivante
  return { ...state, turnPhase: 'post_action' };
}

function executeEndTurn(state: PlayGameState): PlayGameState {
  // Completer les lieux
  let board = refillLocations(state.board);

  // Deplacer le messager si la carte a l'icone messager
  const player = state.players[state.currentPlayerIndex];
  const lastPlacedPosition = player.board.findIndex(
    (c, i) => c !== null && state.actionHistory.some(
      a => a.type === 'place_card' && a.position === i
    )
  );

  if (lastPlacedPosition >= 0) {
    const placedCard = player.board[lastPlacedPosition];
    if (placedCard) {
      const card = getCard(placedCard.cardId);
      if (card?.has_messenger) {
        board = {
          ...board,
          messengerLocation: board.messengerLocation === 'castle' ? 'village' : 'castle',
        };
      }
    }
  }

  // Passer au joueur suivant
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  // Verifier si la partie est terminee
  const isFirstPlayerAgain = nextPlayerIndex === 0 ||
    (nextPlayerIndex < state.currentPlayerIndex);

  let turnNumber = state.turnNumber;
  if (isFirstPlayerAgain) {
    turnNumber += 1;
  }

  // Verifier si tous les joueurs ont 9 cartes
  const gameEnded = state.players.every(
    p => p.board.filter(c => c !== null).length === 9
  );

  if (gameEnded) {
    return {
      ...state,
      board,
      phase: 'ended',
      turnPhase: 'end',
    };
  }

  return {
    ...state,
    board,
    currentPlayerIndex: nextPlayerIndex,
    turnNumber,
    turnPhase: 'pre_action',
    actionHistory: [], // Reset pour le nouveau tour
  };
}

// =============================================================================
// Helpers pour le plateau central
// =============================================================================

function refreshLocation(board: CentralBoard, location: Location): CentralBoard {
  const newBoard = { ...board };

  if (location === 'castle') {
    // Defausser les cartes actuelles
    newBoard.castleDiscard = [...newBoard.castleDiscard, ...newBoard.castleCards];
    newBoard.castleCards = [];

    // Piocher 3 nouvelles cartes
    if (newBoard.castleDeck.length < 3) {
      // Remelanger la defausse
      const reshuffled = [...newBoard.castleDiscard];
      shuffle(reshuffled);
      newBoard.castleDeck = [...newBoard.castleDeck, ...reshuffled];
      newBoard.castleDiscard = [];
    }
    newBoard.castleCards = newBoard.castleDeck.splice(0, 3);
  } else {
    // Meme logique pour le village
    newBoard.villageDiscard = [...newBoard.villageDiscard, ...newBoard.villageCards];
    newBoard.villageCards = [];

    if (newBoard.villageDeck.length < 3) {
      const reshuffled = [...newBoard.villageDiscard];
      shuffle(reshuffled);
      newBoard.villageDeck = [...newBoard.villageDeck, ...reshuffled];
      newBoard.villageDiscard = [];
    }
    newBoard.villageCards = newBoard.villageDeck.splice(0, 3);
  }

  return newBoard;
}

function refillLocations(board: CentralBoard): CentralBoard {
  let newBoard = { ...board };

  // Remplir le chateau
  while (newBoard.castleCards.length < 3 && newBoard.castleDeck.length > 0) {
    const card = newBoard.castleDeck.shift();
    if (card) newBoard.castleCards.push(card);
  }

  // Si la pioche est vide, remelanger la defausse
  if (newBoard.castleCards.length < 3 && newBoard.castleDiscard.length > 0) {
    const reshuffled = [...newBoard.castleDiscard];
    shuffle(reshuffled);
    newBoard.castleDeck = reshuffled;
    newBoard.castleDiscard = [];

    while (newBoard.castleCards.length < 3 && newBoard.castleDeck.length > 0) {
      const card = newBoard.castleDeck.shift();
      if (card) newBoard.castleCards.push(card);
    }
  }

  // Meme logique pour le village
  while (newBoard.villageCards.length < 3 && newBoard.villageDeck.length > 0) {
    const card = newBoard.villageDeck.shift();
    if (card) newBoard.villageCards.push(card);
  }

  if (newBoard.villageCards.length < 3 && newBoard.villageDiscard.length > 0) {
    const reshuffled = [...newBoard.villageDiscard];
    shuffle(reshuffled);
    newBoard.villageDeck = reshuffled;
    newBoard.villageDiscard = [];

    while (newBoard.villageCards.length < 3 && newBoard.villageDeck.length > 0) {
      const card = newBoard.villageDeck.shift();
      if (card) newBoard.villageCards.push(card);
    }
  }

  return newBoard;
}

// =============================================================================
// Utilitaires
// =============================================================================

function shuffle<T>(array: T[], rng: () => number = Math.random): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

// =============================================================================
// Helpers publics
// =============================================================================

export function getCurrentPlayer(state: PlayGameState): PlayPlayer {
  return state.players[state.currentPlayerIndex];
}

export function getAvailableCards(state: PlayGameState): string[] {
  return state.board.messengerLocation === 'castle'
    ? state.board.castleCards
    : state.board.villageCards;
}

export function canAffordCard(
  player: PlayPlayer,
  cardId: string
): { canAfford: boolean; cost: number } {
  const card = getCard(cardId);
  if (!card) return { canAfford: false, cost: 0 };

  const cost = getEffectiveCostHelper(
    card.value,
    card.category,
    player.reductionCastle,
    player.reductionVillage
  );

  return { canAfford: player.gold >= cost, cost };
}

export function isGameEnded(state: PlayGameState): boolean {
  return state.phase === 'ended';
}

export function getPlayerCardsCount(player: PlayPlayer): number {
  return player.board.filter(c => c !== null).length;
}
