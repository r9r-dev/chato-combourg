/**
 * IA Difficile
 *
 * Utilise l'evaluation de delta pour prendre des decisions optimales.
 * Considere les anti-synergies et la valeur future des ressources.
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
import type { HardAIConfig } from '../types';
import {
  evaluateBestMoveWithLookahead,
  evaluatePlaceOptions,
  evaluateAvailableCards,
  compareLevels,
} from '../evaluator/deltaCalculator';
import { logAIDecisions, type DecisionLogContext } from '../debug/decisionLogger';

// Note: Config MCTS non utilisée actuellement - MCTS désactivé
// const DEFAULT_CONFIG: HardAIConfig = {
//   maxIterations: 500,
//   maxTimeMs: 3000,
//   explorationConstant: Math.sqrt(2),
// };

/**
 * IA Difficile - MCTS
 */
export class HardAI extends BaseAI {
  level: AILevel = 'hard';
  name = 'Expert';
  // Note: config MCTS (maxIterations, maxTimeMs) non utilisé actuellement
  // car MCTS est désactivé au profit du calcul de delta
  private debug: boolean = false;
  private verbose: boolean = false;

  constructor(_config: Partial<HardAIConfig> = {}, debug: boolean = false, verbose: boolean = false) {
    super();
    // Config ignorée - MCTS désactivé (voir commentaire ci-dessus)
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
      // Sauvegarder la position et le shift optimaux pour selectPlaceAction
      this.lastBestPosition = bestMove.placeOption.position;
      this.lastBestShift = bestMove.placeOption.shiftDirection ?? null;

      return {
        cardId: bestMove.buyOption.cardId,
        flipped: bestMove.buyOption.flipped,
      };
    }

    // Fallback simple: premier achat possible
    // Note: MCTS désactivé car buildActionTree(depth=5) crée un arbre exponentiel
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

  // Position et shift optimaux calculés lors de selectBuyAction
  private lastBestPosition: number | null = null;
  private lastBestShift: string | null = null;

  /**
   * Choisit une position de placement
   *
   * Utilise la position optimale calculée lors de selectBuyAction si disponible.
   */
  selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number {
    // Utiliser la position pré-calculée si disponible
    // Pour les zones externes (avec shift), la position peut ne pas être dans validPositions
    if (this.lastBestPosition !== null) {
      const position = this.lastBestPosition;
      const hasShift = this.lastBestShift !== null;

      // Position valide si: interne ET dans validPositions, OU externe avec shift
      const isValid = validPositions.includes(position) || hasShift;

      if (isValid) {
        this.lastBestPosition = null; // Reset pour le prochain tour
        // Note: lastBestShift est conservé pour être récupéré via getLastShiftDirection()
        if (this.debug) {
          console.log(`[HardAI] Using pre-calculated position: ${position}${hasShift ? ` (shift: ${this.lastBestShift})` : ''}`);
        }
        return position;
      }
    }

    if (validPositions.length === 0) {
      throw new Error('[HardAI] No valid positions');
    }

    if (validPositions.length === 1) {
      return validPositions[0];
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
      const bestOption = placeOptions[0];
      const bestPosition = bestOption.position;
      const hasShift = !!bestOption.shiftDirection;

      // Position valide si: interne ET dans validPositions, OU externe avec shift
      if (validPositions.includes(bestPosition) || hasShift) {
        // Sauvegarder le shift pour récupération ultérieure
        if (hasShift) {
          this.lastBestShift = bestOption.shiftDirection ?? null;
        }
        if (this.debug) {
          console.log(`[HardAI] Delta calc position: ${bestPosition} (delta: ${bestOption.deltaScore})${hasShift ? ` (shift: ${bestOption.shiftDirection})` : ''}`);
        }
        return bestPosition;
      }
    }

    // Fallback: evaluer chaque position manuellement (positions internes seulement)
    return this.evaluateBestPosition(state, cardId, validPositions);
  }

  /**
   * Récupère la direction du shift pour le dernier placement calculé
   * Appelé après selectPlaceAction pour obtenir le shift à utiliser
   */
  getLastShiftDirection(): string | null {
    const shift = this.lastBestShift;
    this.lastBestShift = null; // Reset après récupération
    return shift;
  }

