/**
 * Types pour le systeme d'IA du mode Play
 *
 * Ce fichier definit les structures de donnees internes a l'IA :
 * - AIContext : Vue enrichie de l'etat pour la prise de decision
 * - ActionNode : Noeud de l'arbre de decisions
 * - Personality : Biais pour l'IA normale
 */

import type {
  PlayGameState,
  PlayPlayer,
  PlayCard,
  PlacedCard,
  CentralBoard,
  GameAction,
  TurnPhase,
  Location,
  ShieldColor,
  AILevel,
  CardEffect,
} from '../../../types/play';

// =============================================================================
// Contexte IA
// =============================================================================

/**
 * Contexte enrichi fourni a l'IA pour la prise de decision
 *
 * Regroupe toutes les informations necessaires et des helpers pre-calcules.
 */
export interface AIContext {
  // ===========================================
  // Etat du jeu
  // ===========================================
  turnNumber: number;                // 1-9
  turnPhase: TurnPhase;
  keyUsedThisTurn: boolean;
  lockUsedThisTurn: boolean;
  purchasedCard: string | null;
  isSimulation: boolean;

  // ===========================================
  // Joueurs
  // ===========================================
  me: PlayPlayer;                    // Le joueur IA courant
  players: PlayPlayer[];             // Tous les joueurs
  opponents: PlayPlayer[];           // Adversaires (players sans me)

  // ===========================================
  // Plateau central
  // ===========================================
  board: CentralBoard;

  // ===========================================
  // Helpers pre-calcules
  // ===========================================
  messengerCards: string[];          // Cartes du lieu du messager (3 IDs)
  otherLocationCards: string[];      // Cartes de l'autre lieu (3 IDs)
  affordableCards: string[];         // Cartes que me peut acheter (assez d'or)
  cards: Map<string, PlayCard>;      // Reference: attributs de toutes les cartes

  // ===========================================
  // Probabilites pour le refresh
  // ===========================================
  deckProbabilities: {
    castle: Map<string, number>;     // cardId -> probabilite (0-1)
    village: Map<string, number>;
  };
}

// =============================================================================
// Arbre de decisions
// =============================================================================

/**
 * Consequences d'une action
 */
export interface ActionConsequences {
  scoreDelta: number;                // Mon score apres - avant
  goldDelta: number;                 // Or apres - avant
  keysDelta: number;                 // Cles apres - avant

  // Impact sur les adversaires (deny)
  opponentImpact: Map<string, {
    potentialScoreLost: number;      // Score qu'ils auraient pu faire
    stolenCard: string | null;       // Carte qu'ils voulaient
  }>;
}

/**
 * Noeud dans l'arbre de decisions
 */
export interface ActionNode {
  // Identification
  id: string;
  depth: number;

  // Action
  action: GameAction | null;         // null pour le noeud racine
  description: string;

  // Contexte
  contextBefore: AIContext;
  contextAfter: AIContext;

  // Consequences
  consequences: ActionConsequences;

  // Arbre
  children: ActionNode[];
  isTerminal: boolean;               // true = fin du tour

  // Evaluation (rempli par l'algorithme)
  score?: number;
  visits?: number;                   // Pour MCTS
}

/**
 * Arbre complet pour un tour
 */
export interface ActionTree {
  root: ActionNode;
  playerId: string;
  turnNumber: number;
  totalNodes: number;
  maxDepth: number;
}

// =============================================================================
// Scenarios de placement
// =============================================================================

/**
 * Un scenario de placement represente une configuration possible
 * du plateau apres le placement d'une carte.
 */
export interface PlacementScenario {
  id: number;
  position: number;                  // Position finale (0-8)
  boardAfter: (PlacedCard | null)[]; // Configuration apres placement
  scoreAfter: number;                // Score avec cette configuration
  adjacentCards: string[];           // IDs des cartes adjacentes
  requiresShift: boolean;            // Si un decalage est necessaire
  shiftDirection?: 'left' | 'right' | 'up' | 'down';
}

