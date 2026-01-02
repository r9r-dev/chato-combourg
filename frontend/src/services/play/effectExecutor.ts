/**
 * Effect Executor - Executeur des effets de cartes
 *
 * Gere l'application de tous les types d'effets :
 * - Gain de ressources (or, cles)
 * - Reductions permanentes
 * - Remplissage des bourses
 * - Effets sur les voisins
 * - Effets de cadenas
 */

import type {
  PlayGameState,
  PlayPlayer,
  CardEffect,
  ShieldColor,
  Location,
} from '../../types/play';
import { getCard } from './gameEngine';

// =============================================================================
// Types
// =============================================================================

export interface EffectResult {
  success: boolean;
  newState: PlayGameState;
  description: string;
  requiresChoice?: boolean;
  choices?: CardEffect[];
}

// =============================================================================
// Executeur principal
// =============================================================================

export function executeCardEffect(
  state: PlayGameState,
  cardId: string,
  position: number,
  choiceIndex?: number
): EffectResult {
  const card = getCard(cardId);
  if (!card) {
    return {
      success: false,
      newState: state,
      description: 'Carte inconnue',
    };
  }

  // Si la carte a un effet de choix [OU]
  const choiceEffect = card.effects.find(e => e.type === 'choice');
  if (choiceEffect && choiceEffect.options) {
    if (choiceIndex === undefined) {
      return {
        success: true,
        newState: state,
        description: 'Choix requis',
        requiresChoice: true,
        choices: choiceEffect.options,
      };
    }

    // Executer l'effet choisi
    const chosenEffect = choiceEffect.options[choiceIndex];
    return executeSingleEffect(state, chosenEffect, position);
  }

  // Executer tous les effets sequentiellement
  let currentState = state;
  const descriptions: string[] = [];

  for (const effect of card.effects) {
    if (effect.type === 'choice') continue; // Deja gere

    const result = executeSingleEffect(currentState, effect, position);
    currentState = result.newState;
    descriptions.push(result.description);
  }

  return {
    success: true,
    newState: currentState,
    description: descriptions.join('. '),
  };
}

export function executeLockEffect(
  state: PlayGameState,
  cardId: string,
  position: number
): EffectResult {
  const card = getCard(cardId);
  if (!card || !card.lock_effect) {
    return {
      success: false,
      newState: state,
      description: 'Pas d\'effet de cadenas',
    };
  }

  return executeSingleEffect(state, card.lock_effect, position);
}

// =============================================================================
// Execution des effets individuels
// =============================================================================