  /**
   * Décide si utiliser une clé avec logique déterministe
   *
   * Stratégie:
   * 1. Évaluer les cartes disponibles au lieu actuel
   * 2. Si toutes ont des anti-synergies ou sont mauvaises, considérer un refresh
   * 3. Comparer avec l'autre lieu pour voir si un déplacement vaut mieux
   * 4. Garder la clé si les cartes sont acceptables
   */
  selectKeyAction(state: PlayGameState): AIKeyAction | null {
    const player = this.getCurrentPlayer(state);

    if (player.keys === 0 || state.keyUsedThisTurn) {
      return null;
    }

    const cards = this.getCards();
    const placedCount = player.board.filter(p => p !== null).length;
    const turnsRemaining = 9 - placedCount;

    // Comparer les deux lieux
    const comparison = compareLevels(
      player,
      state.board.castleCards,
      state.board.villageCards,
      state.board.messengerLocation,
      cards
    );

    if (this.debug) {
      console.log(`[HardAI] Key decision analysis:`);
      console.log(`  - Current location: ${state.board.messengerLocation}`);
      console.log(`  - Current best value: ${comparison.currentAnalysis.bestCard?.estimatedValue?.toFixed(1) ?? 'N/A'}`);
      console.log(`  - Other best value: ${comparison.otherAnalysis.bestCard?.estimatedValue?.toFixed(1) ?? 'N/A'}`);
      console.log(`  - Should move: ${comparison.shouldMove} (${comparison.moveReason})`);
      console.log(`  - Should refresh current: ${comparison.currentAnalysis.shouldRefresh} (${comparison.currentAnalysis.refreshReason})`);
    }

    // Priorité 1: Déplacer le messager si l'autre lieu est significativement meilleur
    if (comparison.shouldMove) {
      const targetLocation = state.board.messengerLocation === 'castle' ? 'village' : 'castle';
      if (this.debug) {
        console.log(`[HardAI] Moving messenger to ${targetLocation}: ${comparison.moveReason}`);
      }
      return {
        type: 'move_messenger',
        targetLocation,
      };
    }

    // Priorité 2: Rafraîchir si les cartes actuelles sont mauvaises
    // MAIS: Ne pas gaspiller une clé si on est en fin de partie et que les clés valent des points
    const hasKeyScoreCards = player.board.some(
      p => p?.cardId === '017' || p?.cardId === '066'
    );
    const keyValue = hasKeyScoreCards ? 2 : 0; // Chaque clé vaut 2 pts si on a ces cartes

    if (comparison.currentAnalysis.shouldRefresh) {
      // Estimer la valeur du refresh vs garder la clé
      // Le refresh coûte 1 clé mais peut potentiellement améliorer le delta de ~10 pts
      const estimatedRefreshBenefit = 8; // Estimation conservatrice

      // Si les clés valent des points, être plus prudent
      if (keyValue > 0 && turnsRemaining <= 3) {
        // En fin de partie avec cartes à clés, garder les clés
        if (this.debug) {
          console.log(`[HardAI] Keeping key (worth ${keyValue} pts) despite bad cards`);
        }
        return null;
      }

      if (estimatedRefreshBenefit > keyValue) {
        if (this.debug) {
          console.log(`[HardAI] Refreshing: ${comparison.currentAnalysis.refreshReason}`);
        }
        return {
          type: 'refresh',
          targetLocation: state.board.messengerLocation,
        };
      }
    }

    // Priorité 3: Ne pas utiliser de clé si les cartes sont acceptables
    return null;
  }

