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
  DiscardChoice,
  ReplaceLocationChoice,
  ReplaceLocationEffectType,
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
  discardChoice?: DiscardChoice;  // Pour les effets de defausse
  replaceLocationChoice?: ReplaceLocationChoice;  // Pour les effets de remplacement de lieu
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
    return executeSingleEffect(state, chosenEffect, position, cardId);
  }

  // Executer tous les effets sequentiellement
  let currentState = state;
  const descriptions: string[] = [];

  for (const effect of card.effects) {
    if (effect.type === 'choice') continue; // Deja gere

    const result = executeSingleEffect(currentState, effect, position, cardId);

    // Si un effet necessite un choix de defausse, retourner immediatement
    if (result.requiresChoice && result.discardChoice) {
      return result;
    }

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

  return executeSingleEffect(state, card.lock_effect, position, cardId);
}

// =============================================================================
// Execution des effets individuels
// =============================================================================

function executeSingleEffect(
  state: PlayGameState,
  effect: CardEffect,
  position: number,
  cardId?: string
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
      return applyDiscardAndGain(state, 'village', 'gold', cardId ?? '');

    case 'discard_village_gain_keys':
      return applyDiscardAndGain(state, 'village', 'keys', cardId ?? '');

    case 'discard_castle_gain_gold':
      return applyDiscardAndGain(state, 'castle', 'gold', cardId ?? '');

    // Effets sur les adversaires
    case 'all_opponents_gain_gold':
      return applyAllOpponentsGain(state, playerIndex, 'gold', effect.amount ?? 1);

    case 'all_opponents_gain_keys':
      return applyAllOpponentsGain(state, playerIndex, 'keys', effect.amount ?? 1);

    case 'all_players_gain_keys':
      return applyAllPlayersGain(state, 'keys', effect.amount ?? 1);

    // Effets de cadenas speciaux
    case 'replace_location':
      return applyReplaceLocation(state, cardId ?? '', position);

    case 'replace_location_gain_keys_per_feature':
      return applyReplaceLocationGainKeys(state, cardId ?? '', position, effect.feature!, effect.keys_per_card ?? 1);

    case 'replace_location_gain_keys_per_shield':
      return applyReplaceLocationGainKeysPerShield(state, cardId ?? '', position, effect.color!, effect.keys_per_card ?? 1);

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
  resource: 'gold' | 'keys',
  cardId: string
): EffectResult {
  // Le joueur doit choisir une carte a defausser
  // On retourne les infos necessaires pour l'interface
  const locationName = location === 'castle' ? 'chateau' : 'village';
  const resourceName = resource === 'gold' ? 'or' : 'cles';

  return {
    success: true,
    newState: state,
    description: `Defaussez une carte du ${locationName} pour gagner son cout en ${resourceName}`,
    requiresChoice: true,
    discardChoice: {
      location,
      resource,
      cardId,
    },
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

function applyReplaceLocation(
  state: PlayGameState,
  cardId: string,
  position: number
): EffectResult {
  // Le joueur doit choisir le lieu
  return {
    success: true,
    newState: state,
    description: 'Remplacer toutes les cartes d\'un lieu',
    requiresChoice: true,
    replaceLocationChoice: {
      effectType: 'replace_location' as ReplaceLocationEffectType,
      cardId,
      position,
    },
  };
}

function applyReplaceLocationGainKeys(
  state: PlayGameState,
  cardId: string,
  position: number,
  feature: string,
  keysPerCard: number
): EffectResult {
  const featureName = feature === 'price_reduction' ? 'reduction' : 'bourse';
  return {
    success: true,
    newState: state,
    description: `Remplacer un lieu et gagner ${keysPerCard} cle(s) par carte ${featureName}`,
    requiresChoice: true,
    replaceLocationChoice: {
      effectType: 'replace_location_gain_keys_per_feature' as ReplaceLocationEffectType,
      cardId,
      position,
      feature,
      keysPerCard,
    },
  };
}

function applyReplaceLocationGainKeysPerShield(
  state: PlayGameState,
  cardId: string,
  position: number,
  color: ShieldColor,
  keysPerCard: number
): EffectResult {
  const colorName = getColorName(color);
  return {
    success: true,
    newState: state,
    description: `Remplacer un lieu et gagner ${keysPerCard} cle(s) par carte avec bouclier ${colorName}`,
    requiresChoice: true,
    replaceLocationChoice: {
      effectType: 'replace_location_gain_keys_per_shield' as ReplaceLocationEffectType,
      cardId,
      position,
      color,
      keysPerCard,
    },
  };
}

function getColorName(color: ShieldColor): string {
  const names: Record<ShieldColor, string> = {
    blue: 'bleu',
    pink: 'rose',
    green: 'vert',
    red: 'rouge',
    orange: 'orange',
    yellow: 'jaune',
  };
  return names[color] ?? color;
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

// =============================================================================
// Execution de l'effet de defausse (apres choix du joueur)
// =============================================================================

/**
 * Execute l'effet de defausse apres que le joueur ait choisi une carte.
 * - Defausse la carte choisie du lieu
 * - Pioche une nouvelle carte pour remplacer
 * - Donne au joueur la ressource correspondante (or ou cles) egale au cout de la carte
 */
export function executeDiscardEffect(
  state: PlayGameState,
  discardChoice: DiscardChoice,
  chosenCardId: string
): EffectResult {
  const playerIndex = state.currentPlayerIndex;
  const card = getCard(chosenCardId);

  if (!card) {
    return {
      success: false,
      newState: state,
      description: 'Carte inconnue',
    };
  }

  // Calculer le gain (= cout de la carte defaussee)
  const gainAmount = card.value;

  // Mettre a jour les ressources du joueur
  const players = [...state.players];
  const player = { ...players[playerIndex] };

  if (discardChoice.resource === 'gold') {
    player.gold += gainAmount;
  } else {
    player.keys += gainAmount;
  }
  players[playerIndex] = player;

  // Defausser la carte et piocher une nouvelle
  let board = { ...state.board };
  const location = discardChoice.location;

  if (location === 'castle') {
    // Retirer la carte du chateau
    const cardIndex = board.castleCards.indexOf(chosenCardId);
    if (cardIndex >= 0) {
      board.castleCards = [...board.castleCards];
      board.castleCards.splice(cardIndex, 1);

      // Ajouter a la defausse
      board.castleDiscard = [...board.castleDiscard, chosenCardId];

      // Piocher une nouvelle carte si possible
      if (board.castleDeck.length > 0) {
        const newCard = board.castleDeck[0];
        board.castleDeck = board.castleDeck.slice(1);
        board.castleCards.push(newCard);
      }
    }
  } else {
    // Retirer la carte du village
    const cardIndex = board.villageCards.indexOf(chosenCardId);
    if (cardIndex >= 0) {
      board.villageCards = [...board.villageCards];
      board.villageCards.splice(cardIndex, 1);

      // Ajouter a la defausse
      board.villageDiscard = [...board.villageDiscard, chosenCardId];

      // Piocher une nouvelle carte si possible
      if (board.villageDeck.length > 0) {
        const newCard = board.villageDeck[0];
        board.villageDeck = board.villageDeck.slice(1);
        board.villageCards.push(newCard);
      }
    }
  }

  const locationName = location === 'castle' ? 'chateau' : 'village';
  const resourceName = discardChoice.resource === 'gold' ? 'or' : 'cle(s)';

  return {
    success: true,
    newState: { ...state, players, board },
    description: `Carte defaussee du ${locationName}: +${gainAmount} ${resourceName}`,
  };
}

// =============================================================================
// Execution de l'effet de remplacement de lieu (apres choix du joueur)
// =============================================================================

/**
 * Execute l'effet de remplacement de lieu apres que le joueur ait choisi.
 * - Defausse toutes les cartes du lieu choisi
 * - Pioche de nouvelles cartes pour remplacer
 * - Selon l'effet, donne des cles basees sur les cartes defaussees
 */
export function executeReplaceLocationEffect(
  state: PlayGameState,
  choice: ReplaceLocationChoice,
  chosenLocation: Location
): EffectResult {
  const playerIndex = state.currentPlayerIndex;

  // Recuperer les cartes du lieu choisi
  const cardsToDiscard = chosenLocation === 'castle'
    ? [...state.board.castleCards]
    : [...state.board.villageCards];

  // Compter les cles a gagner selon le type d'effet
  let keysGained = 0;
  const keysPerCard = choice.keysPerCard ?? 0;

  if (choice.effectType === 'replace_location_gain_keys_per_feature') {
    // Compter les cartes avec la feature
    for (const cardId of cardsToDiscard) {
      const card = getCard(cardId);
      if (!card) continue;

      if (choice.feature === 'price_reduction' && card.has_price_reduction) {
        keysGained += keysPerCard;
      } else if (choice.feature === 'coin_purse' && card.has_coin_purse) {
        keysGained += keysPerCard;
      }
    }
  } else if (choice.effectType === 'replace_location_gain_keys_per_shield') {
    // Compter les cartes avec le bouclier de la couleur
    for (const cardId of cardsToDiscard) {
      const card = getCard(cardId);
      if (!card) continue;

      const hasShieldColor = card.shields.some(s => s.color === choice.color);
      if (hasShieldColor) {
        keysGained += keysPerCard;
      }
    }
  }

  // Mettre a jour les ressources du joueur
  const players = [...state.players];
  const player = { ...players[playerIndex] };
  player.keys += keysGained;
  players[playerIndex] = player;

  // Defausser et piocher de nouvelles cartes
  let board = { ...state.board };

  if (chosenLocation === 'castle') {
    // Defausser les cartes du chateau
    board.castleDiscard = [...board.castleDiscard, ...board.castleCards];
    board.castleCards = [];

    // Piocher 3 nouvelles cartes
    if (board.castleDeck.length < 3 && board.castleDiscard.length > 0) {
      // Remelanger la defausse dans la pioche
      const reshuffled = [...board.castleDiscard];
      shuffle(reshuffled);
      board.castleDeck = [...board.castleDeck, ...reshuffled];
      board.castleDiscard = [];
    }

    // Piocher jusqu'a 3 cartes
    const cardsToDraw = Math.min(3, board.castleDeck.length);
    board.castleCards = board.castleDeck.slice(0, cardsToDraw);
    board.castleDeck = board.castleDeck.slice(cardsToDraw);
  } else {
    // Defausser les cartes du village
    board.villageDiscard = [...board.villageDiscard, ...board.villageCards];
    board.villageCards = [];

    // Piocher 3 nouvelles cartes
    if (board.villageDeck.length < 3 && board.villageDiscard.length > 0) {
      // Remelanger la defausse dans la pioche
      const reshuffled = [...board.villageDiscard];
      shuffle(reshuffled);
      board.villageDeck = [...board.villageDeck, ...reshuffled];
      board.villageDiscard = [];
    }

    // Piocher jusqu'a 3 cartes
    const cardsToDraw = Math.min(3, board.villageDeck.length);
    board.villageCards = board.villageDeck.slice(0, cardsToDraw);
    board.villageDeck = board.villageDeck.slice(cardsToDraw);
  }

  const locationName = chosenLocation === 'castle' ? 'chateau' : 'village';
  let description = `Cartes du ${locationName} remplacees`;
  if (keysGained > 0) {
    description += `: +${keysGained} cle${keysGained > 1 ? 's' : ''}`;
  }

  return {
    success: true,
    newState: { ...state, players, board },
    description,
  };
}

// Helper pour melanger un tableau
function shuffle<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
