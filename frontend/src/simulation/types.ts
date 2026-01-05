/**
 * Types pour le simulateur de parties
 */

import type { AILevel, GameAction } from '../types/play';

/**
 * Configuration d'un joueur pour la simulation
 */
export interface SimPlayerConfig {
  name: string;
  type: 'human_random' | 'ai';
  aiLevel?: AILevel;
}

/**
 * Configuration d'une simulation
 */
export interface SimConfig {
  /** Joueurs (2-5) */
  players: SimPlayerConfig[];
  /** Seed pour la reproductibilite (optionnel) */
  seed?: number;
  /** Afficher les logs dans la console */
  verbose?: boolean;
  /** Collecter les donnees pour l'entrainement */
  collectTrainingData?: boolean;
}

/**
 * Resultat d'une partie simulee
 */
export interface SimGameResult {
  /** ID unique de la partie */
  gameId: string;
  /** Seed utilise */
  seed?: number;
  /** Nombre de tours joues */
  turns: number;
  /** Resultats par joueur */
  players: SimPlayerResult[];
  /** Gagnant (index) */
  winnerIndex: number;
  /** Duree en ms */
  durationMs: number;
}

/**
 * Resultat d'un joueur
 */
export interface SimPlayerResult {
  name: string;
  type: 'human_random' | 'ai';
  aiLevel?: AILevel;
  /** Score final (estime ou exact) */
  score: number;
  /** Or restant */
  gold: number;
  /** Cles restantes */
  keys: number;
  /** Cartes sur le plateau (IDs) */
  cards: (string | null)[];
  /** Pieces sur chaque carte (index = position) */
  coinsOnCards: number[];
  /** Nombre de cartes retournees */
  flippedCount: number;
  /** Classement (1 = premier) */
  rank: number;
}

/**
 * Donnees d'entrainement pour une partie
 */
export interface TrainingData {
  gameId: string;
  /** Etats successifs du jeu */
  states: TrainingState[];
  /** Resultat final */
  result: SimGameResult;
}

/**
 * Un etat pour l'entrainement
 */
export interface TrainingState {
  /** Numero du tour */
  turn: number;
  /** Index du joueur courant */
  playerIndex: number;
  /** Phase du tour */
  phase: string;
  /** Etat complet (serialise) */
  state: SerializedGameState;
  /** Action choisie */
  action: GameAction;
  /** Score du joueur a ce moment */
  currentScore: number;
}

/**
 * Etat du jeu serialise (sans fonctions/Map)
 */
export interface SerializedGameState {
  turnNumber: number;
  turnPhase: string;
  currentPlayerIndex: number;
  players: SerializedPlayer[];
  board: {
    castleCards: string[];
    villageCards: string[];
    messengerLocation: string;
    castleDeckSize: number;
    villageDeckSize: number;
  };
}

export interface SerializedPlayer {
  id: string;
  name: string;
  isAI: boolean;
  aiLevel?: AILevel;
  gold: number;
  keys: number;
  reductionCastle: number;
  reductionVillage: number;
  board: (string | null)[];
  lockedPositions: number[];
}

/**
 * Statistiques sur plusieurs parties
 */
export interface SimStats {
  totalGames: number;
  /** Victoires par joueur/config */
  winsByPlayer: Map<string, number>;
  /** Score moyen par joueur/config */
  avgScoreByPlayer: Map<string, number>;
  /** Temps moyen par partie */
  avgDurationMs: number;
  /** Nombre moyen de tours */
  avgTurns: number;
}
