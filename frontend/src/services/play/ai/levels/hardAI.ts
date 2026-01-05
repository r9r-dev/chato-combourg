/**
 * IA Difficile
 *
 * Utilise MCTS pour explorer l'arbre de decisions.
 * Considere les reponses des adversaires.
 */

import type {
  AILevel,
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  PlayGameState,
  Location,
  DiscardChoice,
  ReplaceLocationChoice,
  AdjacentCardChoice,
  PurseSelectionChoice,
} from '../../../../types/play';
import { BaseAI } from './baseAI';
import { buildContext } from '../context/builder';
import { buildActionTree } from '../tree/generator';
import { mctsSelect } from '../algorithms/mcts';
import type { HardAIConfig } from '../types';
import { evaluateBestMoveWithLookahead, evaluatePlaceOptions } from '../evaluator/deltaCalculator';
import { logAIDecisions, type DecisionLogContext } from '../debug/decisionLogger';

const DEFAULT_CONFIG: HardAIConfig = {
  maxIterations: 500,
  maxTimeMs: 3000,
  explorationConstant: Math.sqrt(2),
};

/**
 * IA Difficile - MCTS
 */
export class HardAI extends BaseAI {
  level: AILevel = 'hard';
  name = 'Expert';
  private config: HardAIConfig;
  private debug: boolean = false;
  private verbose: boolean = false;

