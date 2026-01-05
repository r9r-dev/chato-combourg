/**
 * AI Module pour le mode Play
 *
 * Ce module fournit l'intelligence artificielle pour jouer contre l'ordinateur.
 *
 * Architecture :
 * - context/   : Construction du contexte IA depuis l'etat du jeu
 * - simulator/ : Clone et simulation d'actions
 * - evaluator/ : Calcul des scores
 * - tree/      : Generation de l'arbre de decisions
 * - algorithms/: Algorithmes de selection (Greedy, Minimax, MCTS)
 * - levels/    : Implementations des IA (Easy, Normal, Hard)
 *
 * Usage :
 * ```typescript
 * import { createAI } from './ai';
 *
 * const ai = createAI('hard');
 * const buyDecision = ai.selectBuyAction(state, availableCards);
 * ```
 */

// =============================================================================
// Exports principaux
// =============================================================================

// Factory pour creer une IA
export { createAI, isAIAvailable } from './levels';

// Types
export type {
  AIContext,
  ActionNode,
  ActionTree,
  ActionConsequences,
  PlacementScenario,
  Personality,
  PersonalityName,
  EasyAIConfig,
  HardAIConfig,
  SimulatorConfig,
  ActionEvaluation,
  PlacementEvaluation,
  EvaluatedEffectOption,
  EvaluatedDiscardCard,
} from './types';

// =============================================================================
// Exports secondaires (pour usage avance)
// =============================================================================

// Context
export { buildContext, loadCards, getCardsCache } from './context';
export {
  getPlacedCount,
  getTotalCoins,
  getClosedLocks,
  getOpenPurses,
  getAdjacentCards,
  countAdjacentShields,
  countTotalShields,
  isInCompleteLine,
  isInCompleteColumn,
  getCardEffectiveCost,
  hasEffect,
  getUniqueShieldColors,
  countCategoryCards,
  estimateScore,
  canUseKey,
  canOpenLock,
} from './context';

// Simulator
export { cloneState, statesAreEqual } from './simulator';
export { executeSimulatedAction, isActionValid } from './simulator';
export { simulateTurn, simulateRounds, simulateToEnd, prepareSimulation } from './simulator';

// Evaluator
export { evaluateState, evaluateAction, evaluateAll, calculateExactScore, clearScoreCache } from './evaluator';
export { ScoreCache } from './evaluator';

// Tree
export { buildActionTree, generateActions } from './tree';
export { pruneTree, pruneByScore, pruneByCost } from './tree';
export { traverseTree, getLeaves, getFirstAction, getBestLeaf, getTopLeaves, getLevel1Actions } from './tree';

// Algorithms
export { greedySelect, greedySelectTopN } from './algorithms';
export { minimaxSelect } from './algorithms';
export { mctsSelect, mctsSelectWithStats, type MCTSOptions } from './algorithms';

// Levels (classes)
export { BaseAI, EasyAI, NormalAI, HardAI } from './levels';
