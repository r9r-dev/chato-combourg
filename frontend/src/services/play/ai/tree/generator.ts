/**
 * Genere l'arbre d'actions possibles
 */

import type { GameAction, PlayCard } from '../../../../types/play';
import type { AIContext, ActionNode, ActionTree, ActionConsequences } from '../types';
import { getValidPlacements, getExternalZones, getEffectiveCost } from '../../../../types/play';
import { buildContext } from '../context/builder';
import { cloneState } from '../simulator/clone';
import { executeSimulatedAction } from '../simulator/executor';

let nodeIdCounter = 0;

/**
 * Construit l'arbre complet des actions possibles
 */
export function buildActionTree(
  context: AIContext,
  maxDepth: number = 10
): ActionTree {
  nodeIdCounter = 0;

  const root = createRootNode(context);
  expandNode(root, context.cards, maxDepth);

  return {
    root,
    playerId: context.me.id,
    turnNumber: context.turnNumber,
    totalNodes: countNodes(root),
    maxDepth: getMaxDepth(root),
  };
}

/**
 * Cree le noeud racine
 */
function createRootNode(context: AIContext): ActionNode {
  return {
    id: `node-${nodeIdCounter++}`,
    depth: 0,
    action: null,
    description: 'Debut du tour',
    contextBefore: context,
    contextAfter: context,
    consequences: createEmptyConsequences(),
    children: [],
    isTerminal: false,
  };
}

/**
 * Expanse un noeud (genere ses enfants)
 */
function expandNode(
  node: ActionNode,
  cards: Map<string, PlayCard>,
  maxDepth: number
): void {
  if (node.depth >= maxDepth || node.isTerminal) return;

  const actions = generateActions(node.contextAfter, cards);

  for (const action of actions) {
    const child = createChildNode(node, action, cards);
    node.children.push(child);

    // Recursion
    expandNode(child, cards, maxDepth);
  }
}

/**
 * Genere les actions possibles depuis un contexte
 */
export function generateActions(
  context: AIContext,
  cards: Map<string, PlayCard>
): GameAction[] {
  const actions: GameAction[] = [];
  const player = context.me;

  switch (context.turnPhase) {
    case 'pre_action':
      // Actions de cle (si disponible)
      if (player.keys > 0 && !context.keyUsedThisTurn) {
        // Deplacer le messager
        const otherLocation = context.board.messengerLocation === 'castle' ? 'village' : 'castle';
        actions.push({
          type: 'spend_key',
          playerId: player.id,
          targetLocation: otherLocation,
        });

        // Rafraichir village
        actions.push({
          type: 'spend_key',
          playerId: player.id,
          targetLocation: 'village',
        });

        // Rafraichir chateau
        actions.push({
          type: 'spend_key',
          playerId: player.id,
          targetLocation: 'castle',
        });
      }

      // Ouvrir un cadenas
      if (player.keys > 0 && !context.lockUsedThisTurn) {
        for (const [position, hasKey] of player.lockedCards) {
          if (hasKey) {
            actions.push({
              type: 'use_key_on_lock',
              playerId: player.id,
              lockPosition: position,
            });
          }
        }
      }

      // Acheter une carte
      for (const cardId of context.messengerCards) {
        const card = cards.get(cardId);
        if (!card) continue;

        const cost = getEffectiveCost(
          card.value,
          card.category,
          player.reductionCastle,
          player.reductionVillage
        );

        if (player.gold >= cost) {
          actions.push({
            type: 'buy_card',
            playerId: player.id,
            cardId,
          });
        }

        // Achat face cachee (toujours possible)
        actions.push({
          type: 'buy_card_flipped',
          playerId: player.id,
          cardId,
        });
      }
      break;

    case 'buy':
      // Meme logique que pre_action pour l'achat
      for (const cardId of context.messengerCards) {
        const card = cards.get(cardId);
        if (!card) continue;

        const cost = getEffectiveCost(
          card.value,
          card.category,
          player.reductionCastle,
          player.reductionVillage
        );

        if (player.gold >= cost) {
          actions.push({
            type: 'buy_card',
            playerId: player.id,
            cardId,
          });
        }

        actions.push({
          type: 'buy_card_flipped',
          playerId: player.id,
          cardId,
        });
      }
      break;

    case 'place':
      // Placer la carte achetee
      if (context.purchasedCard) {
        // Positions internes (adjacentes aux cartes existantes)
        const validPositions = getValidPlacements(player.board);
        for (const position of validPositions) {
          actions.push({
            type: 'place_card',
            playerId: player.id,
            cardId: context.purchasedCard,
            position,
          });
        }

        // Zones externes (placement avec shift automatique)
        const externalZones = getExternalZones(player.board);
        for (const zone of externalZones) {
          actions.push({
            type: 'place_card',
            playerId: player.id,
            cardId: context.purchasedCard,
            position: zone.position,
            shiftDirection: zone.shiftDirection,
          });
        }
      }
      break;

    case 'post_action':
      // Ouvrir un cadenas
      if (player.keys > 0 && !context.lockUsedThisTurn) {
        for (const [position, hasKey] of player.lockedCards) {
          if (hasKey) {
            actions.push({
              type: 'use_key_on_lock',
              playerId: player.id,
              lockPosition: position,
            });
          }
        }
      }

      // Fin de tour
      actions.push({
        type: 'end_turn',
        playerId: player.id,
      });
      break;

    case 'end':
      // Pas d'action possible
      break;
  }

  return actions;
}

