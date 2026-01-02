/**
 * AI Module - Interface commune et factory pour les IA
 */

import type { AIPlayer, AILevel } from '../../../types/play';
import { EasyAI } from './easyAI';
import { NormalAI } from './normalAI';
import { HardAI } from './hardAI';

// =============================================================================
// Factory
// =============================================================================

export function createAI(level: AILevel): AIPlayer {
  switch (level) {
    case 'easy':
      return new EasyAI();
    case 'normal':
      return new NormalAI();
    case 'hard':
      return new HardAI();
    case 'neural':
      // Pour l'instant, on fallback sur MCTS
      // Plus tard, on pourra charger un modele ONNX
      return new HardAI();
    default:
      return new EasyAI();
  }
}

// =============================================================================
// Re-exports
// =============================================================================

export { EasyAI } from './easyAI';
export { NormalAI } from './normalAI';
export { HardAI } from './hardAI';
export type { AIPlayer };