  constructor(config: Partial<HardAIConfig> = {}, debug: boolean = false, verbose: boolean = false) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debug = debug;
    this.verbose = verbose;
  }

  /**
   * Active ou desactive le mode verbose
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Choisit une carte a acheter en evaluant le delta de score
   *
   * Strategie : pour chaque carte et chaque position, calculer le score net
   * et choisir la combinaison qui maximise le gain.
   */
  selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision {
    const player = this.getCurrentPlayer(state);
    const cards = this.getCards();

    // Log des decisions en mode verbose
    if (this.verbose) {
      const logContext: DecisionLogContext = {
        player,
        state,
        availableCards,
        cards,
        turnNumber: state.turnNumber,
      };
      logAIDecisions(logContext);
    }

    // Utiliser le calculateur de delta pour trouver le meilleur coup
    const bestMove = evaluateBestMoveWithLookahead(
      player,
      availableCards,
      state.board.messengerLocation,
      cards,
      state.turnNumber
    );

    if (this.debug && bestMove) {
      console.log(`[HardAI] Best move: ${bestMove.reasoning} (delta: ${bestMove.totalDelta.toFixed(1)}, baseScore: ${bestMove.placeOption.deltaScore})`);
    }

    if (bestMove) {
      // Sauvegarder la position optimale pour selectPlaceAction
      this.lastBestPosition = bestMove.placeOption.position;

      return {
        cardId: bestMove.buyOption.cardId,
        flipped: bestMove.buyOption.flipped,
      };
    }

    // Fallback: utiliser MCTS si le calculateur de delta échoue
    const context = buildContext(state, player.id, cards);
    const tree = buildActionTree(context, 5);
    const selectedAction = mctsSelect(tree, cards, this.config);

    if (selectedAction?.type === 'buy_card') {
      return {
        cardId: selectedAction.cardId!,
        flipped: false,
      };
    }

    if (selectedAction?.type === 'buy_card_flipped') {
      return {
        cardId: selectedAction.cardId!,
        flipped: true,
      };
    }

    // Dernier recours: premier achat possible
    const affordableCards = this.getAffordableCards(state, availableCards);
    if (affordableCards.length > 0) {
      return {
        cardId: affordableCards[0],
        flipped: false,
      };
    }

    return {
      cardId: availableCards[0],
      flipped: true,
    };
  }

  // Position optimale calculée lors de selectBuyAction
  private lastBestPosition: number | null = null;

  /**
   * Choisit une position de placement
   *
   * Utilise la position optimale calculée lors de selectBuyAction si disponible.
   */
  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    if (validPositions.length === 0) {
      throw new Error('[HardAI] No valid positions');
    }

    if (validPositions.length === 1) {
      return validPositions[0];
    }

    // Utiliser la position pré-calculée si disponible et valide
    if (this.lastBestPosition !== null && validPositions.includes(this.lastBestPosition)) {
      const position = this.lastBestPosition;
      this.lastBestPosition = null; // Reset pour le prochain tour
      if (this.debug) {
        console.log(`[HardAI] Using pre-calculated position: ${position}`);
      }
      return position;
    }

    // Sinon, recalculer avec le delta calculator
    const player = this.getCurrentPlayer(state);
    const cards = this.getCards();

    const coinsOnCards = new Map<string, number>();
    for (const placed of player.board) {
      if (placed && placed.coinsOnCard > 0) {
        coinsOnCards.set(placed.cardId, placed.coinsOnCard);
      }
    }

    const placeOptions = evaluatePlaceOptions(
      player,
      cardId,
      player.keys,
      coinsOnCards,
      cards
    );

    if (placeOptions.length > 0) {
      const bestPosition = placeOptions[0].position;
      if (validPositions.includes(bestPosition)) {
        if (this.debug) {
          console.log(`[HardAI] Delta calc position: ${bestPosition} (delta: ${placeOptions[0].deltaScore})`);
        }
        return bestPosition;
      }
    }

    // Fallback: evaluer chaque position manuellement
    return this.evaluateBestPosition(state, cardId, validPositions);
  }

  /**
   * Decide si utiliser une cle avec MCTS
   */
  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    const player = this.getCurrentPlayer(state);

    if (player.keys === 0 || state.keyUsedThisTurn) {
      return null;
    }

    const cards = this.getCards();
    const context = buildContext(state, player.id, cards);

    // Construire l'arbre pour evaluer les options de cle
    const tree = buildActionTree(context, 3);

    const selectedAction = mctsSelect(tree, cards, {
      ...this.config,
      maxIterations: 100, // Rapide pour cette decision
    });

    if (selectedAction?.type === 'spend_key' && selectedAction.targetLocation) {
      // Determiner si c'est un deplacement ou un refresh
      const isMove = selectedAction.targetLocation !== state.board.messengerLocation;
      return {
        type: isMove ? 'move_messenger' : 'refresh',
        targetLocation: selectedAction.targetLocation,
      };
    }

    return null;
  }

  /**
   * Decide si ouvrir un cadenas
   */
  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    const player = this.getCurrentPlayer(state);

    if (player.keys === 0 || state.lockUsedThisTurn || availableLocks.length === 0) {
      return null;
    }

    // Evaluer chaque cadenas
    const cards = this.getCards();
    let bestLock: number | null = null;
    let bestScore = 0;

    for (const position of availableLocks) {
      const placedCard = player.board[position];
      if (!placedCard) continue;

      const card = cards.get(placedCard.cardId);
      if (!card?.lock_effect) continue;

      // Estimer la valeur de l'effet cadenas
      let score = this.estimateLockEffectValue(card.lock_effect, state);

      // Garder une cle si on est tot dans la partie
      if (player.keys <= 1 && state.turnNumber < 6) {
        score -= 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestLock = position;
      }
    }

    return bestScore > 0 ? bestLock : null;
  }

  /**
   * Choisit entre plusieurs options d'effet
   */
  selectEffectOption(state: PlayGameState, options: AIEffectOption[]): number {
    const player = this.getCurrentPlayer(state);

    // Evaluer chaque option
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (const option of options) {
      let score = 0;

      // Analyser la description pour estimer la valeur
      const desc = option.description.toLowerCase();

      // Or
      const goldMatch = desc.match(/\+(\d+)\s*or/);
      if (goldMatch) {
        const gold = parseInt(goldMatch[1]);
        score += gold * (player.gold < 5 ? 1.5 : 1);
      }

      // Cles
      const keyMatch = desc.match(/\+(\d+)\s*cle/);
      if (keyMatch) {
        const keys = parseInt(keyMatch[1]);
        score += keys * (player.keys < 2 ? 2 : 1.5);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = option.index;
      }
    }

    return bestIndex;
  }

  /**
   * Choisit un lieu pour un effet
   */
  selectLocation(state: PlayGameState, _choice: ReplaceLocationChoice): Location {
    // Evaluer quel lieu a les cartes les moins utiles pour nous
    const cards = this.getCards();

    const castleScore = state.board.castleCards.reduce((sum, id) => {
      const card = cards.get(id);
      return sum + (card?.value ?? 0);
    }, 0);

    const villageScore = state.board.villageCards.reduce((sum, id) => {
      const card = cards.get(id);
      return sum + (card?.value ?? 0);
    }, 0);

    // Remplacer le lieu avec le moins bon score
    return castleScore < villageScore ? 'castle' : 'village';
  }

  /**
   * Choisit une carte a defausser
   */
  selectDiscardCard(_state: PlayGameState, _choice: DiscardChoice, availableCards: string[]): string {
    const cards = this.getCards();

    // Defausser la carte qui nous serait la moins utile
    let worstCard = availableCards[0];
    let worstScore = Infinity;

    for (const cardId of availableCards) {
      const card = cards.get(cardId);
      let score = card?.value ?? 0;

      // Malus si la carte n'a pas notre couleur dominante
      // (donc c'est bien de la defausser)
      score -= 2;

      if (score < worstScore) {
        worstScore = score;
        worstCard = cardId;
      }
    }

    return worstCard;
  }

  /**
   * Choisit une carte adjacente a activer
   */
  selectAdjacentCard(state: PlayGameState, choice: AdjacentCardChoice): number {
    const player = this.getCurrentPlayer(state);
    const cards = this.getCards();

    // Choisir la carte adjacente avec le meilleur effet
    let bestPosition = choice.adjacentPositions[0];
    let bestScore = 0;

    for (const position of choice.adjacentPositions) {
      const placedCard = player.board[position];
      if (!placedCard) continue;

      const card = cards.get(placedCard.cardId);
      if (!card) continue;

      // Estimer la valeur de l'effet
      let score = 0;
      for (const effect of card.effects) {
        score += this.estimateEffectValue(effect, state);
      }

      if (score > bestScore) {
        bestScore = score;
        bestPosition = position;
      }
    }

    return bestPosition;
  }

  /**
   * Choisit quelles bourses remplir
   */
  selectPurses(state: PlayGameState, choice: PurseSelectionChoice): number[] {
    const player = this.getCurrentPlayer(state);
    const cards = this.getCards();

    // Evaluer chaque bourse
    const evaluatedPurses = choice.availablePositions.map(position => {
      const placedCard = player.board[position];
      if (!placedCard) return { position, score: 0 };

      const card = cards.get(placedCard.cardId);
      if (!card) return { position, score: 0 };

      // Score base sur la capacite restante
      const remaining = card.max_coins - placedCard.coinsOnCard;
      return { position, score: remaining };
    });

    // Trier par score decroissant et prendre les N meilleurs
    evaluatedPurses.sort((a, b) => b.score - a.score);
    return evaluatedPurses.slice(0, choice.maxCards).map(p => p.position);
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  private evaluateBestPosition(
    state: PlayGameState,
    cardId: string,
    validPositions: number[]
  ): number {
    const player = this.getCurrentPlayer(state);
    const card = this.getCards().get(cardId);

    let bestPosition = validPositions[0];
    let bestScore = -Infinity;

    for (const position of validPositions) {
      let score = 0;

      // Compter les voisins
      const adjacentCount = this.countOccupiedAdjacent(player.board, position);
      score += adjacentCount * 3;

      // Bonus si complete une ligne ou colonne
      if (this.wouldCompleteLine(player.board, position)) score += 5;
      if (this.wouldCompleteColumn(player.board, position)) score += 5;

      // Bonus pour le centre
      if (position === 4) score += 2;

      // Synergies de couleurs
      if (card) {
        score += this.evaluateColorSynergies(player.board, position, card);
      }

      if (score > bestScore) {
        bestScore = score;
        bestPosition = position;
      }
    }

    return bestPosition;
  }

  private countOccupiedAdjacent(board: any[], position: number): number {
    const adjacencyMap: Record<number, number[]> = {
      0: [1, 3], 1: [0, 2, 4], 2: [1, 5],
      3: [0, 4, 6], 4: [1, 3, 5, 7], 5: [2, 4, 8],
      6: [3, 7], 7: [4, 6, 8], 8: [5, 7],
    };
    return (adjacencyMap[position] ?? []).filter(p => board[p] !== null).length;
  }

  private wouldCompleteLine(board: any[], position: number): boolean {
    const row = Math.floor(position / 3);
    const positions = [row * 3, row * 3 + 1, row * 3 + 2].filter(p => p !== position);
    return positions.every(p => board[p] !== null);
  }

  private wouldCompleteColumn(board: any[], position: number): boolean {
    const col = position % 3;
    const positions = [col, col + 3, col + 6].filter(p => p !== position);
    return positions.every(p => board[p] !== null);
  }

  private evaluateColorSynergies(board: any[], position: number, card: any): number {
    const adjacencyMap: Record<number, number[]> = {
      0: [1, 3], 1: [0, 2, 4], 2: [1, 5],
      3: [0, 4, 6], 4: [1, 3, 5, 7], 5: [2, 4, 8],
      6: [3, 7], 7: [4, 6, 8], 8: [5, 7],
    };

    let synergies = 0;
    const adjacent = adjacencyMap[position] ?? [];

    for (const adjPos of adjacent) {
      const adjPlaced = board[adjPos];
      if (!adjPlaced) continue;

      const adjCard = this.getCards().get(adjPlaced.cardId);
      if (!adjCard) continue;

      // Bonus pour chaque couleur en commun
      for (const shield of card.shields ?? []) {
        if (adjCard.shields?.some((s: any) => s.color === shield.color)) {
          synergies += shield.count;
        }
      }
    }

    return synergies;
  }

  private estimateLockEffectValue(effect: any, state: PlayGameState): number {
    const type = effect.type;
    const player = this.getCurrentPlayer(state);
    const placedCount = player.board.filter(p => p !== null).length;
    const turnsRemaining = 9 - placedCount;

    switch (type) {
      case 'gain_gold':
        return (effect.amount ?? 0) * 1.5;
      case 'gain_keys':
        return (effect.amount ?? 0) * 2;
      case 'fill_purses':
        return 2;
      case 'fill_purses_select':
        return (effect.amount ?? 2) * 1.5;
      case 'replace_location':
        // ATTENTION: remplacer le lieu après l'achat = on ne peut pas profiter des nouvelles cartes
        // Ce n'est utile que si on a beaucoup de tours restants ET qu'on veut remplacer de mauvaises cartes
        // Mais généralement c'est une mauvaise idée de l'utiliser en fin de tour
        return turnsRemaining > 3 ? 1 : -5; // Pénaliser fortement en fin de partie
      case 'replace_location_gain_keys_per_shield':
      case 'replace_location_gain_keys_per_feature':
        // Ces effets remplacent ET donnent des clés
        // Les clés sont précieuses mais on perd l'opportunité d'acheter les nouvelles cartes
        // Seulement utile si les clés valent beaucoup (cartes 017/066 sur le plateau)
        {
          const keyCardCount = player.board.filter(
            p => p?.cardId === '017' || p?.cardId === '066'
          ).length;

          if (keyCardCount > 0) {
            // Chaque clé vaut potentiellement 2 pts (017/066)
            // Mais on perd l'achat du tour
            const estimatedKeys = (effect.keys_per_card ?? 2) * 2; // Estimation
            return estimatedKeys * keyCardCount - 3; // -3 pour compenser la perte d'achat
          }
          return turnsRemaining > 3 ? 0 : -5;
        }

      // =========================================================================
      // ACTIVATE_ADJACENT : Évaluer les cartes adjacentes
      // IMPORTANT: Les effets permanents (réductions) ne sont PAS activables !
      // =========================================================================
      case 'activate_adjacent':
        return this.evaluateActivateAdjacentValue(effect, state);

      default:
        return 1;
    }
  }

  /**
   * Évalue la valeur de l'effet activate_adjacent.
   *
   * IMPORTANT: Distingue les effets ACTIVABLES des effets PERMANENTS.
   * Les réductions (reduction_castle, reduction_village, reduction_both) sont
   * des effets permanents qui s'appliquent à l'achat de la carte, PAS des effets
   * qui peuvent être déclenchés par activate_adjacent.
   */
  private evaluateActivateAdjacentValue(effect: any, state: PlayGameState): number {
    const player = this.getCurrentPlayer(state);
    const cards = this.getCards();

    // Trouver la position du cadenas (la carte avec cet effet lock)
    let lockPosition: number | null = null;
    for (let i = 0; i < player.board.length; i++) {
      const placed = player.board[i];
      if (!placed) continue;
      const card = cards.get(placed.cardId);
      if (card?.lock_effect?.type === 'activate_adjacent') {
        lockPosition = i;
        break;
      }
    }

    if (lockPosition === null) return -1; // Cadenas pas trouvé

    // Positions adjacentes
    const adjacencyMap: Record<number, number[]> = {
      0: [1, 3], 1: [0, 2, 4], 2: [1, 5],
      3: [0, 4, 6], 4: [1, 3, 5, 7], 5: [2, 4, 8],
      6: [3, 7], 7: [4, 6, 8], 8: [5, 7],
    };

    const adjacentPositions = adjacencyMap[lockPosition] ?? [];

    // Effets PERMANENTS qui ne peuvent PAS être activés
    const PERMANENT_EFFECTS = new Set([
      'reduction_castle',
      'reduction_village',
      'reduction_both',
      'reduction', // Alias
    ]);

    let totalValue = 0;
    let activatableCount = 0;

    for (const adjPos of adjacentPositions) {
      const adjPlaced = player.board[adjPos];
      if (!adjPlaced) continue;

      const adjCard = cards.get(adjPlaced.cardId);
      if (!adjCard) continue;

      // Évaluer chaque effet de la carte adjacente
      for (const adjEffect of adjCard.effects) {
        // Ignorer les effets permanents
        if (PERMANENT_EFFECTS.has(adjEffect.type)) {
          continue;
        }

        // Évaluer l'effet activable
        const effectValue = this.estimateEffectValue(adjEffect, state);
        if (effectValue > 0) {
          totalValue += effectValue;
          activatableCount++;
        }
      }
    }

    // Si aucun effet activable, c'est une mauvaise utilisation du cadenas
    if (activatableCount === 0) {
      return -2; // Pénalité pour cadenas inutile
    }

    return totalValue;
  }

  private estimateEffectValue(effect: any, state: PlayGameState): number {
    const type = effect.type;

    switch (type) {
      case 'gain_gold':
        return effect.amount ?? 0;
      case 'gain_keys':
        return (effect.amount ?? 0) * 1.5;
      case 'fill_purses':
        return 1;
      case 'reduction':
        return (9 - state.turnNumber) * 0.5;
      default:
        return 0.5;
    }
  }
}
