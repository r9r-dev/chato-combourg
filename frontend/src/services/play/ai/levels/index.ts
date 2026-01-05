/**
 * AI Levels module - Factory et implementations des IA
 */

import type { AIPlayer, AILevel } from '../../../../types/play';
import { EasyAI } from './easyAI';
import { NormalAI } from './normalAI';
import { HardAI } from './hardAI';

export { BaseAI } from './baseAI';
export { EasyAI } from './easyAI';
export { NormalAI } from './normalAI';
export { HardAI } from './hardAI';

/**
 * Factory pour creer une IA selon le niveau
 */
export function createAI(level: AILevel): AIPlayer {
  switch (level) {
    case 'easy':
      return new EasyAI();

    case 'normal':
      return new NormalAI();

    case 'hard':
      return new HardAI();

    case 'neural':
      // Pour l'instant, neural utilise Hard comme fallback
      console.warn('[AI] Neural AI not implemented, using Hard AI');
      return new HardAI();

    default:
      console.warn(`[AI] Unknown level ${level}, using Normal AI`);
      return new NormalAI();
  }
}

/**
 * Verifie si une IA est disponible
 */
export async function isAIAvailable(level: AILevel): Promise<boolean> {
  const ai = createAI(level);
  return ai.isAvailable();
}
