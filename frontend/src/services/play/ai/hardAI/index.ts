/**
 * Module IA Difficile (MCTS)
 *
 * Exports des sous-modules pour l'IA Difficile
 */

export { HardAI } from './hardAI';
export { runMCTS, getTimeLimit } from './mcts';
export { estimateScore, getRelativeScore, getNormalizedScore } from './scoring';
export {
  cloneState,
  generateActions,
  executeSimulatedAction,
  rollout,
  getCardCount,
  isGameOver,
} from './simulation';
export type { MCTSAction } from './simulation';
