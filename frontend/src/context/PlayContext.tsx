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
  DiscardChoice,
  ReplaceLocationChoice,
  AdjacentCardChoice,
  PurseSelectionChoice,
  Location,
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
  refillLocations,
} from '../services/play/gameEngine';
import { createAI } from '../services/play/ai';
import { executeCardEffect, executeDiscardEffect, executeLockEffect, executeReplaceLocationEffect, executeAdjacentCardEffect, executeFillPursesAtPositions } from '../services/play/effectExecutor';
import { applyOptimalShift } from '../services/play/shiftHelper';
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
  placeCard: (position: number, shiftDirection?: ShiftDirection) => Promise<void>;
  chooseEffect: (choiceIndex: number) => Promise<void>;
  spendKey: (targetLocation: 'castle' | 'village') => Promise<void>;
  useKeyOnLock: (lockPosition: number) => Promise<void>;
  endTurn: () => Promise<void>;

  // Helpers
  getCurrentPlayer: () => PlayPlayer | null;
  getAvailableCards: () => string[];
  canAffordCard: (cardId: string) => { canAfford: boolean; cost: number };
  isCurrentPlayerAI: () => boolean;
  isMyTurn: (playerId: string) => boolean;

  // Choix de carte a defausser
  pendingDiscardChoice: DiscardChoice | null;
  selectDiscardCard: (cardId: string) => Promise<void>;

  // Choix de lieu a remplacer
  pendingReplaceLocationChoice: ReplaceLocationChoice | null;
  selectReplaceLocation: (location: Location) => Promise<void>;

  // Choix de carte adjacente
  pendingAdjacentCardChoice: AdjacentCardChoice | null;
  selectAdjacentCard: (position: number) => Promise<void>;

  // Choix de bourses a remplir
  pendingPurseSelectionChoice: PurseSelectionChoice | null;
  selectPurses: (positions: number[]) => Promise<void>;

  // Logs
  toggleGameLog: () => void;
  gameLog: GameLogEntry[];
  showGameLog: boolean;

  // Debug (dev mode only)
  debugRefreshCards: () => void;
  debugMoveMessenger: () => void;
  debugAddResources: () => void;
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
      isFlipped?: boolean;
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
      isFlipped: options.isFlipped,
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
        error: error instanceof Error ? error.message : 'Erreur au démarrage',
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
  ): {
    newState: PlayGameState;
    requiresChoice: boolean;
    choices?: unknown[];
    discardChoice?: DiscardChoice;
    purseSelectionChoice?: PurseSelectionChoice;
    description: string;
  } => {
    const result = executeCardEffect(gameState, cardId, position, choiceIndex);

    // Choix entre deux effets [OU]
    if (result.requiresChoice && result.choices) {
      return {
        newState: result.newState,
        requiresChoice: true,
        choices: result.choices,
        description: result.description,
      };
    }

    // Choix de carte a defausser
    if (result.requiresChoice && result.discardChoice) {
      return {
        newState: result.newState,
        requiresChoice: true,
        discardChoice: result.discardChoice,
        description: result.description,
      };
    }

    // Choix de bourses a remplir
    if (result.requiresChoice && result.purseSelectionChoice) {
      return {
        newState: result.newState,
        requiresChoice: true,
        purseSelectionChoice: result.purseSelectionChoice,
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
          isFlipped: action.type === 'buy_card_flipped',
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

        // Choix entre deux effets [OU]
        if (effectResult.requiresChoice && effectResult.choices) {
          dispatch({
            type: 'EFFECT_CHOICE_REQUIRED',
            options: effectResult.choices as never[],
            cardId,
          });
          dispatch({ type: 'SET_GAME_STATE', gameState: newState });
          return;
        }

        // Choix de carte a defausser
        if (effectResult.requiresChoice && effectResult.discardChoice) {
          dispatch({
            type: 'DISCARD_CHOICE_REQUIRED',
            discardChoice: effectResult.discardChoice,
          });
          dispatch({ type: 'SET_GAME_STATE', gameState: newState });
          return;
        }

        // Choix de bourses a remplir
        if (effectResult.requiresChoice && effectResult.purseSelectionChoice) {
          dispatch({
            type: 'PURSE_SELECTION_CHOICE_REQUIRED',
            purseSelectionChoice: effectResult.purseSelectionChoice,
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

      // Remplir les lieux apres le placement et les effets
      const refilledBoard = refillLocations(newState.board);

      // Appliquer le shift helper pour optimiser les points de position
      const currentPlayer = newState.players[newState.currentPlayerIndex];
      const shiftResult = applyOptimalShift(currentPlayer.board, currentPlayer.lockedCards);
      if (shiftResult.shifted) {
        const players = [...newState.players];
        players[newState.currentPlayerIndex] = {
          ...currentPlayer,
          board: shiftResult.board,
          lockedCards: shiftResult.lockedCards,
        };
        newState = { ...newState, players };
      }

      newState = { ...newState, board: refilledBoard, turnPhase: 'post_action' };
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

      // Remplir les lieux apres le choix d'effet
      const refilledBoard = refillLocations(newState.board);

      // Appliquer le shift helper pour optimiser les points de position
      const currentPlayer = newState.players[newState.currentPlayerIndex];
      const shiftResult = applyOptimalShift(currentPlayer.board, currentPlayer.lockedCards);
      if (shiftResult.shifted) {
        const players = [...newState.players];
        players[newState.currentPlayerIndex] = {
          ...currentPlayer,
          board: shiftResult.board,
          lockedCards: shiftResult.lockedCards,
        };
        newState = { ...newState, players };
      }

      // Conserver la phase: si on etait en pre_action (effet de cadenas), rester en pre_action
      const originalPhase = state.gameState.turnPhase;
      const nextPhase = originalPhase === 'pre_action' ? 'pre_action' : 'post_action';
      newState = { ...newState, board: refilledBoard, turnPhase: nextPhase as 'pre_action' | 'post_action' };

      dispatch({ type: 'EFFECT_CHOICE_MADE', choiceIndex });
    }

    // Appliquer l'effet du cadenas
    if (action.type === 'use_key_on_lock' && action.lockPosition !== undefined) {
      const player = newState.players[newState.currentPlayerIndex];
      const placedCard = player.board[action.lockPosition];

      if (placedCard) {
        const beforeEffect = newState.players[newState.currentPlayerIndex];
        const lockResult = executeLockEffect(newState, placedCard.cardId, action.lockPosition);

        if (lockResult.success) {
          // Verifier si l'effet necessite un choix de lieu
          if (lockResult.requiresChoice && lockResult.replaceLocationChoice) {
            dispatch({
              type: 'REPLACE_LOCATION_CHOICE_REQUIRED',
              replaceLocationChoice: lockResult.replaceLocationChoice,
            });
            dispatch({ type: 'SET_GAME_STATE', gameState: newState });
            return;
          }

          // Verifier si l'effet necessite un choix de carte adjacente
          if (lockResult.requiresChoice && lockResult.adjacentCardChoice) {
            dispatch({
              type: 'ADJACENT_CARD_CHOICE_REQUIRED',
              adjacentCardChoice: lockResult.adjacentCardChoice,
            });
            dispatch({ type: 'SET_GAME_STATE', gameState: newState });
            return;
          }

          newState = lockResult.newState;

          // Logger l'effet du cadenas
          const afterEffect = newState.players[newState.currentPlayerIndex];
          if (beforeEffect.gold !== afterEffect.gold || beforeEffect.keys !== afterEffect.keys) {
            addLogEntry(playerBefore, turnNumber, 'effect', {
              description: lockResult.description,
              resourcesBefore: { gold: beforeEffect.gold, keys: beforeEffect.keys },
              resourcesAfter: { gold: afterEffect.gold, keys: afterEffect.keys },
            });
          }
        }
      }
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

  const placeCard = useCallback(async (position: number, shiftDirection?: ShiftDirection) => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'place_card', playerId, position, shiftDirection });
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

  const endTurn = useCallback(async () => {
    if (!state.gameState) return;
    const playerId = getCurrentPlayer(state.gameState).id;
    await executeGameAction({ type: 'end_turn', playerId });
  }, [state.gameState, executeGameAction]);

  // Selection d'une carte a defausser
  const selectDiscardCard = useCallback(async (cardId: string) => {
    if (!state.gameState || !state.pendingDiscardChoice) return;

    const playerBefore = state.gameState.players[state.gameState.currentPlayerIndex];
    const resourcesBefore = { gold: playerBefore.gold, keys: playerBefore.keys };
    const turnNumber = state.gameState.turnNumber;

    // Executer l'effet de defausse
    const result = executeDiscardEffect(state.gameState, state.pendingDiscardChoice, cardId);

    if (!result.success) {
      dispatch({ type: 'SET_ERROR', error: result.description });
      return;
    }

    // Logger l'effet
    const afterEffect = result.newState.players[result.newState.currentPlayerIndex];
    addLogEntry(playerBefore, turnNumber, 'effect', {
      description: result.description,
      resourcesBefore,
      resourcesAfter: { gold: afterEffect.gold, keys: afterEffect.keys },
    });

    // Appliquer le shift helper pour optimiser les points de position
    let newState = result.newState;
    const currentPlayer = newState.players[newState.currentPlayerIndex];
    const shiftResult = applyOptimalShift(currentPlayer.board, currentPlayer.lockedCards);
    if (shiftResult.shifted) {
      const players = [...newState.players];
      players[newState.currentPlayerIndex] = {
        ...currentPlayer,
        board: shiftResult.board,
        lockedCards: shiftResult.lockedCards,
      };
      newState = { ...newState, players };
    }

    // Conserver la phase: si on etait en pre_action, rester en pre_action pour pouvoir acheter
    const originalPhase = state.gameState.turnPhase;
    const nextPhase = originalPhase === 'pre_action' ? 'pre_action' : 'post_action';
    const finalState = { ...newState, turnPhase: nextPhase as 'pre_action' | 'post_action' };

    dispatch({ type: 'DISCARD_CHOICE_MADE' });
    dispatch({ type: 'SET_GAME_STATE', gameState: finalState });
  }, [state.gameState, state.pendingDiscardChoice, addLogEntry]);

  // Selection d'un lieu a remplacer
  const selectReplaceLocation = useCallback(async (location: Location) => {
    if (!state.gameState || !state.pendingReplaceLocationChoice) return;

    const playerBefore = state.gameState.players[state.gameState.currentPlayerIndex];
    const resourcesBefore = { gold: playerBefore.gold, keys: playerBefore.keys };
    const turnNumber = state.gameState.turnNumber;

    // Executer l'effet de remplacement
    const result = executeReplaceLocationEffect(
      state.gameState,
      state.pendingReplaceLocationChoice,
      location
    );

    if (!result.success) {
      dispatch({ type: 'SET_ERROR', error: result.description });
      return;
    }

    // Logger l'effet
    const afterEffect = result.newState.players[result.newState.currentPlayerIndex];
    addLogEntry(playerBefore, turnNumber, 'effect', {
      description: result.description,
      resourcesBefore,
      resourcesAfter: { gold: afterEffect.gold, keys: afterEffect.keys },
    });

    // Appliquer le shift helper pour optimiser les points de position
    let newState = result.newState;
    const currentPlayer = newState.players[newState.currentPlayerIndex];
    const shiftResult = applyOptimalShift(currentPlayer.board, currentPlayer.lockedCards);
    if (shiftResult.shifted) {
      const players = [...newState.players];
      players[newState.currentPlayerIndex] = {
        ...currentPlayer,
        board: shiftResult.board,
        lockedCards: shiftResult.lockedCards,
      };
      newState = { ...newState, players };
    }

    // Conserver la phase: si on etait en pre_action, rester en pre_action pour pouvoir acheter
    // Si on etait en post_action, rester en post_action
    const originalPhase = state.gameState.turnPhase;
    const nextPhase = originalPhase === 'pre_action' ? 'pre_action' : 'post_action';
    const finalState = { ...newState, turnPhase: nextPhase as 'pre_action' | 'post_action' };

    dispatch({ type: 'REPLACE_LOCATION_CHOICE_MADE' });
    dispatch({ type: 'SET_GAME_STATE', gameState: finalState });
  }, [state.gameState, state.pendingReplaceLocationChoice, addLogEntry]);

  // Selection d'une carte adjacente a activer
  const selectAdjacentCard = useCallback(async (position: number) => {
    if (!state.gameState || !state.pendingAdjacentCardChoice) return;

    const playerBefore = state.gameState.players[state.gameState.currentPlayerIndex];
    const resourcesBefore = { gold: playerBefore.gold, keys: playerBefore.keys };
    const turnNumber = state.gameState.turnNumber;

    // Executer l'effet de la carte adjacente
    const result = executeAdjacentCardEffect(
      state.gameState,
      state.pendingAdjacentCardChoice,
      position
    );

    if (!result.success) {
      dispatch({ type: 'SET_ERROR', error: result.description });
      return;
    }

    // Gerer le chainage d'effets: si l'effet de la carte adjacente necessite un choix

    // Cas 1: Effet [OU] - proposer le choix
    if (result.requiresChoice && result.choices) {
      const targetCard = state.gameState.players[state.gameState.currentPlayerIndex].board[position];
      dispatch({ type: 'ADJACENT_CARD_CHOICE_MADE' });
      dispatch({ type: 'SET_GAME_STATE', gameState: result.newState });
      dispatch({
        type: 'EFFECT_CHOICE_REQUIRED',
        options: result.choices,
        cardId: targetCard?.cardId ?? '',
      });
      return;
    }

    // Cas 2: Effet de defausse
    if (result.requiresChoice && result.discardChoice) {
      dispatch({ type: 'ADJACENT_CARD_CHOICE_MADE' });
      dispatch({ type: 'SET_GAME_STATE', gameState: result.newState });
      dispatch({
        type: 'DISCARD_CHOICE_REQUIRED',
        discardChoice: result.discardChoice,
      });
      return;
    }

    // Cas 3: Effet de remplacement de lieu
    if (result.requiresChoice && result.replaceLocationChoice) {
      dispatch({ type: 'ADJACENT_CARD_CHOICE_MADE' });
      dispatch({ type: 'SET_GAME_STATE', gameState: result.newState });
      dispatch({
        type: 'REPLACE_LOCATION_CHOICE_REQUIRED',
        replaceLocationChoice: result.replaceLocationChoice,
      });
      return;
    }

    // Cas 4: Effet d'activation adjacente (recursif - rare mais possible)
    if (result.requiresChoice && result.adjacentCardChoice) {
      dispatch({ type: 'ADJACENT_CARD_CHOICE_MADE' });
      dispatch({ type: 'SET_GAME_STATE', gameState: result.newState });
      dispatch({
        type: 'ADJACENT_CARD_CHOICE_REQUIRED',
        adjacentCardChoice: result.adjacentCardChoice,
      });
      return;
    }

    // Pas de choix supplementaire - finaliser
    const afterEffect = result.newState.players[result.newState.currentPlayerIndex];
    addLogEntry(playerBefore, turnNumber, 'effect', {
      description: result.description,
      resourcesBefore,
      resourcesAfter: { gold: afterEffect.gold, keys: afterEffect.keys },
    });

    // Appliquer le shift helper pour optimiser les points de position
    let newState = result.newState;
    const currentPlayer = newState.players[newState.currentPlayerIndex];
    const shiftResult = applyOptimalShift(currentPlayer.board, currentPlayer.lockedCards);
    if (shiftResult.shifted) {
      const players = [...newState.players];
      players[newState.currentPlayerIndex] = {
        ...currentPlayer,
        board: shiftResult.board,
        lockedCards: shiftResult.lockedCards,
      };
      newState = { ...newState, players };
    }

    // Conserver la phase: si on etait en pre_action, rester en pre_action pour pouvoir acheter
    const originalPhase = state.gameState.turnPhase;
    const nextPhase = originalPhase === 'pre_action' ? 'pre_action' : 'post_action';
    const finalState = { ...newState, turnPhase: nextPhase as 'pre_action' | 'post_action' };

    dispatch({ type: 'ADJACENT_CARD_CHOICE_MADE' });
    dispatch({ type: 'SET_GAME_STATE', gameState: finalState });
  }, [state.gameState, state.pendingAdjacentCardChoice, addLogEntry]);

  // Selection des bourses a remplir
  const selectPurses = useCallback(async (positions: number[]) => {
    if (!state.gameState || !state.pendingPurseSelectionChoice) return;

    const playerBefore = state.gameState.players[state.gameState.currentPlayerIndex];
    const turnNumber = state.gameState.turnNumber;

    // Executer le remplissage des bourses selectionnees
    const result = executeFillPursesAtPositions(
      state.gameState,
      state.gameState.currentPlayerIndex,
      positions
    );

    if (!result.success) {
      dispatch({ type: 'SET_ERROR', error: result.description });
      return;
    }

    // Logger l'effet
    addLogEntry(playerBefore, turnNumber, 'effect', {
      description: result.description,
    });

    // Appliquer le shift helper pour optimiser les points de position
    let newState = result.newState;
    const currentPlayer = newState.players[newState.currentPlayerIndex];
    const shiftResult = applyOptimalShift(currentPlayer.board, currentPlayer.lockedCards);
    if (shiftResult.shifted) {
      const players = [...newState.players];
      players[newState.currentPlayerIndex] = {
        ...currentPlayer,
        board: shiftResult.board,
        lockedCards: shiftResult.lockedCards,
      };
      newState = { ...newState, players };
    }

    // Remplir les lieux et conserver la phase: si on etait en pre_action, rester en pre_action
    const refilledBoard = refillLocations(newState.board);
    const originalPhase = state.gameState.turnPhase;
    const nextPhase = originalPhase === 'pre_action' ? 'pre_action' : 'post_action';
    const finalState = { ...newState, board: refilledBoard, turnPhase: nextPhase as 'pre_action' | 'post_action' };

    dispatch({ type: 'PURSE_SELECTION_CHOICE_MADE' });
    dispatch({ type: 'SET_GAME_STATE', gameState: finalState });
  }, [state.gameState, state.pendingPurseSelectionChoice, addLogEntry]);

  // Boucle IA - utilise SafeAIRunner pour garantir des actions valides
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
      ai.resetIterations();
      let currentState = gameState;

      // L'IA joue son tour complet
      while (currentState.players[currentState.currentPlayerIndex].id === currentPlayer.id) {
        // Securite anti-boucle infinie
        if (!ai.checkIterations()) {
          console.error(`[${ai.name}] Boucle infinie detectee, fin du tour`);
          break;
        }

        // Petit delai pour que l'utilisateur voie les actions
        await new Promise(resolve => setTimeout(resolve, 300));

        // Capturer les ressources avant l'action
        const playerBefore = currentState.players[currentState.currentPlayerIndex];
        const resourcesBefore = { gold: playerBefore.gold, keys: playerBefore.keys };
        const turnNumber = currentState.turnNumber;

        let action: GameAction;

        // Determiner l'action selon la phase
        switch (currentState.turnPhase) {
          case 'pre_action': {
            // Verifier si l'IA veut utiliser une cle
            const keyAction = ai.getKeyAction(currentState);
            if (keyAction) {
              action = {
                type: 'spend_key',
                playerId: playerBefore.id,
                targetLocation: keyAction.targetLocation,
              };
              break;
            }

            // Verifier si l'IA veut utiliser un cadenas
            const lockAction = ai.getLockAction(currentState);
            if (lockAction !== null) {
              action = {
                type: 'use_key_on_lock',
                playerId: playerBefore.id,
                lockPosition: lockAction,
              };
              break;
            }

            // Sinon, acheter une carte
            const buyResult = ai.getBuyAction(currentState);
            action = buyResult.action;
            break;
          }

          case 'buy': {
            const buyResult = ai.getBuyAction(currentState);
            action = buyResult.action;
            break;
          }

          case 'place': {
            const placeResult = ai.getPlaceAction(currentState);
            action = placeResult.action;
            break;
          }

          case 'post_action': {
            // Verifier si l'IA veut utiliser un cadenas
            const lockAction = ai.getLockAction(currentState);
            if (lockAction !== null) {
              action = {
                type: 'use_key_on_lock',
                playerId: playerBefore.id,
                lockPosition: lockAction,
              };
              break;
            }

            // Sinon, terminer le tour
            action = { type: 'end_turn', playerId: playerBefore.id };
            break;
          }

          case 'end':
          default:
            action = { type: 'end_turn', playerId: playerBefore.id };
            break;
        }

        // Valider l'action (devrait toujours etre valide grace au SafeAIRunner)
        const validation = validateAction(currentState, action);
        if (!validation.isValid) {
          console.error(`[${ai.name}] Action invalide malgre le wrapper:`, validation.reason);
          // Forcer la fin du tour
          action = { type: 'end_turn', playerId: playerBefore.id };
        }

        const purchasedCard = currentState.purchasedCard;
        currentState = executeAction(currentState, action);

        // Logger l'action de l'IA
        if (action.type !== 'end_turn') {
          const playerAfter = currentState.players[currentState.currentPlayerIndex];
          const resourcesAfter = { gold: playerAfter.gold, keys: playerAfter.keys };
          const logActionType = getLogActionType(action.type);

          const position = action.type === 'use_key_on_lock'
            ? action.lockPosition
            : action.position;

          if (logActionType === 'buy') {
            addLogEntry(playerBefore, turnNumber, logActionType, {
              cardId: action.cardId,
              isFlipped: action.type === 'buy_card_flipped',
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

        // Appliquer les effets apres placement
        if (action.type === 'place_card' && purchasedCard) {
          const card = getCard(purchasedCard);
          if (card && card.effects.length > 0) {
            const hasChoice = card.effects.some(e => e.type === 'choice');

            // L'IA choisit via son interface
            const choiceIndex = hasChoice
              ? ai.getEffectOption(currentState, [
                  { index: 0, description: 'Option 1' },
                  { index: 1, description: 'Option 2' },
                ])
              : 0;

            const beforeEffect = currentState.players[currentState.currentPlayerIndex];
            const effectResult = executeCardEffect(currentState, purchasedCard, action.position!, choiceIndex);

            // Si l'effet necessite une defausse
            if (effectResult.requiresChoice && effectResult.discardChoice) {
              const location = effectResult.discardChoice.location;
              const availableCards = location === 'castle'
                ? currentState.board.castleCards
                : currentState.board.villageCards;

              if (availableCards.length > 0) {
                const bestCard = ai.getDiscardChoice(currentState, effectResult.discardChoice);

                const discardResult = executeDiscardEffect(
                  currentState,
                  effectResult.discardChoice,
                  bestCard
                );
                currentState = discardResult.newState;

                const afterDiscard = currentState.players[currentState.currentPlayerIndex];
                addLogEntry(playerBefore, turnNumber, 'effect', {
                  description: discardResult.description,
                  resourcesBefore: { gold: beforeEffect.gold, keys: beforeEffect.keys },
                  resourcesAfter: { gold: afterDiscard.gold, keys: afterDiscard.keys },
                });
              }
            } else if (effectResult.requiresChoice && effectResult.purseSelectionChoice) {
              const selectedPositions = ai.getPurseChoice(currentState, effectResult.purseSelectionChoice);

              const purseResult = executeFillPursesAtPositions(
                currentState,
                currentState.currentPlayerIndex,
                selectedPositions
              );
              currentState = purseResult.newState;

              addLogEntry(playerBefore, turnNumber, 'effect', {
                description: purseResult.description,
              });
            } else {
              currentState = effectResult.newState;

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

          // Remplir les lieux apres le placement et les effets
          const refilledBoard = refillLocations(currentState.board);
          currentState = { ...currentState, board: refilledBoard, turnPhase: 'post_action' };
        }

        // Appliquer l'effet du cadenas
        if (action.type === 'use_key_on_lock' && action.lockPosition !== undefined) {
          const aiPlayer = currentState.players[currentState.currentPlayerIndex];
          const placedCard = aiPlayer.board[action.lockPosition];

          if (placedCard) {
            const beforeLock = currentState.players[currentState.currentPlayerIndex];
            const lockResult = executeLockEffect(currentState, placedCard.cardId, action.lockPosition);

            if (lockResult.success) {
              if (lockResult.requiresChoice && lockResult.replaceLocationChoice) {
                const bestLocation = ai.getLocationChoice(currentState, lockResult.replaceLocationChoice);

                const replaceResult = executeReplaceLocationEffect(
                  currentState,
                  lockResult.replaceLocationChoice,
                  bestLocation
                );

                if (replaceResult.success) {
                  currentState = replaceResult.newState;

                  const afterReplace = currentState.players[currentState.currentPlayerIndex];
                  addLogEntry(playerBefore, turnNumber, 'effect', {
                    description: replaceResult.description,
                    resourcesBefore: { gold: beforeLock.gold, keys: beforeLock.keys },
                    resourcesAfter: { gold: afterReplace.gold, keys: afterReplace.keys },
                  });
                }
              } else if (lockResult.requiresChoice && lockResult.adjacentCardChoice) {
                const bestAdjPosition = ai.getAdjacentCardChoice(currentState, lockResult.adjacentCardChoice);

                const adjResult = executeAdjacentCardEffect(
                  currentState,
                  lockResult.adjacentCardChoice,
                  bestAdjPosition
                );

                if (adjResult.success && !adjResult.requiresChoice) {
                  currentState = adjResult.newState;

                  const afterAdj = currentState.players[currentState.currentPlayerIndex];
                  addLogEntry(playerBefore, turnNumber, 'effect', {
                    description: adjResult.description,
                    resourcesBefore: { gold: beforeLock.gold, keys: beforeLock.keys },
                    resourcesAfter: { gold: afterAdj.gold, keys: afterAdj.keys },
                  });
                }
              } else {
                currentState = lockResult.newState;

                const afterLock = currentState.players[currentState.currentPlayerIndex];
                if (beforeLock.gold !== afterLock.gold || beforeLock.keys !== afterLock.keys) {
                  addLogEntry(playerBefore, turnNumber, 'effect', {
                    description: lockResult.description,
                    resourcesBefore: { gold: beforeLock.gold, keys: beforeLock.keys },
                    resourcesAfter: { gold: afterLock.gold, keys: afterLock.keys },
                  });
                }
              }
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

  // =============================================================================
  // Debug functions (dev mode only)
  // =============================================================================

  const debugRefreshCards = useCallback(() => {
    if (!state.gameState) return;

    const board = { ...state.gameState.board };

    // Defausser les cartes actuelles
    board.castleDiscard = [...board.castleDiscard, ...board.castleCards];
    board.villageDiscard = [...board.villageDiscard, ...board.villageCards];
    board.castleCards = [];
    board.villageCards = [];

    // Piocher 3 nouvelles cartes pour chaque lieu
    const drawCards = (deck: string[], discard: string[], count: number): { cards: string[]; newDeck: string[]; newDiscard: string[] } => {
      let currentDeck = [...deck];
      let currentDiscard = [...discard];
      const cards: string[] = [];

      for (let i = 0; i < count; i++) {
        if (currentDeck.length === 0 && currentDiscard.length > 0) {
          // Remelanger la defausse
          currentDeck = [...currentDiscard].sort(() => Math.random() - 0.5);
          currentDiscard = [];
        }
        if (currentDeck.length > 0) {
          cards.push(currentDeck.shift()!);
        }
      }

      return { cards, newDeck: currentDeck, newDiscard: currentDiscard };
    };

    const castleResult = drawCards(board.castleDeck, board.castleDiscard, 3);
    board.castleCards = castleResult.cards;
    board.castleDeck = castleResult.newDeck;
    board.castleDiscard = castleResult.newDiscard;

    const villageResult = drawCards(board.villageDeck, board.villageDiscard, 3);
    board.villageCards = villageResult.cards;
    board.villageDeck = villageResult.newDeck;
    board.villageDiscard = villageResult.newDiscard;

    dispatch({ type: 'SET_GAME_STATE', gameState: { ...state.gameState, board } });
  }, [state.gameState]);

  const debugMoveMessenger = useCallback(() => {
    if (!state.gameState) return;

    const newLocation = state.gameState.board.messengerLocation === 'castle' ? 'village' : 'castle';
    const board = { ...state.gameState.board, messengerLocation: newLocation as 'castle' | 'village' };

    dispatch({ type: 'SET_GAME_STATE', gameState: { ...state.gameState, board } });
  }, [state.gameState]);

  const debugAddResources = useCallback(() => {
    if (!state.gameState) return;

    const playerIndex = state.gameState.currentPlayerIndex;
    const players = [...state.gameState.players];
    const player = { ...players[playerIndex] };
    player.gold += 10;
    player.keys += 10;
    players[playerIndex] = player;

    dispatch({ type: 'SET_GAME_STATE', gameState: { ...state.gameState, players } });
  }, [state.gameState]);

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
        endTurn,
        // Helpers
        getCurrentPlayer: getCurrentPlayerFn,
        getAvailableCards: getAvailableCardsFn,
        canAffordCard: canAffordCardFn,
        isCurrentPlayerAI,
        isMyTurn,
        // Choix de carte a defausser
        pendingDiscardChoice: state.pendingDiscardChoice,
        selectDiscardCard,
        // Choix de lieu a remplacer
        pendingReplaceLocationChoice: state.pendingReplaceLocationChoice,
        selectReplaceLocation,
        // Choix de carte adjacente
        pendingAdjacentCardChoice: state.pendingAdjacentCardChoice,
        selectAdjacentCard,
        // Choix de bourses a remplir
        pendingPurseSelectionChoice: state.pendingPurseSelectionChoice,
        selectPurses,
        // Logs
        toggleGameLog,
        gameLog: state.gameLog,
        showGameLog: state.showGameLog,
        // Debug
        debugRefreshCards,
        debugMoveMessenger,
        debugAddResources,
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
