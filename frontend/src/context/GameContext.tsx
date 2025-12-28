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
} from '../types';
import { calculateScore } from '../services/api';

interface GameContextType {
  state: GameState;
  setStep: (step: GameState['step']) => void;
  setCards: (cards: GameCard[]) => void;
  updateCard: (position: number, cardId: string, alternatives?: CardMatch[]) => void;
  setKeys: (keys: number) => void;
  setCoins: (coins: number) => void;
  recalculateScore: () => Promise<void>;
  reset: () => void;
}

const initialState: GameState = {
  step: 'landing',
  cards: [],
  keys: 0,
  coins: 0,
  score: null,
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);

  const setStep = useCallback((step: GameState['step']) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const setCards = useCallback((cards: GameCard[]) => {
    setState((prev) => ({ ...prev, cards }));
  }, []);

  const updateCard = useCallback(
    (position: number, cardId: string, alternatives?: CardMatch[]) => {
      setState((prev) => ({
        ...prev,
        cards: prev.cards.map((card) =>
          card.position === position
            ? {
                ...card,
                cardId,
                confidence: 1.0, // Manual selection = full confidence
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

  const recalculateScore = useCallback(async () => {
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

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <GameContext.Provider
      value={{
        state,
        setStep,
        setCards,
        updateCard,
        setKeys,
        setCoins,
        recalculateScore,
        reset,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