/**
 * Cree un noeud enfant a partir d'une action
 */
function createChildNode(
  parent: ActionNode,
  action: GameAction,
  cards: Map<string, PlayCard>
): ActionNode {
  // Simuler l'action pour obtenir le nouvel etat
  const stateBefore = contextToState(parent.contextAfter);
  const stateAfter = executeSimulatedAction(cloneState(stateBefore), action);
  const contextAfter = buildContext(stateAfter, action.playerId, cards, true);

  // Calculer les consequences
  const consequences = calculateConsequences(parent.contextAfter, contextAfter);

  // Determiner si c'est un noeud terminal
  const isTerminal = action.type === 'end_turn' || stateAfter.phase === 'ended';

  return {
    id: `node-${nodeIdCounter++}`,
    depth: parent.depth + 1,
    action,
    description: describeAction(action, cards),
    contextBefore: parent.contextAfter,
    contextAfter,
    consequences,
    children: [],
    isTerminal,
  };
}

/**
 * Convertit un contexte en etat (pour la simulation)
 */
function contextToState(context: AIContext): any {
  // TODO: Implementer correctement
  // Pour l'instant, on utilise une structure minimale
  return {
    players: context.players,
    currentPlayerIndex: context.players.findIndex(p => p.id === context.me.id),
    turnNumber: context.turnNumber,
    turnPhase: context.turnPhase,
    keyUsedThisTurn: context.keyUsedThisTurn,
    lockUsedThisTurn: context.lockUsedThisTurn,
    purchasedCard: context.purchasedCard,
    purchasedCardCost: 0,
    board: context.board,
    actionHistory: [],
    phase: 'playing' as const,
    gameId: 'simulation',
  };
}

/**
 * Calcule les consequences d'une action
 */
function calculateConsequences(
  before: AIContext,
  after: AIContext
): ActionConsequences {
  return {
    scoreDelta: 0, // TODO: Calculer
    goldDelta: after.me.gold - before.me.gold,
    keysDelta: after.me.keys - before.me.keys,
    opponentImpact: new Map(),
  };
}

/**
 * Decrit une action en texte
 */
function describeAction(action: GameAction, cards: Map<string, PlayCard>): string {
  switch (action.type) {
    case 'buy_card':
      return `Acheter ${cards.get(action.cardId!)?.id ?? action.cardId}`;
    case 'buy_card_flipped':
      return `Acheter face cachee`;
    case 'place_card':
      return `Placer en position ${action.position}`;
    case 'spend_key':
      return `Utiliser cle sur ${action.targetLocation}`;
    case 'use_key_on_lock':
      return `Ouvrir cadenas position ${action.lockPosition}`;
    case 'end_turn':
      return 'Fin du tour';
    default:
      return action.type;
  }
}

/**
 * Cree des consequences vides
 */
function createEmptyConsequences(): ActionConsequences {
  return {
    scoreDelta: 0,
    goldDelta: 0,
    keysDelta: 0,
    opponentImpact: new Map(),
  };
}

/**
 * Compte le nombre total de noeuds
 */
function countNodes(node: ActionNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

/**
 * Retourne la profondeur maximale de l'arbre
 */
function getMaxDepth(node: ActionNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(getMaxDepth));
}
