/**
 * Play Context - Contexte pour le mode "Jouer avec IA"
 *
 * Ce contexte gere :
 * - La configuration de partie (joueurs, IA)
 * - L'execution du jeu (actions, tours)
 * - L'integration avec les IA
 * - Les choix d'effets
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  PlayGameState,
  PlayGameConfig,
  GameAction,
  AILevel,
  PlayPlayer,
  ShiftDirection,
  GameLogEntry,
  LogActionType,
} from '../types/play';
import {
  createGame,
  loadCardData,
  executeAction,
  validateAction,
  getCurrentPlayer,
  getAvailableCards,
  canAffordCard,
  getCard,
} from '../services/play/gameEngine';
import { createAI } from '../services/play/ai';
import { executeCardEffect } from '../services/play/effectExecutor';
import {
  playReducer,
  initialPlayUIState,
  type PlayUIState,
  type PlayStep,
} from './playReducer';

// =============================================================================
// Types du contexte
// =============================================================================

interface PlayContextType {
  state: PlayUIState;

  // Navigation
  setStep: (step: PlayStep) => void;
  reset: () => void;

  // Configuration
  addPlayer: (name: string, isAI: boolean, aiLevel?: AILevel) => void;
  removePlayer: (index: number) => void;
  updatePlayer: (index: number, updates: Partial<PlayGameConfig['players'][0]>) => void;
  setPlayerColor: (index: number, color: string) => void;

  // Demarrage de partie
  startGame: (config?: PlayGameConfig) => Promise<void>;

  // Actions de jeu
  executeGameAction: (action: GameAction) => Promise<void>;
  buyCard: (cardId: string) => Promise<void>;
  buyCardFlipped: (cardId: string) => Promise<void>;
  placeCard: (position: number) => Promise<void>;
  chooseEffect: (choiceIndex: number) => Promise<void>;
  spendKey: (targetLocation: 'castle' | 'village') => Promise<void>;
  useKeyOnLock: (lockPosition: number) => Promise<void>;
  shiftBoard: (direction: ShiftDirection) => Promise<void>;
  endTurn: () => Promise<void>;

  // Helpers
  getCurrentPlayer: () => PlayPlayer | null;
  getAvailableCards: () => string[];
  canAffordCard: (cardId: string) => { canAfford: boolean; cost: number };
  isCurrentPlayerAI: () => boolean;
  isMyTurn: (playerId: string) => boolean;

  // Logs
  toggleGameLog: () => void;
  gameLog: GameLogEntry[];
  showGameLog: boolean;
}

const PlayContext = createContext<PlayContextType | null>(null);

// =============================================================================
// Helpers pour les logs
// =============================================================================

// Cache des noms de cartes
let cardNamesCache: Record<string, string> | null = null;

async function loadCardNames(): Promise<Record<string, string>> {
  if (cardNamesCache) return cardNamesCache;

  try {
    const response = await fetch('/api/cards');
    if (response.ok) {
      const data = await response.json();
      cardNamesCache = {};
      for (const card of data.cards) {
        cardNamesCache[card.id] = card.name;
      }
    }
  } catch {
    cardNamesCache = {};
  }

  return cardNamesCache ?? {};
}

function getCardName(cardId: string): string {
  return cardNamesCache?.[cardId] ?? `Carte ${cardId}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getLogActionType(actionType: string): LogActionType {
  switch (actionType) {
    case 'buy_card':
    case 'buy_card_flipped':
      return 'buy';
    case 'place_card':
      return 'place';
    case 'use_key_on_lock':
    case 'spend_key':
      return 'key';
    case 'shift_board':
      return 'shift';
    default:
      return 'other';
  }
}

function getPositionName(position: number): string {
  const names: Record<number, string> = {
    0: 'En haut à gauche',
    1: 'En haut au centre',
    2: 'En haut à droite',
    3: 'Au centre à gauche',
    4: 'Au centre',
    5: 'Au centre à droite',
    6: 'En bas à gauche',
    7: 'En bas au centre',
    8: 'En bas à droite',
  };
  return names[position] ?? `Position ${position}`;
}

// =============================================================================
// Provider
// =============================================================================

export function PlayProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playReducer, initialPlayUIState);
  const aiLoopRef = useRef<boolean>(false);
  const dataLoadedRef = useRef<boolean>(false);

  // Charger les donnees des cartes au montage
  useEffect(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      loadCardData().catch(console.error);
      loadCardNames().catch(console.error);
    }
  }, []);

  // Navigation
  const setStep = useCallback((step: PlayStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const reset = useCallback(() => {
    aiLoopRef.current = false;
    dispatch({ type: 'RESET' });
  }, []);

  // Logs
  const toggleGameLog = useCallback(() => {
    dispatch({ type: 'TOGGLE_LOG' });
  }, []);

  const addLogEntry = useCallback((
    player: PlayPlayer,
    turnNumber: number,
    actionType: LogActionType,
    options: {
      cardId?: string;
      description?: string;
      position?: number;
      resourcesBefore?: { gold: number; keys: number };
      resourcesAfter?: { gold: number; keys: number };
    }
  ) => {
    const entry: GameLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      turnNumber,
      playerName: player.name,
      playerColor: player.color,
      actionType,
      cardName: options.cardId ? getCardName(options.cardId) : undefined,
      description: options.description,
      position: options.position,
      resourcesBefore: options.resourcesBefore,
      resourcesAfter: options.resourcesAfter,
    };
    dispatch({ type: 'ADD_LOG_ENTRY', entry });
  }, []);

  // Configuration
  const addPlayer = useCallback((name: string, isAI: boolean, aiLevel?: AILevel) => {
    dispatch({ type: 'ADD_PLAYER', name, color: '', isAI, aiLevel });
  }, []);

  const removePlayer = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_PLAYER', index });
  }, []);

  const updatePlayer = useCallback(
    (index: number, updates: Partial<PlayGameConfig['players'][0]>) => {
      dispatch({
        type: 'UPDATE_PLAYER',
        index,
        name: updates.name,
        color: updates.color,
        isAI: updates.isAI,
        aiLevel: updates.aiLevel,
      });
    },
    []
  );

  const setPlayerColor = useCallback((index: number, color: string) => {
    dispatch({ type: 'UPDATE_PLAYER', index, color });
  }, []);

  // Demarrage de partie
  const startGame = useCallback(async (configOverride?: PlayGameConfig) => {
    const config = configOverride ?? state.config;

    if (!config || config.players.length < 2) {
      dispatch({ type: 'SET_ERROR', error: 'Il faut au moins 2 joueurs' });
      return;
    }

    dispatch({ type: 'SET_LOADING', isLoading: true });

    try {
      // Charger les donnees si pas deja fait
      await loadCardData();

      // Creer la partie
      const gameState = createGame(config);
      dispatch({ type: 'GAME_STARTED', gameState });

      // Si le premier joueur est une IA, lancer son tour
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.isAI) {
        setTimeout(() => runAITurn(gameState), 500);
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        error: error instanceof Error ? error.message : 'Erreur au demarrage',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [state.config]);

  // Appliquer les effets apres placement
  const applyCardEffects = useCallback((
    gameState: PlayGameState,
    cardId: string,
    position: number,
    choiceIndex?: number
  ): { newState: PlayGameState; requiresChoice: boolean; choices?: unknown[]; description: string } => {
    const result = executeCardEffect(gameState, cardId, position, choiceIndex);

    if (result.requiresChoice && result.choices) {
      return {
        newState: result.newState,
        requiresChoice: true,
        choices: result.choices,
        description: result.description,
      };
    }

    return {
      newState: result.newState,
      requiresChoice: false,
      description: result.description,
    };
  }, []);

  // Execution des actions
  const executeGameAction = useCallback(async (action: GameAction) => {
    if (!state.gameState) return;

    const validation = validateAction(state.gameState, action);
    if (!validation.isValid) {
      dispatch({ type: 'SET_ERROR', error: validation.reason ?? 'Action invalide' });
      return;
    }

    // Capturer les ressources avant l'action
    const playerBefore = state.gameState.players[state.gameState.currentPlayerIndex];
    const resourcesBefore = { gold: playerBefore.gold, keys: playerBefore.keys };
    const turnNumber = state.gameState.turnNumber;

    let newState = executeAction(state.gameState, action);

    // Logger l'action (sauf end_turn et choose_effect qui sont speciaux)
    if (action.type !== 'end_turn' && action.type !== 'choose_effect') {
      const playerAfter = newState.players[newState.currentPlayerIndex];
      const resourcesAfter = { gold: playerAfter.gold, keys: playerAfter.keys };
      const logActionType = getLogActionType(action.type);

      // Determiner la position selon le type d'action
      const position = action.type === 'use_key_on_lock'
        ? action.lockPosition
        : action.position;

      // Determiner le cardId et description selon le type
      if (logActionType === 'buy') {
        addLogEntry(playerBefore, turnNumber, logActionType, {
          cardId: action.cardId,
          resourcesBefore,
          resourcesAfter,
        });
      } else if (logActionType === 'place') {
        addLogEntry(playerBefore, turnNumber, logActionType, {
          description: position !== undefined ? getPositionName(position) : undefined,
          position,
          resourcesBefore,
          resourcesAfter,
        });
      } else {
        // key, shift, other
        addLogEntry(playerBefore, turnNumber, logActionType, {
          position,
          resourcesBefore,
          resourcesAfter,
        });
      }
    }

    // Appliquer les effets si on vient de placer une carte
    if (action.type === 'place_card' && state.gameState.purchasedCard) {
      const cardId = state.gameState.purchasedCard;
      const card = getCard(cardId);

      if (card && card.effects.length > 0) {
        const beforeEffect = newState.players[newState.currentPlayerIndex];
        const effectResult = applyCardEffects(newState, cardId, action.position!);

        if (effectResult.requiresChoice && effectResult.choices) {
          dispatch({
            type: 'EFFECT_CHOICE_REQUIRED',
            options: effectResult.choices as never[],
            cardId,
          });
          dispatch({ type: 'SET_GAME_STATE', gameState: newState });
          return;
        }

        newState = effectResult.newState;

        // Logger l'effet avec la description de l'effet
        const afterEffect = newState.players[newState.currentPlayerIndex];
        if (beforeEffect.gold !== afterEffect.gold || beforeEffect.keys !== afterEffect.keys) {
          addLogEntry(playerBefore, turnNumber, 'effect', {
            description: effectResult.description,
            resourcesBefore: { gold: beforeEffect.gold, keys: beforeEffect.keys },
            resourcesAfter: { gold: afterEffect.gold, keys: afterEffect.keys },
          });
        }
      }

      // Passer a la phase post_action apres les effets
      newState = { ...newState, turnPhase: 'post_action' };
    }

    // Appliquer le choix d'effet
    if (action.type === 'choose_effect' && state.pendingEffectChoice) {
      const cardId = state.pendingEffectChoice.cardId;
      const choiceIndex = action.choiceIndex ?? 0;

      // Trouver la position de la derniere carte placee
      const player = newState.players[newState.currentPlayerIndex];
      const lastPosition = player.board.findIndex(c => c !== null && c.cardId === cardId);

      const beforeEffect = newState.players[newState.currentPlayerIndex];
      let effectDescription = '';

      if (lastPosition >= 0) {
        const effectResult = applyCardEffects(newState, cardId, lastPosition, choiceIndex);
        newState = effectResult.newState;
        effectDescription = effectResult.description;
      }

      // Logger le choix d'effet avec la description
      const afterEffect = newState.players[newState.currentPlayerIndex];
      addLogEntry(playerBefore, turnNumber, 'effect', {
        description: effectDescription,
        resourcesBefore: { gold: beforeEffect.gold, keys: beforeEffect.keys },
        resourcesAfter: { gold: afterEffect.gold, keys: afterEffect.keys },
      });

      // Passer a la phase post_action apres le choix
      newState = { ...newState, turnPhase: 'post_action' };

      dispatch({ type: 'EFFECT_CHOICE_MADE', choiceIndex });
    }

    // Verifier si la partie est terminee
    if (newState.phase === 'ended') {
      dispatch({ type: 'GAME_ENDED', gameState: newState });
      return;
    }

    dispatch({ type: 'GAME_ACTION_EXECUTED', gameState: newState });

    // Si on vient de terminer le tour et que le prochain joueur est une IA
    if (action.type === 'end_turn') {
      const nextPlayer = newState.players[newState.currentPlayerIndex];
      if (nextPlayer.isAI) {
        setTimeout(() => runAITurn(newState), 500);
      }
    }
  }, [state.gameState, state.pendingEffectChoice, applyCardEffects, addLogEntry]);

  // Actions simplifiees
  const buyCard = useCallback(async (cardId: string) => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'buy_card', playerId, cardId });
  }, [state.gameState, executeGameAction]);

  const buyCardFlipped = useCallback(async (cardId: string) => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'buy_card_flipped', playerId, cardId });
  }, [state.gameState, executeGameAction]);

  const placeCard = useCallback(async (position: number) => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'place_card', playerId, position });
  }, [state.gameState, executeGameAction]);

  const chooseEffect = useCallback(async (choiceIndex: number) => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'choose_effect', playerId, choiceIndex });
  }, [state.gameState, executeGameAction]);

  const spendKey = useCallback(async (targetLocation: 'castle' | 'village') => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'spend_key', playerId, targetLocation });
  }, [state.gameState, executeGameAction]);

  const useKeyOnLock = useCallback(async (lockPosition: number) => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'use_key_on_lock', playerId, lockPosition });
  }, [state.gameState, executeGameAction]);

  const shiftBoardAction = useCallback(async (direction: ShiftDirection) => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'shift_board', playerId, shiftDirection: direction });
  }, [state.gameState, executeGameAction]);

  const endTurn = useCallback(async () => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'end_turn', playerId });
  }, [state.gameState, executeGameAction]);

  // Boucle IA
  const runAITurn = useCallback(async (gameState: PlayGameState) => {
    if (aiLoopRef.current) return;
    aiLoopRef.current = true;

    dispatch({ type: 'AI_THINKING_START' });

    try {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isAI || !currentPlayer.aiLevel) {
        dispatch({ type: 'AI_THINKING_END' });
        aiLoopRef.current = false;
        return;
      }

      const ai = createAI(currentPlayer.aiLevel);
      let currentState = gameState;

      // L'IA joue son tour complet
      while (currentState.players[currentState.currentPlayerIndex].id === currentPlayer.id) {
        // Petit delai pour que l'utilisateur voie les actions
        await new Promise(resolve => setTimeout(resolve, 300));

        const action = await ai.selectAction(currentState);
        const validation = validateAction(currentState, action);

        if (!validation.isValid) {
          console.error('AI invalid action:', validation.reason);
          break;
        }

        // Capturer les ressources avant l'action
        const playerBefore = currentState.players[currentState.currentPlayerIndex];
        const resourcesBefore = { gold: playerBefore.gold, keys: playerBefore.keys };
        const turnNumber = currentState.turnNumber;

        const purchasedCard = currentState.purchasedCard;
        currentState = executeAction(currentState, action);

        // Logger l'action de l'IA
        if (action.type !== 'end_turn') {
          const playerAfter = currentState.players[currentState.currentPlayerIndex];
          const resourcesAfter = { gold: playerAfter.gold, keys: playerAfter.keys };
          const logActionType = getLogActionType(action.type);

          // Determiner la position selon le type d'action
          const position = action.type === 'use_key_on_lock'
            ? action.lockPosition
            : action.position;

          // Determiner le log selon le type
          if (logActionType === 'buy') {
            addLogEntry(playerBefore, turnNumber, logActionType, {
              cardId: action.cardId,
              resourcesBefore,
              resourcesAfter,
            });
          } else if (logActionType === 'place') {
            addLogEntry(playerBefore, turnNumber, logActionType, {
              description: position !== undefined ? getPositionName(position) : undefined,
              position,
              resourcesBefore,
              resourcesAfter,
            });
          } else {
            addLogEntry(playerBefore, turnNumber, logActionType, {
              position,
              resourcesBefore,
              resourcesAfter,
            });
          }
        }

        // Appliquer les effets
        if (action.type === 'place_card' && purchasedCard) {
          const card = getCard(purchasedCard);
          if (card && card.effects.length > 0) {
            const hasChoice = card.effects.some(e => e.type === 'choice');

            // L'IA choisit automatiquement (option 0 ou 1 selon heuristique)
            const choiceIndex = hasChoice && currentPlayer.board.filter(c => c !== null).length >= 6 ? 1 : 0;

            const beforeEffect = currentState.players[currentState.currentPlayerIndex];
            const effectResult = executeCardEffect(currentState, purchasedCard, action.position!, choiceIndex);
            currentState = effectResult.newState;

            // Logger l'effet avec la description
            const afterEffect = currentState.players[currentState.currentPlayerIndex];
            if (beforeEffect.gold !== afterEffect.gold || beforeEffect.keys !== afterEffect.keys) {
              addLogEntry(playerBefore, turnNumber, 'effect', {
                description: effectResult.description,
                resourcesBefore: { gold: beforeEffect.gold, keys: beforeEffect.keys },
                resourcesAfter: { gold: afterEffect.gold, keys: afterEffect.keys },
              });
            }
          }
        }

        dispatch({ type: 'SET_GAME_STATE', gameState: currentState });

        // Verifier si la partie est terminee
        if (currentState.phase === 'ended') {
          dispatch({ type: 'GAME_ENDED', gameState: currentState });
          aiLoopRef.current = false;
          return;
        }

        // Verifier si le tour est termine
        if (action.type === 'end_turn') {
          break;
        }
      }

      dispatch({ type: 'AI_THINKING_END' });

      // Si le prochain joueur est aussi une IA, continuer
      const nextPlayer = currentState.players[currentState.currentPlayerIndex];
      if (nextPlayer.isAI && currentState.phase !== 'ended') {
        setTimeout(() => runAITurn(currentState), 500);
      }
    } catch (error) {
      dispatch({
        type: 'AI_ERROR',
        error: error instanceof Error ? error.message : 'Erreur IA',
      });
    }

    aiLoopRef.current = false;
  }, [addLogEntry]);

  // Helpers
  const getCurrentPlayerFn = useCallback((): PlayPlayer | null => {
    if (!state.gameState) return null;
    return getCurrentPlayer(state.gameState);
  }, [state.gameState]);

  const getAvailableCardsFn = useCallback((): string[] => {
    if (!state.gameState) return [];
    return getAvailableCards(state.gameState);
  }, [state.gameState]);

  const canAffordCardFn = useCallback(
    (cardId: string): { canAfford: boolean; cost: number } => {
      if (!state.gameState) return { canAfford: false, cost: 0 };
      const player = getCurrentPlayer(state.gameState);
      return canAffordCard(player, cardId);
    },
    [state.gameState]
  );

  const isCurrentPlayerAI = useCallback((): boolean => {
    if (!state.gameState) return false;
    const player = getCurrentPlayer(state.gameState);
    return player.isAI;
  }, [state.gameState]);

  const isMyTurn = useCallback(
    (playerId: string): boolean => {
      if (!state.gameState) return false;
      const currentPlayer = getCurrentPlayer(state.gameState);
      return currentPlayer.id === playerId && !currentPlayer.isAI;
    },
    [state.gameState]
  );

  return (
    <PlayContext.Provider
      value={{
        state,
        // Navigation
        setStep,
        reset,
        // Configuration
        addPlayer,
        removePlayer,
        updatePlayer,
        setPlayerColor,
        // Demarrage
        startGame,
        // Actions
        executeGameAction,
        buyCard,
        buyCardFlipped,
        placeCard,
        chooseEffect,
        spendKey,
        useKeyOnLock,
        shiftBoard: shiftBoardAction,
        endTurn,
        // Helpers
        getCurrentPlayer: getCurrentPlayerFn,
        getAvailableCards: getAvailableCardsFn,
        canAffordCard: canAffordCardFn,
        isCurrentPlayerAI,
        isMyTurn,
        // Logs
        toggleGameLog,
        gameLog: state.gameLog,
        showGameLog: state.showGameLog,
      }}
    >
      {children}
    </PlayContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function usePlay() {
  const context = useContext(PlayContext);
  if (!context) {
    throw new Error('usePlay must be used within a PlayProvider');
  }
  return context;
}
