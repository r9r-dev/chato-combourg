/**
 * Game state reducer avec actions typées.
 *
 * Ce module gère les mises à jour d'état pour le contexte de jeu.
 * Utilise le pattern reducer pour des transitions d'état prévisibles.
 */

import type {
  GameState,
  GameCard,
  CardMatch,
  SelectedPlayer,
  Player,
  CalculateResponse,
} from '../types';

// =============================================================================
// Types d'actions
// =============================================================================

export type GameAction =
  // Navigation
  | { type: 'SET_STEP'; step: GameState['step'] }
  | { type: 'RESET' }

  // Sélection des joueurs
  | { type: 'SET_SELECTED_PLAYERS'; players: Player[]; navigateTo?: GameState['step'] }

  // Plateau du joueur courant
  | { type: 'SET_CARDS'; cards: GameCard[]; captureId?: string }
  | { type: 'UPDATE_CARD'; position: number; cardId: string; alternatives?: CardMatch[] }
  | { type: 'SET_KEYS'; keys: number }
  | { type: 'SET_COINS'; coins: number }
  | { type: 'SET_CAPTURE_ID'; captureId: string }
  | { type: 'SET_SCORE'; score: CalculateResponse }

  // Gestion du flux multi-joueurs
  | { type: 'SAVE_CURRENT_PLAYER'; score: CalculateResponse }
  | { type: 'NEXT_PLAYER' }

  // Mode legacy
  | { type: 'SET_LEGACY_MODE'; isLegacy: boolean }
  | { type: 'SET_LEGACY_CARD_SCORES'; scores: number[] }
  | { type: 'SAVE_LEGACY_PLAYER'; totalScore: number; cardScores: number[] };

// =============================================================================
// État initial
// =============================================================================

export const initialGameState: GameState = {
  step: 'landing',
  cards: [],
  keys: 0,
  coins: 0,
  score: null,
  selectedPlayers: [],
  currentPlayerIndex: 0,
  captureId: undefined,
  originalCards: undefined,
  isLegacyMode: false,
  legacyCardScores: undefined,
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Crée un SelectedPlayer à partir d'un Player avec les valeurs par défaut.
 */
function createSelectedPlayer(player: Player): SelectedPlayer {
  return {
    ...player,
    keys: 0,
    coins: 0,
    cards: [],
    score: null,
    captureId: undefined,
    originalCards: undefined,
    legacyCardScores: undefined,
  };
}

/**
 * Réinitialise les champs du joueur courant.
 */
function resetCurrentPlayerFields(state: GameState): Partial<GameState> {
  return {
    cards: [],
    keys: 0,
    coins: 0,
    score: null,
    captureId: undefined,
    originalCards: undefined,
    legacyCardScores: state.isLegacyMode ? [0, 0, 0, 0, 0, 0, 0, 0, 0] : undefined,
  };
}

// =============================================================================
// Reducer
// =============================================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // Navigation
    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'RESET':
      return initialGameState;

    // Sélection des joueurs
    case 'SET_SELECTED_PLAYERS': {
      const selectedPlayers = action.players.map(createSelectedPlayer);
      return {
        ...state,
        selectedPlayers,
        currentPlayerIndex: 0,
        ...resetCurrentPlayerFields(state),
        ...(action.navigateTo ? { step: action.navigateTo } : {}),
      };
    }

    // Plateau du joueur courant
    case 'SET_CARDS':
      return {
        ...state,
        cards: action.cards,
        captureId: action.captureId ?? state.captureId,
        originalCards: action.cards.map((c) => ({ ...c })),
      };

    case 'UPDATE_CARD':
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.position === action.position
            ? {
                ...card,
                cardId: action.cardId,
                confidence: 1.0,
                alternatives: action.alternatives ?? card.alternatives,
              }
            : card
        ),
      };

    case 'SET_KEYS':
      return { ...state, keys: Math.max(0, action.keys) };

    case 'SET_COINS':
      return { ...state, coins: Math.max(0, action.coins) };

    case 'SET_CAPTURE_ID':
      return { ...state, captureId: action.captureId };

    case 'SET_SCORE':
      return { ...state, score: action.score };

    // Gestion du flux multi-joueurs
    case 'SAVE_CURRENT_PLAYER': {
      const updatedPlayers = [...state.selectedPlayers];
      updatedPlayers[state.currentPlayerIndex] = {
        ...updatedPlayers[state.currentPlayerIndex],
        keys: state.keys,
        coins: state.coins,
        cards: [...state.cards],
        score: action.score,
        captureId: state.captureId,
        originalCards: state.originalCards ? [...state.originalCards] : undefined,
      };
      return { ...state, selectedPlayers: updatedPlayers };
    }

    case 'NEXT_PLAYER': {
      const nextIndex = state.currentPlayerIndex + 1;
      return {
        ...state,
        currentPlayerIndex: nextIndex,
        ...resetCurrentPlayerFields(state),
      };
    }

    // Mode legacy
    case 'SET_LEGACY_MODE':
      return {
        ...state,
        isLegacyMode: action.isLegacy,
        legacyCardScores: action.isLegacy ? [0, 0, 0, 0, 0, 0, 0, 0, 0] : undefined,
      };

    case 'SET_LEGACY_CARD_SCORES':
      return { ...state, legacyCardScores: action.scores };

    case 'SAVE_LEGACY_PLAYER': {
      const updatedPlayers = [...state.selectedPlayers];
      updatedPlayers[state.currentPlayerIndex] = {
        ...updatedPlayers[state.currentPlayerIndex],
        keys: state.keys,
        coins: 0,
        cards: [],
        score: {
          total_score: action.totalScore,
          keys_bonus: state.keys,
          cards_score: action.cardScores.reduce((sum, s) => sum + s, 0),
          details: action.cardScores.map((score, position) => ({
            position,
            card_id: '',
            score,
            explanation: 'Score saisi manuellement',
          })),
        },
        legacyCardScores: action.cardScores,
      };
      return { ...state, selectedPlayers: updatedPlayers };
    }

    default:
      return state;
  }
}
