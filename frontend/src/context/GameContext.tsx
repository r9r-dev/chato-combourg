import {
  createContext,
  useContext,
  useState,
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
  LegacyPlayerCreate,
  GameDetail,
} from '../types';
import { calculateScore, createGame, createLegacyGame } from '../services/api';

interface GameContextType {
  state: GameState;
  setStep: (step: GameState['step']) => void;
  // Player selection
  setSelectedPlayers: (players: Player[]) => void;
  setSelectedPlayersAndContinue: (players: Player[]) => void; // Sets players and navigates based on mode
  getCurrentPlayer: () => SelectedPlayer | null;
  // Current player's board
  setCards: (cards: GameCard[], captureId?: string) => void;
  updateCard: (position: number, cardId: string, alternatives?: CardMatch[]) => void;
  setKeys: (keys: number) => void;
  setCoins: (coins: number) => void;
  // Capture management
  setCaptureId: (captureId: string) => void;
  getPreviousCaptureId: () => string | undefined;
  // Flow control
  saveCurrentPlayerAndNext: () => Promise<boolean>; // Returns true if more players
  recalculateCurrentPlayerScore: () => Promise<void>;
  // Game management
  saveGame: () => Promise<void>;
  reset: () => void;
  // Legacy mode
  setLegacyMode: (isLegacy: boolean) => void;
  setLegacyCardScores: (scores: number[]) => void;
  saveLegacyPlayerAndNext: () => Promise<boolean>; // Returns true if more players
  saveLegacyGame: () => Promise<GameDetail | null>; // Save all legacy players and return game
}

