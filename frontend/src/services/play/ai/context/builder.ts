/**
 * Construit AIContext depuis PlayGameState
 *
 * Le AIContext est une vue enrichie de l'etat du jeu,
 * optimisee pour la prise de decision de l'IA.
 */

import type { PlayGameState, PlayCard } from '../../../../types/play';
import type { AIContext } from '../types';
import { getEffectiveCost } from '../../../../types/play';
import { getCard as getCardFromEngine, loadCardData } from '../../gameEngine';

// Cache local des cartes (construit a partir du gameEngine)
let cardsCache: Map<string, PlayCard> | null = null;

/**
 * Charge les cartes depuis le gameEngine
 */
export async function loadCards(): Promise<Map<string, PlayCard>> {
  if (cardsCache && cardsCache.size > 0) return cardsCache;

  try {
    // Utiliser le cache du gameEngine
    const cardData = await loadCardData();

    cardsCache = new Map();
    for (const [id, card] of Object.entries(cardData)) {
      cardsCache.set(id, card);
    }

    return cardsCache;
  } catch (error) {
    console.error('[AI] Failed to load cards:', error);
    return new Map();
  }
}

/**
 * Retourne le cache des cartes (synchrone)
 * Essaie de construire le cache a partir du gameEngine si vide
 */
export function getCardsCache(): Map<string, PlayCard> {
  // Si le cache est vide, essayer de le construire a partir du gameEngine
  if (!cardsCache || cardsCache.size === 0) {
    cardsCache = new Map();

    // Le gameEngine a peut-etre deja charge les cartes
    // On essaie de recuperer les cartes une par une (IDs 001-092)
    for (let i = 1; i <= 92; i++) {
      const id = i.toString().padStart(3, '0');
      const card = getCardFromEngine(id);
      if (card) {
        cardsCache.set(id, card);
      }
    }
  }

  return cardsCache;
}

/**
 * Construit le contexte IA depuis l'etat du jeu
 */
export function buildContext(
  state: PlayGameState,
  playerId: string,
  cards: Map<string, PlayCard>,
  isSimulation: boolean = false
): AIContext {
  const me = state.players.find(p => p.id === playerId);
  if (!me) {
    throw new Error(`[AI] Player ${playerId} not found in game state`);
  }

  const opponents = state.players.filter(p => p.id !== playerId);

  // Cartes du lieu du messager
  const messengerCards = state.board.messengerLocation === 'castle'
    ? state.board.castleCards
    : state.board.villageCards;

  // Cartes de l'autre lieu
  const otherLocationCards = state.board.messengerLocation === 'castle'
    ? state.board.villageCards
    : state.board.castleCards;

  // Cartes que le joueur peut acheter (assez d'or)
  const affordableCards = messengerCards.filter(cardId => {
    const card = cards.get(cardId);
    if (!card) return false;

    const cost = getEffectiveCost(
      card.value,
      card.category,
      me.reductionCastle,
      me.reductionVillage
    );

    return me.gold >= cost;
  });

  // Probabilites de refresh
  const deckProbabilities = {
    castle: calculateDeckProbabilities(state.board.castleDeck),
    village: calculateDeckProbabilities(state.board.villageDeck),
  };

  return {
    // Etat du jeu
    turnNumber: state.turnNumber,
    turnPhase: state.turnPhase,
    keyUsedThisTurn: state.keyUsedThisTurn,
    lockUsedThisTurn: state.lockUsedThisTurn,
    purchasedCard: state.purchasedCard,
    isSimulation,

    // Joueurs
    me,
    players: state.players,
    opponents,

    // Plateau central
    board: state.board,

    // Helpers
    messengerCards,
    otherLocationCards,
    affordableCards,
    cards,

    // Probabilites
    deckProbabilities,
  };
}

/**
 * Calcule les probabilites d'obtenir chaque carte au refresh
 *
 * P(carte X au refresh) = min(1, 3 / |deck|) si X dans deck
 */
function calculateDeckProbabilities(deck: string[]): Map<string, number> {
  const probabilities = new Map<string, number>();

  if (deck.length === 0) return probabilities;

  // Si 3 cartes ou moins, probabilite = 1
  const probability = Math.min(1, 3 / deck.length);

  for (const cardId of deck) {
    probabilities.set(cardId, probability);
  }

  return probabilities;
}

/**
 * Met a jour le contexte apres une action (pour simulation)
 */
export function updateContext(
  context: AIContext,
  newState: PlayGameState
): AIContext {
  return buildContext(newState, context.me.id, context.cards, context.isSimulation);
}
