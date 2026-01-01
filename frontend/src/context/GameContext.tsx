/**
 * Game Context - Gestion de l'état du jeu multi-joueurs.
 *
 * Ce contexte gère :
 * - La navigation entre les étapes (landing, players, keys, coins, camera, review, summary)
 * - Le plateau du joueur courant (cartes, clés, pièces, score)
 * - Le flux multi-joueurs (sélection, sauvegarde, passage au suivant)
 * - Le mode legacy (import d'anciennes parties)
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  GameState,
  GameCard,
  CardMatch,
  SelectedPlayer,
  Player,
  CalculateResponse,
  GameDetail,
} from '../types';
import { calculateScore, createGame } from '../services/api';
import { gameReducer, initialGameState } from './gameReducer';
import { useLegacyMode } from '../hooks/useLegacyMode';

// =============================================================================
// Types du contexte
// =============================================================================

interface GameContextType {
  state: GameState;
  // Navigation
  setStep: (step: GameState['step']) => void;
  reset: () => void;
  // Sélection des joueurs
  setSelectedPlayers: (players: Player[]) => void;
  setSelectedPlayersAndContinue: (players: Player[]) => void;
  getCurrentPlayer: () => SelectedPlayer | null;
  // Plateau du joueur courant
  setCards: (cards: GameCard[], captureId?: string) => void;
  updateCard: (position: number, cardId: string, alternatives?: CardMatch[]) => void;
  setKeys: (keys: number) => void;
  setCoins: (coins: number) => void;
  // Capture
  setCaptureId: (captureId: string) => void;
  getPreviousCaptureId: () => string | undefined;
  // Flux multi-joueurs
  saveCurrentPlayerAndNext: () => Promise<boolean>;
  recalculateCurrentPlayerScore: () => Promise<void>;
  saveGame: () => Promise<void>;
  // Mode legacy
  setLegacyMode: (isLegacy: boolean) => void;
  setLegacyCardScores: (scores: number[]) => void;
  saveLegacyPlayerAndNext: () => Promise<boolean>;
  saveLegacyGame: () => Promise<GameDetail | null>;
}

const GameContext = createContext<GameContextType | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  // Hook pour le mode legacy
  const legacy = useLegacyMode({ state, dispatch });

  // Navigation
  const setStep = useCallback(
    (step: GameState['step']) => dispatch({ type: 'SET_STEP', step }),
    []
  );

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  // Sélection des joueurs
  const setSelectedPlayers = useCallback(
    (players: Player[]) => dispatch({ type: 'SET_SELECTED_PLAYERS', players }),
    []
  );

  const setSelectedPlayersAndContinue = useCallback(
    (players: Player[]) => {
      const navigateTo = state.isLegacyMode ? 'legacy-scores' : 'keys';
      dispatch({ type: 'SET_SELECTED_PLAYERS', players, navigateTo });
    },
    [state.isLegacyMode]
  );

  const getCurrentPlayer = useCallback((): SelectedPlayer | null => {
    if (state.selectedPlayers.length === 0) return null;
    if (state.currentPlayerIndex >= state.selectedPlayers.length) return null;
    return state.selectedPlayers[state.currentPlayerIndex];
  }, [state.selectedPlayers, state.currentPlayerIndex]);

  // Plateau du joueur courant
  const setCards = useCallback(
    (cards: GameCard[], captureId?: string) =>
      dispatch({ type: 'SET_CARDS', cards, captureId }),
    []
  );

  const updateCard = useCallback(
    (position: number, cardId: string, alternatives?: CardMatch[]) =>
      dispatch({ type: 'UPDATE_CARD', position, cardId, alternatives }),
    []
  );

  const setKeys = useCallback(
    (keys: number) => dispatch({ type: 'SET_KEYS', keys }),
    []
  );

  const setCoins = useCallback(
    (coins: number) => dispatch({ type: 'SET_COINS', coins }),
    []
  );

  // Capture
  const setCaptureId = useCallback(
    (captureId: string) => dispatch({ type: 'SET_CAPTURE_ID', captureId }),
    []
  );

  const getPreviousCaptureId = useCallback(
    (): string | undefined => state.captureId,
    [state.captureId]
  );

  // Flux multi-joueurs
  const recalculateCurrentPlayerScore = useCallback(async () => {
    if (state.cards.length !== 9) return;

    const cardIds = state.cards
      .sort((a, b) => a.position - b.position)
      .map((c) => c.cardId);

    try {
      const score = await calculateScore({
        cards: cardIds,
        keys: state.keys,
        total_coins: state.coins,
      });
      dispatch({ type: 'SET_SCORE', score });
    } catch (error) {
      console.error('Failed to calculate score:', error);
    }
  }, [state.cards, state.keys, state.coins]);

  const saveCurrentPlayerAndNext = useCallback(async (): Promise<boolean> => {
    if (state.cards.length !== 9) return false;

    const cardIds = state.cards
      .sort((a, b) => a.position - b.position)
      .map((c) => c.cardId);

    let score: CalculateResponse;
    try {
      score = await calculateScore({
        cards: cardIds,
        keys: state.keys,
        total_coins: state.coins,
      });
    } catch (error) {
      console.error('Failed to calculate score:', error);
      return false;
    }

    // Sauvegarder le joueur courant
    dispatch({ type: 'SAVE_CURRENT_PLAYER', score });

    const nextIndex = state.currentPlayerIndex + 1;
    const hasMorePlayers = nextIndex < state.selectedPlayers.length;

    // Passer au joueur suivant
    dispatch({ type: 'NEXT_PLAYER' });

    return hasMorePlayers;
  }, [state.cards, state.keys, state.coins, state.currentPlayerIndex, state.selectedPlayers.length]);

  const saveGame = useCallback(async () => {
    if (state.selectedPlayers.length < 2) return;

    const allComplete = state.selectedPlayers.every(
      (p) => p.cards.length === 9 && p.score !== null
    );
    if (!allComplete) {
      console.error('Not all players have complete data');
      return;
    }

    try {
      await createGame({
        players: state.selectedPlayers.map((p) => ({
          player_id: p.id,
          keys: p.keys,
          coins: p.coins,
          cards: p.cards
            .sort((a, b) => a.position - b.position)
            .map((c) => c.cardId),
          score: p.score?.total_score ?? 0,
        })),
      });
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  }, [state.selectedPlayers]);

  return (
    <GameContext.Provider
      value={{
        state,
        // Navigation
        setStep,
        reset,
        // Sélection des joueurs
        setSelectedPlayers,
        setSelectedPlayersAndContinue,
        getCurrentPlayer,
        // Plateau du joueur courant
        setCards,
        updateCard,
        setKeys,
        setCoins,
        // Capture
        setCaptureId,
        getPreviousCaptureId,
        // Flux multi-joueurs
        saveCurrentPlayerAndNext,
        recalculateCurrentPlayerScore,
        saveGame,
        // Mode legacy (délégué au hook)
        setLegacyMode: legacy.setLegacyMode,
        setLegacyCardScores: legacy.setLegacyCardScores,
        saveLegacyPlayerAndNext: legacy.saveLegacyPlayerAndNext,
        saveLegacyGame: legacy.saveLegacyGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
