/**
 * Hard AI - IA Difficile
 *
 * Utilise Monte Carlo Tree Search (MCTS) pour les decisions principales :
 * - Quelle carte acheter
 * - Ou la placer
 *
 * Delegue les decisions secondaires a l'IA Normale :
 * - Utilisation des cles
 * - Utilisation des cadenas
 * - Choix d'effets
 *
 * Caracteristiques :
 * - Explore des milliers de scenarios possibles
 * - Prend en compte les plateaux adverses (blocage)
 * - Temps de reflexion adaptatif (3-7s selon l'avancement)
 */

import type {
  AIPlayer,
  AILevel,
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  PlayGameState,
  DiscardChoice,
  ReplaceLocationChoice,
  AdjacentCardChoice,
  PurseSelectionChoice,
  Location,
} from '../../../../types/play';
import { getCurrentPlayer } from '../../gameEngine';
import { NormalAI } from '../normalAI';
import { runMCTS, getTimeLimit } from './mcts';
import { getCardCount } from './simulation';

export class HardAI implements AIPlayer {
  level: AILevel = 'hard';
  name = 'Celeste';

  // IA Normale pour les decisions secondaires
  private normalAI = new NormalAI();

  // Cache de la derniere decision MCTS
  private lastMCTSDecision: {
    cardId: string;
    position: number;
    flipped: boolean;
    shiftDirection?: string;
  } | null = null;

  // ===========================================================================
  // Actions obligatoires (MCTS)
  // ===========================================================================

  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const player = getCurrentPlayer(state);
    const cardCount = getCardCount(player);
    const playerCount = state.players.length;
    const timeLimit = getTimeLimit(cardCount, playerCount);

    console.log(`[HardAI] Starting MCTS with ${timeLimit}ms time limit (${playerCount} players)`);

    // Lancer MCTS
    const action = runMCTS(state, player.id, timeLimit);

    if (action) {
      // Sauvegarder la decision pour le placement
      this.lastMCTSDecision = {
        cardId: action.cardId,
        position: action.position,
        flipped: action.type === 'buy_flipped',
        shiftDirection: action.shiftDirection,
      };

      return {
        cardId: action.cardId,
        flipped: action.type === 'buy_flipped',
      };
    }

    // Fallback sur NormalAI si MCTS echoue
    console.warn('[HardAI] MCTS failed, falling back to NormalAI');
    this.lastMCTSDecision = null;
    return this.normalAI.selectBuyAction(state, availableCards);
  }

  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    // Utiliser la position decidee par MCTS si disponible
    if (
      this.lastMCTSDecision &&
      this.lastMCTSDecision.cardId === cardId &&
      validPositions.includes(this.lastMCTSDecision.position)
    ) {
      const position = this.lastMCTSDecision.position;
      this.lastMCTSDecision = null; // Consommer la decision
      return position;
    }

    // Fallback sur NormalAI
    console.warn('[HardAI] No MCTS position, falling back to NormalAI');
    return this.normalAI.selectPlaceAction(state, cardId, validPositions);
  }

  // ===========================================================================
  // Actions facultatives (deleguees a NormalAI)
  // ===========================================================================

  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    return this.normalAI.selectKeyAction(state);
  }

  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    return this.normalAI.selectLockAction(state, availableLocks);
  }

  // ===========================================================================
  // Choix d'effets (delegues a NormalAI)
  // ===========================================================================

  selectEffectOption(state: PlayGameState, options: AIEffectOption[]): number {
    return this.normalAI.selectEffectOption(state, options);
  }

  selectLocation(state: PlayGameState, choice: ReplaceLocationChoice): Location {
    return this.normalAI.selectLocation(state, choice);
  }

  selectDiscardCard(state: PlayGameState, choice: DiscardChoice, availableCards: string[]): string {
    return this.normalAI.selectDiscardCard(state, choice, availableCards);
  }

  selectAdjacentCard(state: PlayGameState, choice: AdjacentCardChoice): number {
    return this.normalAI.selectAdjacentCard(state, choice);
  }

  selectPurses(state: PlayGameState, choice: PurseSelectionChoice): number[] {
    return this.normalAI.selectPurses(state, choice);
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
