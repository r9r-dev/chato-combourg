/**
 * Moteur de simulation de parties
 *
 * Execute des parties completes sans dependance au navigateur.
 * Utilise uniquement le backend pour charger les cartes.
 */

import type {
  PlayGameState,
  PlayPlayer,
  CentralBoard,
  PlayCard,
  GameAction,
  PlacedCard,
  CardEffect,
  ShieldColor,
} from '../types/play';
import { getValidPlacements, getEffectiveCost, shiftBoard, canShiftBoard } from '../types/play';
import type {
  SimConfig,
  SerializedGameState,
  SerializedPlayer,
} from './types';
import { calculatePlayerScore } from '../services/play/ai/evaluator/scoreCalculator';

// =============================================================================
// Helpers pour les effets
// =============================================================================

function countShieldsOnBoard(
  player: PlayPlayer,
  color: ShieldColor,
  cards: Map<string, PlayCard>
): number {
  let count = 0;
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      if (shield.color === color) {
        count += shield.count;
      }
    }
  }
  return count;
}

function countUniqueShieldColors(
  player: PlayPlayer,
  cards: Map<string, PlayCard>
): number {
  const colors = new Set<ShieldColor>();
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (!card) continue;
    for (const shield of card.shields) {
      colors.add(shield.color);
    }
  }
  return colors.size;
}

function countCardsOfCategory(
  player: PlayPlayer,
  category: 'castle' | 'village',
  cards: Map<string, PlayCard>
): number {
  let count = 0;
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (card?.category === category) {
      count++;
    }
  }
  return count;
}

function countCardsWithFeature(
  player: PlayPlayer,
  feature: 'has_coin_purse' | 'has_price_reduction' | 'has_lock',
  cards: Map<string, PlayCard>
): number {
  let count = 0;
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (card && card[feature]) {
      count++;
    }
  }
  return count;
}

function countCardsWithShieldCount(
  player: PlayPlayer,
  shieldCount: number,
  cards: Map<string, PlayCard>
): number {
  let count = 0;
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (!card) continue;
    const total = card.shields.reduce((sum, s) => sum + s.count, 0);
    if (total === shieldCount) {
      count++;
    }
  }
  return count;
}

function countCardsWithValue(
  player: PlayPlayer,
  value: number,
  cards: Map<string, PlayCard>
): number {
  let count = 0;
  for (const placed of player.board) {
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (card?.value === value) {
      count++;
    }
  }
  return count;
}

/**
 * Fill purses on the player's board (automatic selection, fill in order)
 */
function fillPurses(
  player: PlayPlayer,
  amount: number,
  cards: Map<string, PlayCard>
): void {
  // Ajoute `amount` pieces sur CHAQUE carte avec une bourse (depuis la reserve, pas du joueur)
  for (let i = 0; i < player.board.length; i++) {
    const placed = player.board[i];
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (!card?.has_coin_purse) continue;

    const maxCoins = card.max_coins;
    const currentCoins = placed.coinsOnCard;
    const canAdd = Math.min(amount, maxCoins - currentCoins);

    if (canAdd > 0) {
      placed.coinsOnCard = currentCoins + canAdd;
    }
  }
}

/**
 * Fill purses selectively (fill ALL selected purses to max)
 * In simulation: auto-select purses with highest capacity
 */
function fillPursesSelect(
  player: PlayPlayer,
  maxCards: number,
  cards: Map<string, PlayCard>
): void {
  // Find non-full purses
  const nonFullPurses: { index: number; canAdd: number }[] = [];
  for (let i = 0; i < player.board.length; i++) {
    const placed = player.board[i];
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (!card?.has_coin_purse) continue;

    const canAdd = card.max_coins - placed.coinsOnCard;
    if (canAdd > 0) {
      nonFullPurses.push({ index: i, canAdd });
    }
  }

  // Sort by capacity (fill biggest purses first)
  nonFullPurses.sort((a, b) => b.canAdd - a.canAdd);

  // Fill top N purses to max
  const toFill = nonFullPurses.slice(0, maxCards);
  for (const purse of toFill) {
    const placed = player.board[purse.index];
    if (!placed) continue;
    const card = cards.get(placed.cardId);
    if (!card) continue;
    placed.coinsOnCard = card.max_coins;
  }
}

