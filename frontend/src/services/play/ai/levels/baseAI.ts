/**
 * Classe de base pour les IA
 *
 * Fournit les implementations par defaut et les utilitaires communs.
 */

import type {
  AIPlayer,
  AILevel,
  AIBuyDecision,
  AIKeyAction,
  AIEffectOption,
  PlayGameState,
  PlayCard,
  GameAction,
  Location,
  DiscardChoice,
  ReplaceLocationChoice,
  AdjacentCardChoice,
  PurseSelectionChoice,
} from '../../../../types/play';
import { getValidPlacements, getEffectiveCost } from '../../../../types/play';
import { loadCards, getCardsCache } from '../context/builder';

// Limite d'iterations pour eviter les boucles infinies
const MAX_ITERATIONS = 100;

/**
 * Classe de base abstraite pour les IA
 */
export abstract class BaseAI implements AIPlayer {
  abstract level: AILevel;
  abstract name: string;

  protected cards: Map<string, PlayCard> = new Map();
  protected cardsLoaded: boolean = false;
  protected iterations: number = 0;

  /**
   * Charge les cartes (a appeler au debut de chaque methode)
   */
  protected async ensureCardsLoaded(): Promise<void> {
    if (!this.cardsLoaded) {
      this.cards = await loadCards();
      this.cardsLoaded = true;
    } else {
      // Utiliser le cache si deja charge
      this.cards = getCardsCache();
    }
  }

  /**
   * Retourne les cartes chargees (synchrone)
   * Priorite: cache local > cache global (gameEngine)
   */
  protected getCards(): Map<string, PlayCard> {
    // Priorite 1: utiliser notre cache local s'il est rempli
    if (this.cards.size > 0) {
      return this.cards;
    }

    // Priorite 2: essayer le cache global
    const cache = getCardsCache();

    if (cache.size > 0) {
      this.cards = cache;
      this.cardsLoaded = true;
      return this.cards;
    }

    // Pas de cartes disponibles
    console.warn(`[${this.name}] Cards cache is empty! AI decisions may be incorrect.`);
    return this.cards;
  }

  // ===========================================================================
  // Methodes abstraites a implementer par les sous-classes
  // ===========================================================================

  abstract selectBuyAction(state: PlayGameState, availableCards: string[]): AIBuyDecision;
  abstract selectPlaceAction(state: PlayGameState, cardId: string, validPositions: number[]): number;

  // ===========================================================================
  // Methodes par defaut (peuvent etre surchargees)
  // ===========================================================================

  /**
   * Par defaut, n'utilise pas de cle
   */
  selectKeyAction(_state: PlayGameState): AIKeyAction | null {
    return null;
  }

  /**
   * Par defaut, n'ouvre pas de cadenas
   */
  selectLockAction(_state: PlayGameState, _availableLocks: number[]): number | null {
    return null;
  }

  /**
   * Par defaut, choisit la premiere option
   */
  selectEffectOption(_state: PlayGameState, options: AIEffectOption[]): number {
    return options.length > 0 ? options[0].index : 0;
  }

  /**
   * Par defaut, choisit le lieu du messager
   */
  selectLocation(state: PlayGameState, _choice: ReplaceLocationChoice): Location {
    return state.board.messengerLocation;
  }

  /**
   * Par defaut, defausse la premiere carte
   */
  selectDiscardCard(_state: PlayGameState, _choice: DiscardChoice, availableCards: string[]): string {
    return availableCards[0];
  }

  /**
   * Par defaut, choisit la premiere carte adjacente
   */
  selectAdjacentCard(_state: PlayGameState, choice: AdjacentCardChoice): number {
    return choice.adjacentPositions[0];
  }

  /**
   * Par defaut, remplit les premieres bourses disponibles
   */
  selectPurses(_state: PlayGameState, choice: PurseSelectionChoice): number[] {
    return choice.availablePositions.slice(0, choice.maxCards);
  }

  /**
   * Les IA algorithmiques sont toujours disponibles
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================

  /**
   * Retourne le joueur courant
   */
  protected getCurrentPlayer(state: PlayGameState) {
    return state.players[state.currentPlayerIndex];
  }

  /**
   * Retourne les cartes achetables (assez d'or)
   */
  protected getAffordableCards(state: PlayGameState, availableCards: string[]): string[] {
    const player = this.getCurrentPlayer(state);
    const cards = this.getCards();

    return availableCards.filter(cardId => {
      const card = cards.get(cardId);
      if (!card) return false;

      const cost = getEffectiveCost(
        card.value,
        card.category,
        player.reductionCastle,
        player.reductionVillage
      );

      return player.gold >= cost;
    });
  }

