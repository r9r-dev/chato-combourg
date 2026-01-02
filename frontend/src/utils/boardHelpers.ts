/**
 * Board Helpers - Fonctions utilitaires partagees pour l'analyse du plateau
 *
 * Ces fonctions sont utilisees par:
 * - effectExecutor.ts (calcul des effets)
 * - Play.tsx (affichage UI)
 * - PlayContext.tsx (logique IA)
 */

import type { PlayPlayer, PlayGameState, ShieldColor } from '../types/play';
import { getCard } from '../services/play/gameEngine';

// =============================================================================
// Constantes
// =============================================================================

export const SHIELD_COLOR_NAMES: Record<ShieldColor, string> = {
  blue: 'bleu',
  pink: 'rose',
  green: 'vert',
  red: 'rouge',
  orange: 'orange',
  yellow: 'jaune',
};

// =============================================================================
// Fonctions de comptage
// =============================================================================

/**
 * Compte le nombre de boucliers d'une couleur sur le plateau d'un joueur
 */
export function countShieldsOnBoard(player: PlayPlayer, color: ShieldColor): number {
  let count = 0;

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;

    for (const shield of card.shields) {
      if (shield.color === color) {
        count += shield.count;
      }
    }
  }

  return count;
}

/**
 * Compte le nombre de couleurs de boucliers uniques sur le plateau
 */
export function countUniqueShieldColors(player: PlayPlayer): number {
  const colors = new Set<ShieldColor>();

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (!card) continue;

    for (const shield of card.shields) {
      colors.add(shield.color as ShieldColor);
    }
  }

  return colors.size;
}

/**
 * Compte le nombre de cartes d'une categorie sur le plateau
 */
export function countCardsOfCategory(
  player: PlayPlayer,
  category: 'castle' | 'village'
): number {
  let count = 0;

  for (const placed of player.board) {
    if (!placed) continue;
    const card = getCard(placed.cardId);
    if (card?.category === category) {
      count++;
    }
  }

  return count;
}

// =============================================================================
// Fonctions de joueurs
// =============================================================================

/**
 * Retourne les joueurs voisins (precedent et suivant) d'un joueur
 */
export function getNeighborPlayers(
  state: PlayGameState,
  playerIndex: number
): PlayPlayer[] {
  const neighbors: PlayPlayer[] = [];
  const playerCount = state.players.length;

  if (playerCount <= 1) return neighbors;

  // Joueur precedent
  const prevIndex = (playerIndex - 1 + playerCount) % playerCount;
  neighbors.push(state.players[prevIndex]);

  // Joueur suivant (si different du precedent)
  const nextIndex = (playerIndex + 1) % playerCount;
  if (nextIndex !== prevIndex) {
    neighbors.push(state.players[nextIndex]);
  }

  return neighbors;
}

// =============================================================================
// Utilitaires
// =============================================================================

/**
 * Melange un tableau en place (Fisher-Yates)
 */
export function shuffle<T>(array: T[], rng: () => number = Math.random): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Retourne le nom francais d'une couleur de bouclier
 */
export function getColorName(color: ShieldColor): string {
  return SHIELD_COLOR_NAMES[color] ?? color;
}

/**
 * Genere l'URL d'une image de carte
 */
export function getCardImageUrl(cardId: string, apiBase: string = ''): string {
  return `${apiBase}/cards/thumbs/carte_${cardId}.webp`;
}