/**
 * Execute a single card effect during simulation
 */
function executeSimEffect(
  effect: CardEffect,
  player: PlayPlayer,
  state: PlayGameState,
  cards: Map<string, PlayCard>
): void {
  switch (effect.type) {
    // Simple gains
    case 'gain_gold':
      player.gold += effect.amount ?? 0;
      break;

    case 'gain_keys':
      player.keys += effect.amount ?? 0;
      break;

    // Gains per shield
    case 'gain_gold_per_shield':
      player.gold += countShieldsOnBoard(player, effect.color!, cards) * (effect.amount ?? 1);
      break;

    case 'gain_keys_per_shield':
      player.keys += countShieldsOnBoard(player, effect.color!, cards) * (effect.amount ?? 1);
      break;

    // Gains per unique shield colors
    case 'gain_gold_per_unique_shield':
      player.gold += countUniqueShieldColors(player, cards) * (effect.amount ?? 1);
      break;

    case 'gain_keys_per_unique_shield':
      player.keys += countUniqueShieldColors(player, cards) * (effect.amount ?? 1);
      break;

    // Gains per missing shields (6 - unique colors)
    case 'gain_keys_per_missing_shield':
      player.keys += (6 - countUniqueShieldColors(player, cards)) * (effect.amount ?? 1);
      break;

    // Gains per card
    case 'gain_gold_per_card':
      player.gold += player.board.filter(c => c !== null).length * (effect.amount ?? 1);
      break;

    // Gains per category
    case 'gain_gold_per_castle':
      player.gold += countCardsOfCategory(player, 'castle', cards) * (effect.amount ?? 1);
      break;

    case 'gain_gold_per_village':
      player.gold += countCardsOfCategory(player, 'village', cards) * (effect.amount ?? 1);
      break;

    case 'gain_keys_per_castle':
      player.keys += countCardsOfCategory(player, 'castle', cards) * (effect.amount ?? 1);
      break;

    case 'gain_keys_per_village':
      player.keys += countCardsOfCategory(player, 'village', cards) * (effect.amount ?? 1);
      break;

    // Gains per empty slot
    case 'gain_gold_per_empty_slot':
      player.gold += player.board.filter(c => c === null).length * (effect.amount ?? 1);
      break;

    // Gains per card with shield count
    case 'gain_gold_per_card_with_shields':
      player.gold += countCardsWithShieldCount(player, effect.shield_count ?? 1, cards) * (effect.amount ?? 1);
      break;

    case 'gain_keys_per_card_with_shields':
      player.keys += countCardsWithShieldCount(player, effect.shield_count ?? 1, cards) * (effect.amount ?? 1);
      break;

    // Gains per card with value
    case 'gain_gold_per_card_with_value':
      player.gold += countCardsWithValue(player, effect.value ?? 0, cards) * (effect.amount ?? 1);
      break;

    // Gains per card with purse
    case 'gain_gold_per_card_with_purse':
      player.gold += countCardsWithFeature(player, 'has_coin_purse', cards) * (effect.amount ?? 1);
      break;

    case 'gain_keys_per_card_with_purse':
      player.keys += countCardsWithFeature(player, 'has_coin_purse', cards) * (effect.amount ?? 1);
      break;

    // Reductions (already handled via has_price_reduction, but some effects add extra)
    case 'reduction_castle':
      player.reductionCastle += 1;
      break;

    case 'reduction_village':
      player.reductionVillage += 1;
      break;

    case 'reduction_both':
      player.reductionCastle += 1;
      player.reductionVillage += 1;
      break;

    // Fill purses
    case 'fill_purses':
      fillPurses(player, effect.amount ?? 2, cards);
      break;

    case 'fill_purses_select':
      fillPursesSelect(player, effect.max_cards ?? 2, cards);
      break;

    // Choice effects - pick first option in simulation
    case 'choice':
      if (effect.options && effect.options.length > 0) {
        executeSimEffect(effect.options[0], player, state, cards);
      }
      break;

    // Effects on opponents - apply to all other players
    case 'all_opponents_gain_gold':
      for (let i = 0; i < state.players.length; i++) {
        if (i !== state.currentPlayerIndex) {
          state.players[i].gold += effect.amount ?? 1;
        }
      }
      break;

    case 'all_opponents_gain_keys':
      for (let i = 0; i < state.players.length; i++) {
        if (i !== state.currentPlayerIndex) {
          state.players[i].keys += effect.amount ?? 1;
        }
      }
      break;

    case 'all_players_gain_keys':
      for (let i = 0; i < state.players.length; i++) {
        state.players[i].keys += effect.amount ?? 1;
      }
      break;

    // Neighbor effects - use max from left/right neighbors
    case 'gain_gold_per_shield_neighbor':
    case 'gain_keys_per_shield_neighbor': {
      const neighbors = getNeighborPlayers(state, state.currentPlayerIndex);
      let maxCount = 0;
      for (const neighbor of neighbors) {
        const count = countShieldsOnBoard(neighbor, effect.color!, cards);
        maxCount = Math.max(maxCount, count);
      }
      const gain = maxCount * (effect.amount ?? 1);
      if (effect.type === 'gain_gold_per_shield_neighbor') {
        player.gold += gain;
      } else {
        player.keys += gain;
      }
      break;
    }

    case 'gain_keys_per_castle_neighbor':
    case 'gain_gold_per_castle_neighbor': {
      const neighbors = getNeighborPlayers(state, state.currentPlayerIndex);
      let maxCount = 0;
      for (const neighbor of neighbors) {
        const count = countCardsOfCategory(neighbor, 'castle', cards);
        maxCount = Math.max(maxCount, count);
      }
      const gain = maxCount * (effect.amount ?? 1);
      if (effect.type === 'gain_gold_per_castle_neighbor') {
        player.gold += gain;
      } else {
        player.keys += gain;
      }
      break;
    }

    // Discard effects - skip in simulation (would need card selection)
    case 'discard_village_gain_gold':
    case 'discard_village_gain_keys':
    case 'discard_castle_gain_gold':
      // Skip - requires interaction
      break;

    // Lock effects - skip in simulation (handled separately)
    case 'replace_location':
    case 'replace_location_gain_keys_per_feature':
    case 'replace_location_gain_keys_per_shield':
    case 'activate_adjacent':
      // Skip - lock effects not executed on place
      break;

    default:
      // Unknown effect, skip silently
      break;
  }
}

