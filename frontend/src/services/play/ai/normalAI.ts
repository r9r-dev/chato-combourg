/**
 * Normal AI - IA Normale
 *
 * Comportement :
 * - Evalue son plateau et maintient une strategie coherente
 * - Connait les synergies entre cartes et evite les contradictions
 * - Utilise les cles de maniere reflechie (messager, refresh)
 * - Place intelligemment selon les strategies actives
 * - Gere ses ressources (or, cles) de maniere equilibree
 *
 * L'IA Normale connait les regles du jeu mais ne fait pas de calculs
 * complexes a plusieurs tours. Elle joue de maniere coherente et
 * evite les erreurs grossieres.
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
} from '../../../types/play';
import {
  getCard,
  getCurrentPlayer,
} from '../gameEngine';
import type { StrategyAnalysis } from './normalAI/strategies';
import { analyzePlayerStrategies } from './normalAI/strategies';
import type { CardEvaluation } from './normalAI/evaluation';
import {
  evaluateCard,
  evaluatePositions,
  decideKeyAction,
  chooseBestLock,
  shouldConsiderFlippedPurchase,
  evaluateGoldSituation,
} from './normalAI/evaluation';

export class NormalAI implements AIPlayer {
  level: AILevel = 'normal';
  name = 'IA Normale';

  // Cache de l'analyse strategique (mis a jour a chaque tour)
  private cachedAnalysis: StrategyAnalysis | null = null;
  private cachedPlayerId: string | null = null;

  // ===========================================================================
  // Actions obligatoires
  // ===========================================================================

  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const player = getCurrentPlayer(state);
    this.updateAnalysisCache(player);
    const analysis = this.cachedAnalysis!;

    // Evaluer toutes les cartes
    const evaluations: CardEvaluation[] = availableCards.map(cardId =>
      evaluateCard(cardId, player, analysis)
    );

    // Trier par score
    evaluations.sort((a, b) => b.score - a.score);

    // Filtrer les cartes abordables
    const affordableCards = evaluations.filter(e => e.canAfford && e.score > -100);

    // Si aucune carte abordable interessante
    if (affordableCards.length === 0) {
      // Considerer l'achat face cachee ?
      if (shouldConsiderFlippedPurchase(player, analysis, evaluations)) {
        // Prendre la carte la moins chere face cachee
        const sortedByCost = [...availableCards].sort((a, b) => {
          const cardA = getCard(a);
          const cardB = getCard(b);
          return (cardA?.value ?? 0) - (cardB?.value ?? 0);
        });
        return { cardId: sortedByCost[0], flipped: true };
      }

      // Sinon, prendre la meilleure carte meme si score negatif
      // (sauf si score = -1000 qui indique un conflit fatal)
      const bestNonFatal = evaluations.find(e => e.canAfford && e.score > -1000);
      if (bestNonFatal) {
        return { cardId: bestNonFatal.cardId, flipped: false };
      }

      // En dernier recours, carte face cachee
      const cheapest = [...availableCards].sort((a, b) => {
        const cardA = getCard(a);
        const cardB = getCard(b);
        return (cardA?.value ?? 0) - (cardB?.value ?? 0);
      })[0];
      return { cardId: cheapest, flipped: true };
    }

    // Prendre la meilleure carte abordable
    return { cardId: affordableCards[0].cardId, flipped: false };
  }

  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    const player = getCurrentPlayer(state);
    this.updateAnalysisCache(player);
    const analysis = this.cachedAnalysis!;

    if (validPositions.length === 0) {
      return 4; // Centre par defaut
    }

    if (validPositions.length === 1) {
      return validPositions[0];
    }

    // Evaluer toutes les positions
    const positionEvals = evaluatePositions(cardId, validPositions, player, analysis);

    // Prendre la meilleure position
    return positionEvals[0].position;
  }

  // ===========================================================================
  // Actions facultatives
  // ===========================================================================

  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    const player = getCurrentPlayer(state);

    if (player.keys === 0) return null;

    // Utiliser la logique d'evaluation
    return decideKeyAction(state);
  }

  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    if (availableLocks.length === 0) return null;

    return chooseBestLock(state, availableLocks);
  }

  // ===========================================================================
  // Choix d'effets
  // ===========================================================================

  selectEffectOption(state: PlayGameState, options: AIEffectOption[]): number {
    if (options.length === 0) return 0;

    const player = getCurrentPlayer(state);
    this.updateAnalysisCache(player);
    const analysis = this.cachedAnalysis!;

    // Analyser les options
    // L'option 0 donne souvent de l'or, l'option 1 des cles

    // Si strategie cles (017/066), preferer les cles
    const hasKeyScoring = analysis.strategies.some(
      s => s.definition.type === 'keys_count' && !s.isInvalidated
    );
    if (hasKeyScoring && options.length > 1) {
      // Verifier si l'option 1 donne des cles (heuristique basee sur la description)
      const option1 = options[1]?.description?.toLowerCase() ?? '';
      if (option1.includes('cle') || option1.includes('key')) {
        return 1;
      }
    }

    // Si manque d'or, preferer l'or
    const goldSituation = evaluateGoldSituation(player);
    if (goldSituation === 'tight' || goldSituation === 'broke') {
      return 0; // Option 0 = or generalement
    }

    // Par defaut, option 0
    return 0;
  }

  selectLocation(state: PlayGameState, choice: ReplaceLocationChoice): Location {
    const player = getCurrentPlayer(state);
    this.updateAnalysisCache(player);
    const analysis = this.cachedAnalysis!;

    // Si l'effet donne des cles selon une feature ou un bouclier
    if (
      choice.effectType === 'replace_location_gain_keys_per_feature' ||
      choice.effectType === 'replace_location_gain_keys_per_shield'
    ) {
      const keysPerCard = choice.keysPerCard ?? 0;

      const countKeysForLocation = (location: Location): number => {
        const cards = location === 'castle'
          ? state.board.castleCards
          : state.board.villageCards;

        let keys = 0;
        for (const cardId of cards) {
          const card = getCard(cardId);
          if (!card) continue;

          if (choice.effectType === 'replace_location_gain_keys_per_feature') {
            if (choice.feature === 'price_reduction' && card.has_price_reduction) {
              keys += keysPerCard;
            } else if (choice.feature === 'coin_purse' && card.has_coin_purse) {
              keys += keysPerCard;
            }
          } else if (choice.effectType === 'replace_location_gain_keys_per_shield') {
            const hasShield = card.shields.some(s => s.color === choice.color);
            if (hasShield) {
              keys += keysPerCard;
            }
          }
        }

        return keys;
      };

      const keysFromCastle = countKeysForLocation('castle');
      const keysFromVillage = countKeysForLocation('village');

      return keysFromCastle >= keysFromVillage ? 'castle' : 'village';
    }

    // Sinon, choisir le lieu avec les cartes les moins interessantes (pour les remplacer)
    const castleEvals = state.board.castleCards.map(id =>
      evaluateCard(id, player, analysis)
    );
    const villageEvals = state.board.villageCards.map(id =>
      evaluateCard(id, player, analysis)
    );

    const avgCastle = castleEvals.reduce((sum, e) => sum + e.score, 0) / 3;
    const avgVillage = villageEvals.reduce((sum, e) => sum + e.score, 0) / 3;

    // Remplacer le lieu avec les cartes les moins bonnes
    return avgCastle < avgVillage ? 'castle' : 'village';
  }

  selectDiscardCard(_state: PlayGameState, _choice: DiscardChoice, availableCards: string[]): string {
    // Defausser la carte qui rapporte le plus de ressources (la plus chere)
    let bestCard = availableCards[0];
    let bestValue = 0;

    for (const cardId of availableCards) {
      const card = getCard(cardId);
      if (card && card.value > bestValue) {
        bestValue = card.value;
        bestCard = cardId;
      }
    }

    return bestCard;
  }

  selectAdjacentCard(state: PlayGameState, choice: AdjacentCardChoice): number {
    const player = getCurrentPlayer(state);
    this.updateAnalysisCache(player);
    const analysis = this.cachedAnalysis!;

    // Choisir la carte adjacente qui donne le plus de valeur
    let bestPosition = choice.adjacentPositions[0];
    let bestScore = -Infinity;

    for (const pos of choice.adjacentPositions) {
      const placed = player.board[pos];
      if (!placed) continue;

      const card = getCard(placed.cardId);
      if (!card) continue;

      // Score base sur les effets
      let score = 0;
      for (const effect of card.effects) {
        if (effect.type.includes('gold')) {
          score += (effect.amount ?? 0) * 1.5;
        } else if (effect.type.includes('key')) {
          const hasKeyScoring = analysis.strategies.some(
            s => s.definition.type === 'keys_count'
          );
          score += (effect.amount ?? 0) * (hasKeyScoring ? 3 : 1);
        } else {
          score += 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPosition = pos;
      }
    }

    return bestPosition;
  }

  selectPurses(state: PlayGameState, choice: PurseSelectionChoice): number[] {
    const player = getCurrentPlayer(state);
    this.updateAnalysisCache(player);
    const analysis = this.cachedAnalysis!;

    // Strategie bourses ?
    const hasPurseScoring = analysis.strategies.some(
      s => s.cardId === '020' && !s.isInvalidated
    );

    // Trier les bourses par priorite
    const pursesWithPriority = choice.availablePositions.map(pos => {
      const placed = player.board[pos];
      if (!placed) return { pos, priority: -Infinity };

      const card = getCard(placed.cardId);
      if (!card) return { pos, priority: -Infinity };

      const current = placed.coinsOnCard ?? 0;
      const max = card.max_coins ?? 0;
      const remaining = max - current;

      // Priorite = remplir les bourses presque pleines en premier
      // Si strategie 020, maximiser le total de pieces
      let priority = hasPurseScoring
        ? remaining // Plus de pieces = mieux
        : max - remaining; // Presque plein = mieux

      return { pos, priority };
    });

    // Trier par priorite decroissante
    pursesWithPriority.sort((a, b) => b.priority - a.priority);

    return pursesWithPriority.slice(0, choice.maxCards).map(p => p.pos);
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // ===========================================================================
  // Cache
  // ===========================================================================

  private updateAnalysisCache(player: { id: string; board: unknown[] }): void {
    // Mettre a jour le cache si le joueur a change
    if (this.cachedPlayerId !== player.id || this.cachedAnalysis === null) {
      this.cachedAnalysis = analyzePlayerStrategies(player as any);
      this.cachedPlayerId = player.id;
    }
  }
}