function executeSingleEffect(
  state: PlayGameState,
  effect: CardEffect,
  position: number
): EffectResult {
  const playerIndex = state.currentPlayerIndex;

  switch (effect.type) {
    // Gains simples
    case 'gain_gold':
      return applyGainGold(state, playerIndex, effect.amount ?? 0);

    case 'gain_keys':
      return applyGainKeys(state, playerIndex, effect.amount ?? 0);

    // Gains par boucliers sur le plateau
    case 'gain_gold_per_shield':
      return applyGainPerShield(state, playerIndex, effect.color!, effect.amount ?? 1, 'gold');

    case 'gain_keys_per_shield':
      return applyGainPerShield(state, playerIndex, effect.color!, effect.amount ?? 1, 'keys');

    // Gains par boucliers chez les voisins
    case 'gain_gold_per_shield_neighbor':
      return applyGainPerShieldNeighbor(state, playerIndex, effect.color!, effect.amount ?? 1, 'gold');

    case 'gain_keys_per_shield_neighbor':
      return applyGainPerShieldNeighbor(state, playerIndex, effect.color!, effect.amount ?? 1, 'keys');

    // Gains par boucliers uniques
    case 'gain_gold_per_unique_shield':
      return applyGainPerUniqueShield(state, playerIndex, effect.amount ?? 1, 'gold');

    case 'gain_keys_per_unique_shield':
      return applyGainPerUniqueShield(state, playerIndex, effect.amount ?? 1, 'keys');

    // Gains par boucliers manquants
    case 'gain_keys_per_missing_shield':
      return applyGainPerMissingShield(state, playerIndex, effect.amount ?? 1);

    // Gains par cartes
    case 'gain_gold_per_card':
      return applyGainPerCard(state, playerIndex, effect.amount ?? 1, 'gold');

    case 'gain_gold_per_castle':
      return applyGainPerCategory(state, playerIndex, 'castle', effect.amount ?? 1, 'gold');

    case 'gain_gold_per_village':
      return applyGainPerCategory(state, playerIndex, 'village', effect.amount ?? 1, 'gold');

    case 'gain_keys_per_castle':
      return applyGainPerCategory(state, playerIndex, 'castle', effect.amount ?? 1, 'keys');

    case 'gain_keys_per_village':
      return applyGainPerCategory(state, playerIndex, 'village', effect.amount ?? 1, 'keys');

    // Gains par cartes chez les voisins
    case 'gain_keys_per_castle_neighbor':
      return applyGainPerCategoryNeighbor(state, playerIndex, 'castle', effect.amount ?? 1, 'keys');

    case 'gain_gold_per_castle_neighbor':
      return applyGainPerCategoryNeighbor(state, playerIndex, 'castle', effect.amount ?? 1, 'gold');

    // Gains par emplacements vides
    case 'gain_gold_per_empty_slot':
      return applyGainPerEmptySlot(state, playerIndex, effect.amount ?? 1);

    // Gains par cartes avec caracteristiques
    case 'gain_gold_per_card_with_shields':
      return applyGainPerCardWithShields(state, playerIndex, effect.shield_count ?? 1, effect.amount ?? 1, 'gold');

    case 'gain_keys_per_card_with_shields':
      return applyGainPerCardWithShields(state, playerIndex, effect.shield_count ?? 1, effect.amount ?? 1, 'keys');

    case 'gain_gold_per_card_with_value':
      return applyGainPerCardWithValue(state, playerIndex, effect.value ?? 0, effect.amount ?? 1);

    case 'gain_gold_per_card_with_purse':
      return applyGainPerCardWithPurse(state, playerIndex, effect.amount ?? 1, 'gold');

    case 'gain_keys_per_card_with_purse':
      return applyGainPerCardWithPurse(state, playerIndex, effect.amount ?? 1, 'keys');

    // Reductions permanentes
    case 'reduction_castle':
      return applyReduction(state, playerIndex, 'castle');

    case 'reduction_village':
      return applyReduction(state, playerIndex, 'village');

    case 'reduction_both':
      return applyReduction(state, playerIndex, 'both');

    // Remplissage des bourses
    case 'fill_purses':
      return applyFillPurses(state, playerIndex, effect.amount ?? 2);

    // Defausser une carte
    case 'discard_village_gain_gold':
      return applyDiscardAndGain(state, 'village', 'gold');

    case 'discard_village_gain_keys':
      return applyDiscardAndGain(state, 'village', 'keys');

    case 'discard_castle_gain_gold':
      return applyDiscardAndGain(state, 'castle', 'gold');

    // Effets sur les adversaires
    case 'all_opponents_gain_gold':
      return applyAllOpponentsGain(state, playerIndex, 'gold', effect.amount ?? 1);

    case 'all_opponents_gain_keys':
      return applyAllOpponentsGain(state, playerIndex, 'keys', effect.amount ?? 1);

    case 'all_players_gain_keys':
      return applyAllPlayersGain(state, 'keys', effect.amount ?? 1);

    // Effets de cadenas speciaux
    case 'replace_location':
      return applyReplaceLocation(state);

    case 'replace_location_gain_keys_per_feature':
      return applyReplaceLocationGainKeys(state, playerIndex, effect.feature!, effect.keys_per_card ?? 1);

    case 'replace_location_gain_keys_per_shield':
      return applyReplaceLocationGainKeysPerShield(state, playerIndex, effect.color!, effect.keys_per_card ?? 1);

    case 'activate_adjacent':
      return applyActivateAdjacent(state, position);

    default:
      return {
        success: false,
        newState: state,
        description: `Effet inconnu: ${effect.type}`,
      };
  }
}

// =============================================================================
// Implementation des effets
// =============================================================================

function applyGainGold(
  state: PlayGameState,
  playerIndex: number,
  amount: number
): EffectResult {
  const players = [...state.players];
  const player = { ...players[playerIndex] };
  player.gold += amount;
  players[playerIndex] = player;

  return {
    success: true,
    newState: { ...state, players },
    description: `+${amount} or`,
  };
}

function applyGainKeys(
  state: PlayGameState,
  playerIndex: number,
  amount: number
): EffectResult {
  const players = [...state.players];
  const player = { ...players[playerIndex] };
  player.keys += amount;
  players[playerIndex] = player;

  return {
    success: true,
    newState: { ...state, players },
    description: `+${amount} cle${amount > 1 ? 's' : ''}`,
  };
}

