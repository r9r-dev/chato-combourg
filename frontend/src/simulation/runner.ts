/**
 * Simulateur de parties
 *
 * Execute une partie complete et retourne les resultats.
 */

import type { PlayGameState, PlayCard, GameAction, AILevel } from '../types/play';
import type { SimConfig, SimGameResult, SimPlayerResult, TrainingData, TrainingState } from './types';
import {
  loadCards,
  createGame,
  executeAction,
  randomBuyDecision,
  randomPlaceDecision,
  estimateScore,
  getAvailableCards,
  serializeState,
} from './engine';
import { getValidPlacements } from '../types/play';
import { setCardCache } from '../services/play/gameEngine';
import { resetGameLogs, getGameLogs, type DecisionLogEntry } from '../services/play/ai/debug/decisionLogger';

// Types pour les IA
type AIInstance = {
  selectBuyAction: (state: PlayGameState, availableCards: string[]) => { cardId: string; flipped: boolean };
  selectPlaceAction: (state: PlayGameState, cardId: string, validPositions: number[]) => number;
};

// Cache des instances IA (cle = level + verbose)
const aiInstances: Map<string, AIInstance> = new Map();

async function getAI(level: AILevel, cards: Map<string, PlayCard>, verbose: boolean = false): Promise<AIInstance> {
  // Cle unique incluant le mode verbose pour Hard AI
  const key = level === 'hard' ? `${level}-${verbose}` : level;

  if (aiInstances.has(key)) {
    const ai = aiInstances.get(key)!;
    // Mettre a jour le mode verbose si c'est Hard AI
    if (level === 'hard' && 'setVerbose' in ai) {
      (ai as any).setVerbose(verbose);
    }
    return ai;
  }

  let ai: AIInstance;

  if (level === 'easy') {
    const { EasyAI } = await import('../services/play/ai/levels/easyAI');
    ai = new EasyAI();
  } else if (level === 'normal') {
    const { NormalAI } = await import('../services/play/ai/levels/normalAI');
    ai = new NormalAI();
  } else {
    const { HardAI } = await import('../services/play/ai/levels/hardAI');
    // Augmenter les paramètres pour de meilleures décisions (lent mais précis)
    // DEBUG: activer le mode debug pour voir les décisions
    // VERBOSE: afficher les possibilites evaluees
    ai = new HardAI(
      { maxIterations: 500, maxTimeMs: 3000 },
      process.env.AI_DEBUG === '1',
      verbose
    );
  }

  // Injecter les cartes
  (ai as any).cards = cards;
  (ai as any).cardsLoaded = true;

  aiInstances.set(key, ai);
  return ai;
}

/**
 * Execute une partie complete
 */
