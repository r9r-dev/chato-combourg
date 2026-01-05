/**
 * Clone profond de l'etat du jeu pour la simulation
 */

import type { PlayGameState, PlayPlayer, PlacedCard, CentralBoard } from '../../../../types/play';

/**
 * Clone profond de l'etat du jeu
 *
 * Cree une copie complete qui peut etre modifiee sans affecter l'original.
 */
export function cloneState(state: PlayGameState): PlayGameState {
  return {
    gameId: state.gameId,
    phase: state.phase,
    players: state.players.map(clonePlayer),
    currentPlayerIndex: state.currentPlayerIndex,
    turnNumber: state.turnNumber,
    turnPhase: state.turnPhase,
    keyUsedThisTurn: state.keyUsedThisTurn,
    lockUsedThisTurn: state.lockUsedThisTurn,
    purchasedCard: state.purchasedCard,
    purchasedCardCost: state.purchasedCardCost,
    board: cloneBoard(state.board),
    actionHistory: [...state.actionHistory],
    finalScores: state.finalScores ? new Map(state.finalScores) : undefined,
  };
}

/**
 * Clone un joueur
 */
function clonePlayer(player: PlayPlayer): PlayPlayer {
  return {
    ...player,
    board: player.board.map(card => card ? clonePlacedCard(card) : null),
    lockedCards: new Map(player.lockedCards),
  };
}

/**
 * Clone une carte placee
 */
function clonePlacedCard(card: PlacedCard): PlacedCard {
  return { ...card };
}

/**
 * Clone le plateau central
 */
function cloneBoard(board: CentralBoard): CentralBoard {
  return {
    castleCards: [...board.castleCards],
    villageCards: [...board.villageCards],
    messengerLocation: board.messengerLocation,
    castleDeck: [...board.castleDeck],
    villageDeck: [...board.villageDeck],
    castleDiscard: [...board.castleDiscard],
    villageDiscard: [...board.villageDiscard],
  };
}

/**
 * Compare deux etats pour verifier l'immutabilite
 * (utile pour les tests)
 */
export function statesAreEqual(a: PlayGameState, b: PlayGameState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