const initialState: GameState = {
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

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);

  const setStep = useCallback((step: GameState['step']) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const setSelectedPlayers = useCallback((players: Player[]) => {
    const selectedPlayers: SelectedPlayer[] = players.map((p) => ({
      ...p,
      keys: 0,
      coins: 0,
      cards: [],
      score: null,
      captureId: undefined,
      originalCards: undefined,
    }));
    setState((prev) => ({
      ...prev,
      selectedPlayers,
      currentPlayerIndex: 0,
      // Reset current player's board
      cards: [],
      keys: 0,
      coins: 0,
      score: null,
      captureId: undefined,
      originalCards: undefined,
    }));
  }, []);

  // Combined function that sets players and navigates based on legacy mode
  // This ensures we read isLegacyMode from the latest state
  const setSelectedPlayersAndContinue = useCallback((players: Player[]) => {
    const selectedPlayers: SelectedPlayer[] = players.map((p) => ({
      ...p,
      keys: 0,
      coins: 0,
      cards: [],
      score: null,
      captureId: undefined,
      originalCards: undefined,
    }));
    setState((prev) => ({
      ...prev,
      selectedPlayers,
      currentPlayerIndex: 0,
      // Reset current player's board
      cards: [],
      keys: 0,
      coins: 0,
      score: null,
      captureId: undefined,
      originalCards: undefined,
      // Navigate based on mode - using prev ensures we get the latest isLegacyMode
      step: prev.isLegacyMode ? 'legacy-scores' : 'keys',
    }));
  }, []);

  const getCurrentPlayer = useCallback((): SelectedPlayer | null => {
    if (state.selectedPlayers.length === 0) return null;
    if (state.currentPlayerIndex >= state.selectedPlayers.length) return null;
    return state.selectedPlayers[state.currentPlayerIndex];
  }, [state.selectedPlayers, state.currentPlayerIndex]);

  const setCards = useCallback((cards: GameCard[], captureId?: string) => {
    setState((prev) => ({
      ...prev,
      cards,
      captureId: captureId ?? prev.captureId,
      // Store original cards for comparison later (deep copy)
      originalCards: cards.map(c => ({ ...c })),
    }));
  }, []);

  const setCaptureId = useCallback((captureId: string) => {
    setState((prev) => ({ ...prev, captureId }));
  }, []);

  const getPreviousCaptureId = useCallback((): string | undefined => {
    return state.captureId;
  }, [state.captureId]);

  const updateCard = useCallback(
    (position: number, cardId: string, alternatives?: CardMatch[]) => {
      setState((prev) => ({
        ...prev,
        cards: prev.cards.map((card) =>
          card.position === position
            ? {
                ...card,
                cardId,
                confidence: 1.0,
                alternatives: alternatives ?? card.alternatives,
              }
            : card
        ),
      }));
    },
    []
  );

  const setKeys = useCallback((keys: number) => {
    setState((prev) => ({ ...prev, keys: Math.max(0, keys) }));
  }, []);

  const setCoins = useCallback((coins: number) => {
    setState((prev) => ({ ...prev, coins: Math.max(0, coins) }));
  }, []);

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
      setState((prev) => ({ ...prev, score }));
    } catch (error) {
      console.error('Failed to calculate score:', error);
    }
  }, [state.cards, state.keys, state.coins]);

  const saveCurrentPlayerAndNext = useCallback(async (): Promise<boolean> => {
    // Calculate score for current player
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

    // Update current player with their data
    const updatedPlayers = [...state.selectedPlayers];
    updatedPlayers[state.currentPlayerIndex] = {
      ...updatedPlayers[state.currentPlayerIndex],
      keys: state.keys,
      coins: state.coins,
      cards: [...state.cards],
      score,
      captureId: state.captureId,
      originalCards: state.originalCards ? [...state.originalCards] : undefined,
    };

    const nextIndex = state.currentPlayerIndex + 1;
    const hasMorePlayers = nextIndex < state.selectedPlayers.length;

    setState((prev) => ({
      ...prev,
      selectedPlayers: updatedPlayers,
      currentPlayerIndex: nextIndex,
      // Reset for next player
      cards: [],
      keys: 0,
      coins: 0,
      score: null,
      captureId: undefined,
      originalCards: undefined,
    }));

    return hasMorePlayers;
  }, [state]);

  const saveGame = useCallback(async () => {
    if (state.selectedPlayers.length < 2) return;

    // Ensure all players have complete data
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

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Legacy mode functions
  const setLegacyMode = useCallback((isLegacy: boolean) => {
    setState((prev) => ({
      ...prev,
      isLegacyMode: isLegacy,
      legacyCardScores: isLegacy ? [0, 0, 0, 0, 0, 0, 0, 0, 0] : undefined,
    }));
  }, []);

  const setLegacyCardScores = useCallback((scores: number[]) => {
    setState((prev) => ({ ...prev, legacyCardScores: scores }));
  }, []);

  const saveLegacyPlayerAndNext = useCallback(async (): Promise<boolean> => {
    const cardScores = state.legacyCardScores ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const totalScore = cardScores.reduce((sum, s) => sum + s, 0) + state.keys;

    // Update current player with their data
    const updatedPlayers = [...state.selectedPlayers];
    updatedPlayers[state.currentPlayerIndex] = {
      ...updatedPlayers[state.currentPlayerIndex],
      keys: state.keys,
      coins: 0,
      cards: [], // No cards in legacy mode
      score: {
        total_score: totalScore,
        keys_bonus: state.keys,
        cards_score: cardScores.reduce((sum, s) => sum + s, 0),
        details: cardScores.map((score, position) => ({
          position,
          card_id: '',
          score,
          explanation: 'Score saisi manuellement',
        })),
      },
      // Store card scores in a custom property (we'll need this for the API)
      legacyCardScores: cardScores,
    } as SelectedPlayer & { legacyCardScores: number[] };

    const nextIndex = state.currentPlayerIndex + 1;
    const hasMorePlayers = nextIndex < state.selectedPlayers.length;

    if (hasMorePlayers) {
      setState((prev) => ({
        ...prev,
        selectedPlayers: updatedPlayers,
        currentPlayerIndex: nextIndex,
        keys: 0,
        legacyCardScores: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      }));
    } else {
      // Last player - save game and go to summary
      setState((prev) => ({
        ...prev,
        selectedPlayers: updatedPlayers,
        currentPlayerIndex: nextIndex,
      }));

      // Save the game to backend
      try {
        const players: LegacyPlayerCreate[] = updatedPlayers.map((p) => ({
          player_id: p.id,
          keys: p.keys,
          card_scores: (p as SelectedPlayer & { legacyCardScores?: number[] }).legacyCardScores ?? [0, 0, 0, 0, 0, 0, 0, 0, 0],
        }));
        await createLegacyGame({ players });
      } catch (error) {
        console.error('Failed to save legacy game:', error);
      }

      // Go to summary
      setState((prev) => ({ ...prev, step: 'summary' }));
    }

    return hasMorePlayers;
  }, [state]);

  const saveLegacyGame = useCallback(async (): Promise<GameDetail | null> => {
    if (state.selectedPlayers.length < 2) return null;

    try {
      const players: LegacyPlayerCreate[] = state.selectedPlayers.map((p) => ({
        player_id: p.id,
        keys: p.keys,
        card_scores: (p as SelectedPlayer & { legacyCardScores?: number[] }).legacyCardScores ?? [0, 0, 0, 0, 0, 0, 0, 0, 0],
      }));

      return await createLegacyGame({ players });
    } catch (error) {
      console.error('Failed to save legacy game:', error);
      return null;
    }
  }, [state.selectedPlayers]);

  return (
    <GameContext.Provider
      value={{
        state,
        setStep,
        setSelectedPlayers,
        setSelectedPlayersAndContinue,
        getCurrentPlayer,
        setCards,
        updateCard,
        setKeys,
        setCoins,
        setCaptureId,
        getPreviousCaptureId,
        saveCurrentPlayerAndNext,
        recalculateCurrentPlayerScore,
        saveGame,
        reset,
        setLegacyMode,
        setLegacyCardScores,
        saveLegacyPlayerAndNext,
        saveLegacyGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