  /**
   * Décide si ouvrir un cadenas
   *
   * Stratégie améliorée:
   * 1. Évaluer la valeur réelle de chaque effet de cadenas
   * 2. Considérer si replace_location pourrait donner de meilleures cartes
   * 3. Tenir compte de la valeur des clés (cartes 017/066)
   * 4. Ne pas ouvrir si la clé vaut plus que l'effet
   */
  selectLockAction(state: PlayGameState, availableLocks: number[]): number | null {
    const player = this.getCurrentPlayer(state);

    if (player.keys === 0 || state.lockUsedThisTurn || availableLocks.length === 0) {
      return null;
    }

    const cards = this.getCards();
    const placedCount = player.board.filter(p => p !== null).length;
    const turnsRemaining = 9 - placedCount;

    // Calculer la valeur des clés
    const hasKeyScoreCards = player.board.some(
      p => p?.cardId === '017' || p?.cardId === '066'
    );
    const keyPointValue = hasKeyScoreCards ? 2 : 0;

    // Évaluer les cartes disponibles pour savoir si replace_location vaut le coup
    const currentAnalysis = evaluateAvailableCards(
      player,
      state.board.messengerLocation === 'castle'
        ? state.board.castleCards
        : state.board.villageCards,
      state.board.messengerLocation,
      cards
    );

    let bestLock: number | null = null;
    let bestScore = keyPointValue; // Seuil = valeur de la clé

    for (const position of availableLocks) {
      const placedCard = player.board[position];
      if (!placedCard) continue;

      const card = cards.get(placedCard.cardId);
      if (!card?.lock_effect) continue;

      // Estimer la valeur de l'effet cadenas avec contexte amélioré
      let score = this.estimateLockEffectValue(card.lock_effect, state, currentAnalysis);

      // Bonus si on a besoin d'or et que l'effet en donne
      if (card.lock_effect.type === 'gain_gold' && player.gold < 3) {
        score += 2;
      }

      // Bonus si on a besoin de clés et que l'effet en donne
      if (card.lock_effect.type === 'gain_keys' && player.keys <= 1) {
        score += 1;
      }

      // Pénalité si on est en fin de partie et que les clés valent des points
      if (hasKeyScoreCards && turnsRemaining <= 2) {
        score -= keyPointValue;
      }

      if (this.debug) {
        console.log(`[HardAI] Lock at position ${position}: effect=${card.lock_effect.type}, score=${score.toFixed(1)}`);
      }

      if (score > bestScore) {
        bestScore = score;
        bestLock = position;
      }
    }

    if (this.debug && bestLock !== null) {
      console.log(`[HardAI] Opening lock at position ${bestLock} (score: ${bestScore.toFixed(1)})`);
    }

    return bestLock;
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

  private estimateLockEffectValue(
    effect: any,
    state: PlayGameState,
    currentAnalysis?: { shouldRefresh: boolean; allHaveAntiSynergies: boolean; bestCard: { estimatedValue: number } | null }
  ): number {
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
        // Vérifier si on a des bourses à remplir
        {
          const emptyPurseSlots = player.board.reduce((count, placed) => {
            if (!placed) return count;
            const card = this.getCards().get(placed.cardId);
            if (card?.has_coin_purse) {
              return count + (card.max_coins - placed.coinsOnCard);
            }
            return count;
          }, 0);
          // Chaque slot rempli = 2 pts
          return Math.min(emptyPurseSlots, effect.amount ?? 2) * 2;
        }
      case 'fill_purses_select':
        {
          const emptySlots = player.board.reduce((count, placed) => {
            if (!placed) return count;
            const card = this.getCards().get(placed.cardId);
            if (card?.has_coin_purse) {
              return count + (card.max_coins - placed.coinsOnCard);
            }
            return count;
          }, 0);
          return Math.min(emptySlots, effect.amount ?? 2) * 2;
        }
      case 'replace_location':
        // Utiliser l'analyse des cartes disponibles si fournie
        if (currentAnalysis) {
          // Si les cartes actuelles sont mauvaises, replace_location est TRÈS utile
          if (currentAnalysis.allHaveAntiSynergies) {
            return turnsRemaining > 1 ? 8 : 2; // Très utile si il reste des tours
          }
          if (currentAnalysis.shouldRefresh) {
            return turnsRemaining > 1 ? 5 : 1;
          }
          // Les cartes actuelles sont OK, pas besoin de remplacer
          return turnsRemaining > 3 ? 1 : -3;
        }
        // Sans analyse, être conservateur
        return turnsRemaining > 3 ? 1 : -5;
      case 'replace_location_gain_keys_per_shield':
      case 'replace_location_gain_keys_per_feature':
        // Ces effets remplacent ET donnent des clés
        {
          const keyCardCount = player.board.filter(
            p => p?.cardId === '017' || p?.cardId === '066'
          ).length;

          // Bonus si les cartes actuelles sont mauvaises
          let replaceBonus = 0;
          if (currentAnalysis?.allHaveAntiSynergies) {
            replaceBonus = 5;
          } else if (currentAnalysis?.shouldRefresh) {
            replaceBonus = 3;
          }

          if (keyCardCount > 0) {
            // Chaque clé vaut potentiellement 2 pts (017/066)
            const estimatedKeys = (effect.keys_per_card ?? 2) * 2;
            return estimatedKeys * keyCardCount + replaceBonus - 2;
          }
          return replaceBonus + (turnsRemaining > 3 ? 0 : -3);
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
  private evaluateActivateAdjacentValue(_effect: any, state: PlayGameState): number {
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