/**
 * Get neighbor players (left and right in player order)
 */
function getNeighborPlayers(state: PlayGameState, playerIndex: number): PlayPlayer[] {
  const numPlayers = state.players.length;
  if (numPlayers < 2) return [];

  const neighbors: PlayPlayer[] = [];
  const leftIndex = (playerIndex - 1 + numPlayers) % numPlayers;
  const rightIndex = (playerIndex + 1) % numPlayers;

  neighbors.push(state.players[leftIndex]);
  if (numPlayers > 2 && leftIndex !== rightIndex) {
    neighbors.push(state.players[rightIndex]);
  }

  return neighbors;
}

// =============================================================================
// Chargement des cartes
// =============================================================================

let cardsCache: Map<string, PlayCard> | null = null;

export async function loadCards(backendUrl: string = 'http://localhost:8080'): Promise<Map<string, PlayCard>> {
  if (cardsCache && cardsCache.size > 0) {
    return cardsCache;
  }

  const [attributesResponse, effectsResponse] = await Promise.all([
    fetch(`${backendUrl}/api/cards/attributes`),
    fetch(`${backendUrl}/api/cards/effects`),
  ]);

  if (!attributesResponse.ok || !effectsResponse.ok) {
    throw new Error(`Backend non disponible a ${backendUrl}`);
  }

  const attributes = await attributesResponse.json();
  const effects = await effectsResponse.json();

  cardsCache = new Map();

  for (const [id, attrs] of Object.entries(attributes)) {
    const attr = attrs as any;
    const effect = (effects as any)[id];

    cardsCache.set(id, {
      id,
      value: attr.value,
      shields: attr.shields,
      category: attr.category,
      has_messenger: effect?.has_messenger ?? false,
      has_price_reduction: attr.has_price_reduction,
      has_lock: attr.has_lock,
      has_coin_purse: attr.has_coin_purse,
      max_coins: attr.max_coins,
      effects: effect?.effects ?? [],
      lock_effect: effect?.lock_effect ?? null,
    });
  }

  return cardsCache;
}