function applyGainPerShield(
  state: PlayGameState,
  playerIndex: number,
  color: ShieldColor,
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  const player = state.players[playerIndex];
  const shieldCount = countShieldsOnBoard(player, color);
  const total = shieldCount * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyGainPerShieldNeighbor(
  state: PlayGameState,
  playerIndex: number,
  color: ShieldColor,
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  // Trouver le voisin avec le plus de boucliers de cette couleur
  const neighbors = getNeighborPlayers(state, playerIndex);
  let maxShields = 0;

  for (const neighbor of neighbors) {
    const count = countShieldsOnBoard(neighbor, color);
    maxShields = Math.max(maxShields, count);
  }

  const total = maxShields * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyGainPerUniqueShield(
  state: PlayGameState,
  playerIndex: number,
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  const player = state.players[playerIndex];
  const uniqueColors = countUniqueShieldColors(player);
  const total = uniqueColors * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyGainPerMissingShield(
  state: PlayGameState,
  playerIndex: number,
  amount: number
): EffectResult {
  const player = state.players[playerIndex];
  const uniqueColors = countUniqueShieldColors(player);
  const missingColors = 6 - uniqueColors; // 6 couleurs au total
  const total = missingColors * amount;

  return applyGainKeys(state, playerIndex, total);
}

function applyGainPerCard(
  state: PlayGameState,
  playerIndex: number,
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  const player = state.players[playerIndex];
  const cardCount = player.board.filter(c => c !== null).length;
  const total = cardCount * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyGainPerCategory(
  state: PlayGameState,
  playerIndex: number,
  category: 'castle' | 'village',
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  const player = state.players[playerIndex];
  const count = countCardsOfCategory(player, category);
  const total = count * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyGainPerCategoryNeighbor(
  state: PlayGameState,
  playerIndex: number,
  category: 'castle' | 'village',
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  const neighbors = getNeighborPlayers(state, playerIndex);
  let maxCount = 0;

  for (const neighbor of neighbors) {
    const count = countCardsOfCategory(neighbor, category);
    maxCount = Math.max(maxCount, count);
  }

  const total = maxCount * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyGainPerEmptySlot(
  state: PlayGameState,
  playerIndex: number,
  amount: number
): EffectResult {
  const player = state.players[playerIndex];
  const emptyCount = player.board.filter(c => c === null).length;
  const total = emptyCount * amount;

  return applyGainGold(state, playerIndex, total);
}

function applyGainPerCardWithShields(
  state: PlayGameState,
  playerIndex: number,
  shieldCount: number,
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  const player = state.players[playerIndex];
  let count = 0;

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;

    const totalShields = card.shields.reduce((sum, s) => sum + s.count, 0);
    if (totalShields === shieldCount) {
      count++;
    }
  }

  const total = count * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyGainPerCardWithValue(
  state: PlayGameState,
  playerIndex: number,
  value: number,
  amount: number
): EffectResult {
  const player = state.players[playerIndex];
  let count = 0;

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card && card.value === value) {
      count++;
    }
  }

  const total = count * amount;

  return applyGainGold(state, playerIndex, total);
}

function applyGainPerCardWithPurse(
  state: PlayGameState,
  playerIndex: number,
  amount: number,
  resource: 'gold' | 'keys'
): EffectResult {
  const player = state.players[playerIndex];
  let count = 0;

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card?.has_coin_purse) {
      count++;
    }
  }

  const total = count * amount;

  if (resource === 'gold') {
    return applyGainGold(state, playerIndex, total);
  } else {
    return applyGainKeys(state, playerIndex, total);
  }
}

function applyReduction(
  state: PlayGameState,
  playerIndex: number,
  type: 'castle' | 'village' | 'both'
): EffectResult {
  const players = [...state.players];
  const player = { ...players[playerIndex] };

  if (type === 'castle' || type === 'both') {
    player.reductionCastle += 1;
  }
  if (type === 'village' || type === 'both') {
    player.reductionVillage += 1;
  }

  players[playerIndex] = player;

  const desc = type === 'both'
    ? 'Reduction -1 partout'
    : `Reduction -1 au ${type === 'castle' ? 'chateau' : 'village'}`;

  return {
    success: true,
    newState: { ...state, players },
    description: desc,
  };
}

function applyFillPurses(
  state: PlayGameState,
  playerIndex: number,
  amount: number
): EffectResult {
  const players = [...state.players];
  const player = { ...players[playerIndex] };
  const board = [...player.board];
  let totalAdded = 0;

  for (let i = 0; i < board.length; i++) {
    const placed = board[i];
    if (!placed) continue;

    const card = getCard(placed.cardId);
    if (!card?.has_coin_purse) continue;

    const maxCoins = card.max_coins;
    const currentCoins = placed.coinsOnCard;
    const canAdd = Math.min(amount, maxCoins - currentCoins);

    if (canAdd > 0) {
      board[i] = { ...placed, coinsOnCard: currentCoins + canAdd };
      totalAdded += canAdd;
    }
  }

  player.board = board;
  players[playerIndex] = player;

  return {
    success: true,
    newState: { ...state, players },
    description: `+${totalAdded} pieces sur les bourses`,
  };
}

function applyDiscardAndGain(
  state: PlayGameState,
  location: Location,
  _resource: 'gold' | 'keys'
): EffectResult {
  // Note: Dans le vrai jeu, le joueur choisit quelle carte defausser
  // Pour l'instant, on retourne juste un succes
  // L'interface devra gerer le choix
  return {
    success: true,
    newState: state,
    description: `Defausser une carte du ${location === 'castle' ? 'chateau' : 'village'}`,
    requiresChoice: true,
  };
}

function applyAllOpponentsGain(
  state: PlayGameState,
  playerIndex: number,
  resource: 'gold' | 'keys',
  amount: number
): EffectResult {
  const players = [...state.players];

  for (let i = 0; i < players.length; i++) {
    if (i === playerIndex) continue;

    const player = { ...players[i] };
    if (resource === 'gold') {
      player.gold += amount;
    } else {
      player.keys += amount;
    }
    players[i] = player;
  }

  const resourceName = resource === 'gold' ? 'or' : 'cle(s)';
  return {
    success: true,
    newState: { ...state, players },
    description: `Tous les adversaires gagnent ${amount} ${resourceName}`,
  };
}

function applyAllPlayersGain(
  state: PlayGameState,
  resource: 'gold' | 'keys',
  amount: number
): EffectResult {
  const players = [...state.players];

  for (let i = 0; i < players.length; i++) {
    const player = { ...players[i] };
    if (resource === 'gold') {
      player.gold += amount;
    } else {
      player.keys += amount;
    }
    players[i] = player;
  }

  const resourceName = resource === 'gold' ? 'or' : 'cle(s)';
  return {
    success: true,
    newState: { ...state, players },
    description: `Tous les joueurs gagnent ${amount} ${resourceName}`,
  };
}

function applyReplaceLocation(state: PlayGameState): EffectResult {
  // Le joueur doit choisir le lieu
  return {
    success: true,
    newState: state,
    description: 'Remplacer toutes les cartes d\'un lieu',
    requiresChoice: true,
  };
}

function applyReplaceLocationGainKeys(
  state: PlayGameState,
  _playerIndex: number,
  feature: string,
  keysPerCard: number
): EffectResult {
  // Le joueur doit choisir le lieu, puis on compte les cartes avec la feature
  return {
    success: true,
    newState: state,
    description: `Remplacer un lieu et gagner ${keysPerCard} cle(s) par carte ${feature}`,
    requiresChoice: true,
  };
}

function applyReplaceLocationGainKeysPerShield(
  state: PlayGameState,
  _playerIndex: number,
  color: ShieldColor,
  keysPerCard: number
): EffectResult {
  return {
    success: true,
    newState: state,
    description: `Remplacer un lieu et gagner ${keysPerCard} cle(s) par carte avec bouclier ${color}`,
    requiresChoice: true,
  };
}

function applyActivateAdjacent(
  state: PlayGameState,
  _position: number
): EffectResult {
  // Le joueur doit choisir une carte adjacente
  return {
    success: true,
    newState: state,
    description: 'Activer l\'effet d\'une carte adjacente',
    requiresChoice: true,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function countShieldsOnBoard(player: PlayPlayer, color: ShieldColor): number {
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

function countUniqueShieldColors(player: PlayPlayer): number {
  const colors = new Set<ShieldColor>();

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;

    for (const shield of card.shields) {
      colors.add(shield.color as ShieldColor);
    }
  }

  return colors.size;
}

function countCardsOfCategory(
  player: PlayPlayer,
  category: 'castle' | 'village'
): number {
  let count = 0;

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card?.category === category) {
      count++;
    }
  }

  return count;
}

function getNeighborPlayers(
  state: PlayGameState,
  playerIndex: number
): PlayPlayer[] {
  const neighbors: PlayPlayer[] = [];
  const playerCount = state.players.length;

  if (playerCount <= 1) return neighbors;

  // Joueur precedent
  const prevIndex = (playerIndex - 1 + playerCount) % playerCount;
  neighbors.push(state.players[prevIndex]);

  // Joueur suivant (si different du precedent)
  const nextIndex = (playerIndex + 1) % playerCount;
  if (nextIndex !== prevIndex) {
    neighbors.push(state.players[nextIndex]);
  }

  return neighbors;
}