  /**
   * Retourne le cout effectif d'une carte pour le joueur courant
   */
  protected getCardCost(state: PlayGameState, cardId: string): number {
    const player = this.getCurrentPlayer(state);
    const card = this.getCards().get(cardId);

    if (!card) return 0;

    return getEffectiveCost(
      card.value,
      card.category,
      player.reductionCastle,
      player.reductionVillage
    );
  }

  /**
   * Retourne les positions valides pour le placement
   */
  protected getValidPositions(state: PlayGameState): number[] {
    const player = this.getCurrentPlayer(state);
    return getValidPlacements(player.board);
  }

  /**
   * Choisit un element au hasard dans un tableau
   */
  protected pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Choisit parmi les N premiers elements
   */
  protected pickFromTopN<T>(array: T[], n: number): T {
    const topN = array.slice(0, Math.min(n, array.length));
    return this.pickRandom(topN);
  }

  // ===========================================================================
  // Methodes wrapper pour compatibilite avec PlayContext
  // PlayContext utilise des noms differents de l'interface AIPlayer
  // ===========================================================================

  /**
   * Reset le compteur d'iterations (appele au debut du tour)
   */
  resetIterations(): void {
    this.iterations = 0;
  }

  /**
   * Verifie si on a depasse la limite d'iterations
   * @returns false si on a depasse la limite
   */
  checkIterations(): boolean {
    this.iterations++;
    return this.iterations < MAX_ITERATIONS;
  }

  /**
   * Wrapper pour selectKeyAction (nom attendu par PlayContext)
   */
  getKeyAction(state: PlayGameState): AIKeyAction | null {
    return this.selectKeyAction(state);
  }

  /**
   * Wrapper pour selectLockAction (nom attendu par PlayContext)
   */
  getLockAction(state: PlayGameState): number | null {
    const player = this.getCurrentPlayer(state);

    // Trouver les cadenas disponibles
    const availableLocks: number[] = [];
    for (const [position, hasKey] of player.lockedCards) {
      if (hasKey) {
        availableLocks.push(position);
      }
    }

    if (availableLocks.length === 0) {
      return null;
    }

    return this.selectLockAction(state, availableLocks);
  }

  /**
   * Wrapper pour selectBuyAction (retourne GameAction)
   */
  getBuyAction(state: PlayGameState): { action: GameAction } {
    const player = this.getCurrentPlayer(state);

    // Obtenir les cartes disponibles a l'achat
    const availableCards = state.board.messengerLocation === 'castle'
      ? state.board.castleCards
      : state.board.villageCards;

    const decision = this.selectBuyAction(state, availableCards);

    const action: GameAction = {
      type: decision.flipped ? 'buy_card_flipped' : 'buy_card',
      playerId: player.id,
      cardId: decision.cardId,
    };

    return { action };
  }

  /**
   * Wrapper pour selectPlaceAction (retourne GameAction)
   */
  getPlaceAction(state: PlayGameState): { action: GameAction } {
    const player = this.getCurrentPlayer(state);
    const cardId = state.purchasedCard;

    if (!cardId) {
      throw new Error('[BaseAI] No purchased card to place');
    }

    const validPositions = this.getValidPositions(state);
    const position = this.selectPlaceAction(state, cardId, validPositions);

    const action: GameAction = {
      type: 'place_card',
      playerId: player.id,
      cardId,
      position,
    };

    return { action };
  }

  /**
   * Wrapper pour selectEffectOption (nom attendu par PlayContext)
   */
  getEffectOption(state: PlayGameState, options: AIEffectOption[]): number {
    return this.selectEffectOption(state, options);
  }

  /**
   * Wrapper pour selectDiscardCard (nom attendu par PlayContext)
   */
  getDiscardChoice(state: PlayGameState, choice: DiscardChoice): string {
    const availableCards = choice.location === 'castle'
      ? state.board.castleCards
      : state.board.villageCards;

    return this.selectDiscardCard(state, choice, availableCards);
  }

  /**
   * Wrapper pour selectPurses (nom attendu par PlayContext)
   */
  getPurseChoice(state: PlayGameState, choice: PurseSelectionChoice): number[] {
    return this.selectPurses(state, choice);
  }

  /**
   * Wrapper pour selectLocation (nom attendu par PlayContext)
   */
  getLocationChoice(state: PlayGameState, choice: ReplaceLocationChoice): Location {
    return this.selectLocation(state, choice);
  }

  /**
   * Wrapper pour selectAdjacentCard (nom attendu par PlayContext)
   */
  getAdjacentCardChoice(state: PlayGameState, choice: AdjacentCardChoice): number {
    return this.selectAdjacentCard(state, choice);
  }
}