export function getCardsCache(): Map<string, PlayCard> {
  return cardsCache ?? new Map();
}

// =============================================================================
// Creation de partie
// =============================================================================

const INITIAL_GOLD = 15;
const INITIAL_KEYS = 2;
const PLAYER_COLORS = ['#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

function shuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(
  config: SimConfig,
  cards: Map<string, PlayCard>
): PlayGameState {
  const rng = config.seed !== undefined ? seededRandom(config.seed) : Math.random;

  // Creer les joueurs
  const players: PlayPlayer[] = config.players.map((p, index) => ({
    id: p.type === 'ai' ? `ai-${p.aiLevel}-${index}` : `human-${index}`,
    name: p.name,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    isAI: p.type === 'ai',
    aiLevel: p.aiLevel,
    gold: INITIAL_GOLD,
    keys: INITIAL_KEYS,
    reductionCastle: 0,
    reductionVillage: 0,
    board: Array(9).fill(null),
    lockedCards: new Map(),
  }));

  // Separer les cartes par categorie
  const castleCards: string[] = [];
  const villageCards: string[] = [];

  for (const [id, card] of cards) {
    if (card.category === 'castle') castleCards.push(id);
    else if (card.category === 'village') villageCards.push(id);
  }

  const shuffledCastle = shuffle(castleCards, rng);
  const shuffledVillage = shuffle(villageCards, rng);

  const board: CentralBoard = {
    castleCards: shuffledCastle.splice(0, 3),
    villageCards: shuffledVillage.splice(0, 3),
    messengerLocation: 'village',
    castleDeck: shuffledCastle,
    villageDeck: shuffledVillage,
    castleDiscard: [],
    villageDiscard: [],
  };

  // Premier joueur aleatoire
  const firstPlayerIndex = Math.floor(rng() * players.length);

  return {
    gameId: `sim-${Date.now()}-${Math.floor(rng() * 10000)}`,
    phase: 'playing',
    players,
    currentPlayerIndex: firstPlayerIndex,
    turnNumber: 1,
    turnPhase: 'pre_action',
    keyUsedThisTurn: false,
    lockUsedThisTurn: false,
    purchasedCard: null,
    purchasedCardCost: 0,
    board,
    actionHistory: [],
  };
}

// =============================================================================
// Execution des actions
// =============================================================================

function getAvailableCards(state: PlayGameState): string[] {
  return state.board.messengerLocation === 'castle'
    ? state.board.castleCards
    : state.board.villageCards;
}

function refillCards(board: CentralBoard): CentralBoard {
  const newBoard = { ...board };

  while (newBoard.castleCards.length < 3 && newBoard.castleDeck.length > 0) {
    newBoard.castleCards.push(newBoard.castleDeck.shift()!);
  }

  while (newBoard.villageCards.length < 3 && newBoard.villageDeck.length > 0) {
    newBoard.villageCards.push(newBoard.villageDeck.shift()!);
  }

  return newBoard;
}

export function executeAction(
  state: PlayGameState,
  action: GameAction,
  cards: Map<string, PlayCard>
): PlayGameState {
  const playerIndex = state.currentPlayerIndex;
  const players = state.players.map(p => ({
    ...p,
    board: [...p.board],
    lockedCards: new Map(p.lockedCards),
  }));
  const player = players[playerIndex];
  // Deep clone board to avoid mutations affecting other branches (MCTS)
  let board = {
    ...state.board,
    castleCards: [...state.board.castleCards],
    villageCards: [...state.board.villageCards],
    castleDeck: [...state.board.castleDeck],
    villageDeck: [...state.board.villageDeck],
    castleDiscard: [...state.board.castleDiscard],
    villageDiscard: [...state.board.villageDiscard],
  };

  switch (action.type) {
    case 'buy_card': {
      const cardId = action.cardId!;
      const card = cards.get(cardId)!;
      const cost = getEffectiveCost(card.value, card.category, player.reductionCastle, player.reductionVillage);
      player.gold -= cost;

      if (board.messengerLocation === 'castle') {
        board.castleCards = board.castleCards.filter(c => c !== cardId);
      } else {
        board.villageCards = board.villageCards.filter(c => c !== cardId);
      }

      return {
        ...state,
        players,
        board,
        purchasedCard: cardId,
        purchasedCardCost: cost,
        turnPhase: 'place',
      };
    }

    case 'buy_card_flipped': {
      const cardId = action.cardId!;
      const card = cards.get(cardId);
      const flippedId = card?.category === 'village' ? '089' : '090';

      if (board.messengerLocation === 'castle') {
        board.castleCards = board.castleCards.filter(c => c !== cardId);
      } else {
        board.villageCards = board.villageCards.filter(c => c !== cardId);
      }

      player.gold += 6;
      player.keys += 2;

      return {
        ...state,
        players,
        board,
        purchasedCard: flippedId,
        purchasedCardCost: 0,
        turnPhase: 'place',
      };
    }

    case 'place_card': {
      const cardId = state.purchasedCard!;
      const card = cards.get(cardId);
      const position = action.position!;

      // Si un shift est demande, l'appliquer d'abord
      if (action.shiftDirection && canShiftBoard(player.board, action.shiftDirection)) {
        const shiftedBoard = shiftBoard(player.board, action.shiftDirection);

        // Mettre a jour les positions dans lockedCards
        const newLockedCards = new Map<number, boolean>();
        for (const [oldPos, hasKey] of player.lockedCards) {
          const oldCard = player.board[oldPos];
          if (oldCard) {
            const newPos = shiftedBoard.findIndex(c => c !== null && c.cardId === oldCard.cardId);
            if (newPos >= 0) {
              newLockedCards.set(newPos, hasKey);
            }
          }
        }

        player.board = shiftedBoard;
        player.lockedCards = newLockedCards;
      }

      const placedCard: PlacedCard = {
        cardId,
        position,
        coinsOnCard: 0,
        hasKeyOnLock: card?.has_lock ?? false,
        isFlipped: cardId === '089' || cardId === '090',
      };

      player.board[position] = placedCard;

      if (card?.has_lock) {
        player.lockedCards.set(position, true);
      }

      if (card?.has_price_reduction) {
        if (card.category === 'castle') {
          player.reductionCastle += 1;
        } else if (card.category === 'village') {
          player.reductionVillage += 1;
        }
      }

      if (card?.has_messenger) {
        board.messengerLocation = board.messengerLocation === 'castle' ? 'village' : 'castle';
      }

      // Appliquer tous les effets de la carte
      for (const effect of card?.effects ?? []) {
        executeSimEffect(effect, player, { ...state, players, board }, cards);
      }

      board = refillCards(board);

      return {
        ...state,
        players,
        board,
        purchasedCard: null,
        turnPhase: 'post_action',
      };
    }

    case 'spend_key': {
      player.keys -= 1;

      if (action.targetLocation !== board.messengerLocation) {
        board.messengerLocation = action.targetLocation!;
      } else {
        if (action.targetLocation === 'castle') {
          board.castleDiscard.push(...board.castleCards);
          board.castleCards = [];
        } else {
          board.villageDiscard.push(...board.villageCards);
          board.villageCards = [];
        }
        board = refillCards(board);
      }

      return {
        ...state,
        players,
        board,
        keyUsedThisTurn: true,
      };
    }

    case 'use_key_on_lock': {
      const lockPosition = action.lockPosition;
      if (lockPosition === undefined) {
        return state;
      }

      const placed = player.board[lockPosition];
      if (!placed || !player.lockedCards.get(lockPosition)) {
        // Position invalide ou pas de cadenas
        return state;
      }

      // Marquer le cadenas comme utilisé
      player.lockedCards.set(lockPosition, false);
      player.keys -= 1;

      // Exécuter l'effet du cadenas
      const card = cards.get(placed.cardId);
      if (card?.lock_effect) {
        executeSimEffect(card.lock_effect, player, { ...state, players, board }, cards);
      }

      return {
        ...state,
        players,
        board,
        lockUsedThisTurn: true,
      };
    }

    case 'end_turn': {
      const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      const newTurnNumber = nextPlayerIndex === 0 ? state.turnNumber + 1 : state.turnNumber;

      const allFull = players.every(p => p.board.filter(c => c !== null).length === 9);

      if (allFull) {
        // Fin de partie: remplir les bourses avec l'or restant
        const finalPlayers = players.map(player => {
          const updatedPlayer = { ...player, board: [...player.board] };
          let remainingGold = updatedPlayer.gold;

          // Parcourir le plateau et remplir les bourses
          for (let i = 0; i < updatedPlayer.board.length && remainingGold > 0; i++) {
            const placed = updatedPlayer.board[i];
            if (!placed) continue;

            const card = cards.get(placed.cardId);
            if (!card?.has_coin_purse) continue;

            const maxCoins = card.max_coins;
            const currentCoins = placed.coinsOnCard;
            const canAdd = Math.min(remainingGold, maxCoins - currentCoins);

            if (canAdd > 0) {
              updatedPlayer.board[i] = {
                ...placed,
                coinsOnCard: currentCoins + canAdd,
              };
              remainingGold -= canAdd;
            }
          }

          updatedPlayer.gold = remainingGold;
          return updatedPlayer;
        });

        return {
          ...state,
          players: finalPlayers,
          board,
          phase: 'ended',
          turnPhase: 'end',
        };
      }

      return {
        ...state,
        players,
        board,
        currentPlayerIndex: nextPlayerIndex,
        turnNumber: newTurnNumber,
        turnPhase: 'pre_action',
        keyUsedThisTurn: false,
        lockUsedThisTurn: false,
      };
    }

    default:
      return state;
  }
}

// =============================================================================
// Joueur aleatoire (simule un humain)
// =============================================================================

export function randomBuyDecision(
  state: PlayGameState,
  cards: Map<string, PlayCard>
): GameAction {
  const player = state.players[state.currentPlayerIndex];
  const available = getAvailableCards(state);

  const affordable = available.filter(cardId => {
    const card = cards.get(cardId);
    if (!card) return false;
    const cost = getEffectiveCost(card.value, card.category, player.reductionCastle, player.reductionVillage);
    return player.gold >= cost;
  });

  if (affordable.length > 0) {
    const cardId = affordable[Math.floor(Math.random() * affordable.length)];
    return { type: 'buy_card', playerId: player.id, cardId };
  }

  const cardId = available[Math.floor(Math.random() * available.length)];
  return { type: 'buy_card_flipped', playerId: player.id, cardId };
}

export function randomPlaceDecision(state: PlayGameState): GameAction {
  const player = state.players[state.currentPlayerIndex];
  const validPositions = getValidPlacements(player.board);
  const position = validPositions[Math.floor(Math.random() * validPositions.length)];

  return {
    type: 'place_card',
    playerId: player.id,
    cardId: state.purchasedCard!,
    position,
  };
}

// =============================================================================
// Estimation du score
// =============================================================================

export function estimateScore(player: PlayPlayer, cards: Map<string, PlayCard>): number {
  return calculatePlayerScore(player, cards);
}

// =============================================================================
// Serialisation pour l'entrainement
// =============================================================================

export function serializeState(state: PlayGameState): SerializedGameState {
  return {
    turnNumber: state.turnNumber,
    turnPhase: state.turnPhase,
    currentPlayerIndex: state.currentPlayerIndex,
    players: state.players.map(serializePlayer),
    board: {
      castleCards: state.board.castleCards,
      villageCards: state.board.villageCards,
      messengerLocation: state.board.messengerLocation,
      castleDeckSize: state.board.castleDeck.length,
      villageDeckSize: state.board.villageDeck.length,
    },
  };
}

function serializePlayer(player: PlayPlayer): SerializedPlayer {
  return {
    id: player.id,
    name: player.name,
    isAI: player.isAI,
    aiLevel: player.aiLevel,
    gold: player.gold,
    keys: player.keys,
    reductionCastle: player.reductionCastle,
    reductionVillage: player.reductionVillage,
    board: player.board.map(p => p?.cardId ?? null),
    lockedPositions: Array.from(player.lockedCards.entries())
      .filter(([, hasKey]) => hasKey)
      .map(([pos]) => pos),
  };
}

// =============================================================================
// Export des fonctions utilitaires
// =============================================================================

export { getAvailableCards, getValidPlacements };