// =============================================================================
// Personnalites (IA Normale)
// =============================================================================

/**
 * Personnalite de l'IA normale
 *
 * Chaque personnalite a des preferences strategiques qui biaisent ses choix.
 */
export interface Personality {
  name: string;
  description: string;

  /**
   * Calcule un bonus/malus pour une action selon la personnalite
   * @param node Noeud a evaluer
   * @param context Contexte initial
   * @returns Nombre positif (preference) ou negatif (aversion)
   */
  evaluateBias(node: ActionNode, context: AIContext): number;
}

/**
 * Noms des personnalites disponibles
 */
export type PersonalityName =
  | 'banker'      // Le Banquier - aime les bourses
  | 'guardian'    // Le Gardien - garde ses cles
  | 'rainbow'     // L'Arc-en-ciel - veut toutes les couleurs
  | 'specialist'  // Le Specialiste - peu de couleurs, beaucoup de boucliers
  | 'merchant'    // Le Marchand - accumule les reductions
  | 'builder'     // Le Batisseur - cartes de positionnement
  | 'collector'   // Le Collectionneur - maximise une categorie
  | 'locksmith';  // Le Serrurier - aime les cadenas

// =============================================================================
// Configuration IA
// =============================================================================

/**
 * Configuration pour l'IA Facile
 */
export interface EasyAIConfig {
  randomFromTopN: number;            // Choisir parmi les top N (3-5)
  skipKeyProbability: number;        // Probabilite d'ignorer les cles (0-1)
  skipLockProbability: number;       // Probabilite d'ignorer les cadenas (0-1)
  ignoreOpponents: boolean;          // Ignorer les scores adversaires
  preferSimpleCards: boolean;        // Preferer les cartes sans effet complexe
}

/**
 * Configuration pour l'IA Difficile
 */
export interface HardAIConfig {
  maxIterations: number;             // Iterations MCTS max
  maxTimeMs: number;                 // Temps max en ms
  explorationConstant: number;       // Constante UCB1 (sqrt(2) par defaut)
}

/**
 * Configuration pour le simulateur
 */
export interface SimulatorConfig {
  maxDepth: number;                  // Profondeur max de simulation
  cacheEnabled: boolean;             // Activer le cache de scores
}

// =============================================================================
// Resultats d'evaluation
// =============================================================================

/**
 * Resultat de l'evaluation d'une action
 */
export interface ActionEvaluation {
  action: GameAction;
  score: number;
  description: string;
  breakdown?: {
    baseScore: number;
    bonuses: { reason: string; value: number }[];
    penalties: { reason: string; value: number }[];
  };
}

/**
 * Resultat de l'evaluation d'un placement
 */
export interface PlacementEvaluation {
  position: number;
  score: number;
  adjacentBonuses: number;
  lineBonuses: number;
  futurePotential: number;
}

// =============================================================================
// Options de choix d'effet
// =============================================================================

/**
 * Option d'effet evaluee par l'IA
 */
export interface EvaluatedEffectOption {
  index: number;
  description: string;
  goldAfter: number;
  keysAfter: number;
  estimatedValue: number;            // Valeur estimee de l'option
}

/**
 * Carte evaluee pour la defausse
 */
export interface EvaluatedDiscardCard {
  cardId: string;
  resourceGain: { type: 'gold' | 'keys'; amount: number };
  usefulForOpponent: boolean;
  opponentScoreLoss: Map<string, number>;
  recommendation: number;            // Score de recommandation (plus haut = mieux)
}

// =============================================================================
// Export types from play.ts for convenience
// =============================================================================

export type {
  PlayGameState,
  PlayPlayer,
  PlayCard,
  PlacedCard,
  CentralBoard,
  GameAction,
  TurnPhase,
  Location,
  ShieldColor,
  AILevel,
  CardEffect,
};
