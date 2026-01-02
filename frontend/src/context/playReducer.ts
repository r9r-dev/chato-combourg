/**
 * Play Mode Reducer - Gestion de l'etat du mode Jouer
 *
 * Ce reducer gere les transitions d'etat pour le contexte Play.
 * Il enveloppe le game engine et gere les etats UI supplementaires.
 */

import type {
  PlayGameState,
  PlayGameConfig,
  AILevel,
  CardEffect,
  GameLogEntry,
} from '../types/play';

// =============================================================================
// Types d'etat UI
// =============================================================================

export type PlayStep =
  | 'setup'           // Configuration de la partie
  | 'playing'         // Partie en cours
  | 'ai_thinking'     // L'IA reflechit
  | 'effect_choice'   // Choix d'effet en attente
  | 'results';        // Resultats finaux

export interface PlayUIState {
  // Navigation
  step: PlayStep;

  // Configuration
  config: PlayGameConfig | null;

  // Etat du jeu (du game engine)
  gameState: PlayGameState | null;

  // Etat de l'IA
  aiThinking: boolean;
  aiError: string | null;

  // Choix d'effet en attente
  pendingEffectChoice: {
    options: CardEffect[];
    cardId: string;
  } | null;

  // Erreurs
  lastError: string | null;

  // Chargement
  isLoading: boolean;

  // Logs de partie
  gameLog: GameLogEntry[];
  showGameLog: boolean;
}

// =============================================================================
// Types d'actions
// =============================================================================

export type PlayUIAction =
  // Navigation
  | { type: 'SET_STEP'; step: PlayStep }
  | { type: 'RESET' }

  // Configuration
  | { type: 'SET_CONFIG'; config: PlayGameConfig }
  | { type: 'ADD_PLAYER'; name: string; color: string; isAI: boolean; aiLevel?: AILevel }
  | { type: 'REMOVE_PLAYER'; index: number }
  | { type: 'UPDATE_PLAYER'; index: number; name?: string; color?: string; isAI?: boolean; aiLevel?: AILevel }

  // Jeu
  | { type: 'SET_GAME_STATE'; gameState: PlayGameState }
  | { type: 'GAME_STARTED'; gameState: PlayGameState }
  | { type: 'GAME_ACTION_EXECUTED'; gameState: PlayGameState }
  | { type: 'GAME_ENDED'; gameState: PlayGameState }

  // IA
  | { type: 'AI_THINKING_START' }
  | { type: 'AI_THINKING_END' }
  | { type: 'AI_ERROR'; error: string }

  // Choix d'effet
  | { type: 'EFFECT_CHOICE_REQUIRED'; options: CardEffect[]; cardId: string }
  | { type: 'EFFECT_CHOICE_MADE'; choiceIndex: number }

  // Erreurs et chargement
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_LOADING'; isLoading: boolean }

  // Logs de partie
  | { type: 'ADD_LOG_ENTRY'; entry: GameLogEntry }
  | { type: 'TOGGLE_LOG' }
  | { type: 'CLEAR_LOG' };

// =============================================================================
// Etat initial
// =============================================================================

export const initialPlayUIState: PlayUIState = {
  step: 'setup',
  config: null,
  gameState: null,
  aiThinking: false,
  aiError: null,
  pendingEffectChoice: null,
  lastError: null,
  isLoading: false,
  gameLog: [],
  showGameLog: false,
};

// =============================================================================
// Helpers
// =============================================================================

const PLAYER_COLORS = [
  '#e74c3c', // Rouge
  '#3498db', // Bleu
  '#2ecc71', // Vert
  '#f39c12', // Orange
  '#9b59b6', // Violet
];

function getNextColor(config: PlayGameConfig | null): string {
  if (!config) return PLAYER_COLORS[0];
  const usedColors = config.players.map(p => p.color);
  const available = PLAYER_COLORS.filter(c => !usedColors.includes(c));
  return available[0] ?? PLAYER_COLORS[0];
}

// =============================================================================
// Reducer
// =============================================================================

export function playReducer(
  state: PlayUIState,
  action: PlayUIAction
): PlayUIState {
  switch (action.type) {
    // Navigation
    case 'SET_STEP':
      return { ...state, step: action.step, lastError: null };

    case 'RESET':
      return initialPlayUIState;

    // Configuration
    case 'SET_CONFIG':
      return { ...state, config: action.config };

    case 'ADD_PLAYER': {
      const currentPlayers = state.config?.players ?? [];
      if (currentPlayers.length >= 5) return state;

      const newPlayer = {
        name: action.name,
        color: action.color || getNextColor(state.config),
        isAI: action.isAI,
        aiLevel: action.aiLevel,
      };

      return {
        ...state,
        config: {
          ...state.config,
          players: [...currentPlayers, newPlayer],
        },
      };
    }

    case 'REMOVE_PLAYER': {
      if (!state.config) return state;
      const players = [...state.config.players];
      players.splice(action.index, 1);
      return {
        ...state,
        config: { ...state.config, players },
      };
    }

    case 'UPDATE_PLAYER': {
      if (!state.config) return state;
      const players = [...state.config.players];
      const player = players[action.index];
      if (!player) return state;

      players[action.index] = {
        ...player,
        ...(action.name !== undefined && { name: action.name }),
        ...(action.color !== undefined && { color: action.color }),
        ...(action.isAI !== undefined && { isAI: action.isAI }),
        ...(action.aiLevel !== undefined && { aiLevel: action.aiLevel }),
      };

      return {
        ...state,
        config: { ...state.config, players },
      };
    }

    // Jeu
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.gameState };

    case 'GAME_STARTED':
      return {
        ...state,
        step: 'playing',
        gameState: action.gameState,
        lastError: null,
      };

    case 'GAME_ACTION_EXECUTED':
      return {
        ...state,
        gameState: action.gameState,
        lastError: null,
      };

    case 'GAME_ENDED':
      return {
        ...state,
        step: 'results',
        gameState: action.gameState,
      };

    // IA
    case 'AI_THINKING_START':
      return { ...state, aiThinking: true, step: 'ai_thinking' };

    case 'AI_THINKING_END':
      return {
        ...state,
        aiThinking: false,
        step: state.gameState?.phase === 'ended' ? 'results' : 'playing',
      };

    case 'AI_ERROR':
      return {
        ...state,
        aiThinking: false,
        aiError: action.error,
        step: 'playing',
      };

    // Choix d'effet
    case 'EFFECT_CHOICE_REQUIRED':
      return {
        ...state,
        step: 'effect_choice',
        pendingEffectChoice: {
          options: action.options,
          cardId: action.cardId,
        },
      };

    case 'EFFECT_CHOICE_MADE':
      return {
        ...state,
        step: 'playing',
        pendingEffectChoice: null,
      };

    // Erreurs et chargement
    case 'SET_ERROR':
      return { ...state, lastError: action.error };

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    // Logs de partie
    case 'ADD_LOG_ENTRY':
      return { ...state, gameLog: [...state.gameLog, action.entry] };

    case 'TOGGLE_LOG':
      return { ...state, showGameLog: !state.showGameLog };

    case 'CLEAR_LOG':
      return { ...state, gameLog: [] };

    default:
      return state;
  }
}