export async function runGame(
  config: SimConfig,
  backendUrl: string = 'http://localhost:8080'
): Promise<{ result: SimGameResult; trainingData?: TrainingData; decisionLogs?: DecisionLogEntry[] }> {
  const startTime = Date.now();
  const verbose = config.verbose ?? false;

  // Reset les logs de decisions si verbose
  if (verbose) {
    resetGameLogs();
  }

  // Charger les cartes
  const cards = await loadCards(backendUrl);

  // Initialiser le cache du gameEngine (necessaire pour Hard AI)
  setCardCache(Object.fromEntries(cards));

  // Creer la partie
  let state = createGame(config, cards);
  const trainingStates: TrainingState[] = [];

  const maxTurns = 100; // Securite
  let turnCount = 0;

  while (state.phase !== 'ended' && turnCount < maxTurns) {
    const player = state.players[state.currentPlayerIndex];
    const playerConfig = config.players[state.currentPlayerIndex];

    // Phase d'achat
    if (state.turnPhase === 'pre_action' || state.turnPhase === 'buy') {
      let buyAction: GameAction;

      if (playerConfig.type === 'ai' && playerConfig.aiLevel) {
        const ai = await getAI(playerConfig.aiLevel, cards, verbose);
        const available = getAvailableCards(state);
        const decision = ai.selectBuyAction(state, available);
        buyAction = {
          type: decision.flipped ? 'buy_card_flipped' : 'buy_card',
          playerId: player.id,
          cardId: decision.cardId,
        };
      } else {
        buyAction = randomBuyDecision(state, cards);
      }

      // Collecter pour l'entrainement
      if (config.collectTrainingData) {
        trainingStates.push({
          turn: state.turnNumber,
          playerIndex: state.currentPlayerIndex,
          phase: 'buy',
          state: serializeState(state),
          action: buyAction,
          currentScore: estimateScore(player, cards),
        });
      }

      state = executeAction(state, buyAction, cards);
    }

    // Phase de placement
    if (state.turnPhase === 'place') {
      let placeAction: GameAction;

      if (playerConfig.type === 'ai' && playerConfig.aiLevel) {
        const ai = await getAI(playerConfig.aiLevel, cards, verbose);
        const validPositions = getValidPlacements(player.board);
        const position = ai.selectPlaceAction(state, state.purchasedCard!, validPositions);
        placeAction = {
          type: 'place_card',
          playerId: player.id,
          cardId: state.purchasedCard!,
          position,
        };
      } else {
        placeAction = randomPlaceDecision(state);
      }

      // Collecter pour l'entrainement
      if (config.collectTrainingData) {
        trainingStates.push({
          turn: state.turnNumber,
          playerIndex: state.currentPlayerIndex,
          phase: 'place',
          state: serializeState(state),
          action: placeAction,
          currentScore: estimateScore(player, cards),
        });
      }

      state = executeAction(state, placeAction, cards);
    }

    // Fin de tour
    if (state.turnPhase === 'post_action') {
      state = executeAction(state, { type: 'end_turn', playerId: player.id }, cards);
    }

    turnCount++;
  }

  // Calculer les resultats
  const playerResults: SimPlayerResult[] = state.players.map((player, index) => {
    const score = estimateScore(player, cards);
    const flippedCount = player.board.filter(p => p?.cardId === '089' || p?.cardId === '090').length;

    return {
      name: player.name,
      type: config.players[index].type,
      aiLevel: config.players[index].aiLevel,
      score,
      gold: player.gold,
      keys: player.keys,
      cards: player.board.map(p => p?.cardId ?? null),
      coinsOnCards: player.board.map(p => p?.coinsOnCard ?? 0),
      flippedCount,
      rank: 0, // Calcule apres
    };
  });

  // Calculer les rangs
  const sortedByScore = [...playerResults].sort((a, b) => b.score - a.score);
  sortedByScore.forEach((p, index) => {
    p.rank = index + 1;
  });

  const winnerIndex = playerResults.findIndex(p => p.rank === 1);

  const result: SimGameResult = {
    gameId: state.gameId,
    seed: config.seed,
    turns: turnCount,
    players: playerResults,
    winnerIndex,
    durationMs: Date.now() - startTime,
  };

  // Collecter les logs de decisions si verbose
  const decisionLogs = verbose ? getGameLogs() : undefined;

  return {
    result,
    trainingData: config.collectTrainingData
      ? { gameId: state.gameId, states: trainingStates, result }
      : undefined,
    decisionLogs,
  };
}

/**
 * Execute plusieurs parties
 */
export async function runMultipleGames(
  config: SimConfig,
  count: number,
  backendUrl: string = 'http://localhost:8080',
  onProgress?: (current: number, total: number) => void
): Promise<SimGameResult[]> {
  const results: SimGameResult[] = [];

  for (let i = 0; i < count; i++) {
    const gameConfig = { ...config, seed: config.seed ? config.seed + i : undefined };
    const { result } = await runGame(gameConfig, backendUrl);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, count);
    }
  }

  return results;
}

/**
 * Calcule les statistiques sur plusieurs parties
 */
export function computeStats(results: SimGameResult[]): {
  totalGames: number;
  winsByPlayer: Record<string, number>;
  avgScoreByPlayer: Record<string, number>;
  avgDurationMs: number;
  avgTurns: number;
} {
  const winsByPlayer: Record<string, number> = {};
  const totalScoreByPlayer: Record<string, number> = {};
  const countByPlayer: Record<string, number> = {};

  let totalDuration = 0;
  let totalTurns = 0;

  for (const result of results) {
    totalDuration += result.durationMs;
    totalTurns += result.turns;

    for (const player of result.players) {
      const key = player.aiLevel ? `IA ${player.aiLevel}` : player.name;

      winsByPlayer[key] = (winsByPlayer[key] ?? 0) + (player.rank === 1 ? 1 : 0);
      totalScoreByPlayer[key] = (totalScoreByPlayer[key] ?? 0) + player.score;
      countByPlayer[key] = (countByPlayer[key] ?? 0) + 1;
    }
  }

  const avgScoreByPlayer: Record<string, number> = {};
  for (const key of Object.keys(totalScoreByPlayer)) {
    avgScoreByPlayer[key] = Math.round(totalScoreByPlayer[key] / countByPlayer[key]);
  }

  return {
    totalGames: results.length,
    winsByPlayer,
    avgScoreByPlayer,
    avgDurationMs: Math.round(totalDuration / results.length),
    avgTurns: Math.round(totalTurns / results.length),
  };
}
