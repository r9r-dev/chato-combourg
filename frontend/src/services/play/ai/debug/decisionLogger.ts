/**
 * Logger de decisions IA
 *
 * Affiche toutes les possibilites evaluees par l'IA Hard
 * avec les details de ressources avant/apres et les actions necessaires.
 */

import type { PlayPlayer, PlayCard, PlayGameState, Location } from '../../../../types/play';
import { getValidPlacements, getEffectiveCost } from '../../../../types/play';
import {
  evaluateBuyOptions,
  evaluatePlaceOptions,
  type BuyOption,
  type PlaceOption,
} from '../evaluator/deltaCalculator';
import { calculatePlayerScore } from '../evaluator/scoreCalculator';

// =============================================================================
// Types
// =============================================================================

export interface EvaluatedPossibility {
  // Identification
  rank: number;
  cardId: string;
  cardName: string;
  flipped: boolean;
  position: number;

  // Ressources avant
  goldBefore: number;
  keysBefore: number;
  scoreBefore: number;

  // Ressources apres
  goldAfter: number;
  keysAfter: number;
  scoreAfter: number;

  // Delta
  deltaScore: number;
  totalDelta: number;

  // Cout
  cost: number;

  // Actions a executer
  actions: string[];

  // Raisons/explications
  reasoning: string;
}

export interface DecisionLogContext {
  player: PlayPlayer;
  state: PlayGameState;
  availableCards: string[];
  cards: Map<string, PlayCard>;
  turnNumber: number;
}

// =============================================================================
// Noms des cartes (pour affichage lisible)
// =============================================================================

const CARD_NAMES: Record<string, string> = {
  '001': 'Son Altesse',
  '002': 'Imprimeuse',
  '003': 'Duchesse',
  '004': 'Conspirateur',
  '005': 'Pelerin',
  '006': 'Aumonier',
  '007': 'Maitre de guilde',
  '008': 'Souffleur de verre',
  '009': 'Garde royal',
  '010': 'Dame au masque de fer',
  '011': 'Professeur',
  '012': 'Chatelaine',
  '013': 'Prince',
  '014': 'Intendant',
  '015': 'Dramaturge',
  '016': 'Juge',
  '017': 'Templier',
  '018': 'Sa Majeste la reine',
  '019': 'Bouffon',
  '020': 'Banquiere',
  '021': 'Astronome',
  '022': 'Officier',
  '023': 'Chevaleresse',
  '024': 'Architecte',
  '025': 'Doyenne',
  '026': 'Baron',
  '027': 'Generale',
  '028': 'Princesse',
  '029': 'Veilleur',
  '030': 'Orfevre',
  '031': 'Capitaine',
  '032': 'Alchimiste',
  '033': 'Apothicaire',
  '034': 'Flagorneur',
  '035': 'La main du Cardinal',
  '036': 'Fossoyeur',
  '037': 'Nonne',
  '038': 'Sa Saintete',
  '039': 'Mecene',
  '040': 'Preteur sur gages',
  '041': 'Maitre d\'armes',
  '042': 'Scribe',
  '043': 'Milicien',
  '044': 'Devot',
  '045': 'Artificier',
  '046': 'Chanceliere',
  '047': 'Mere superieure',
  '048': 'Cardinale',
  '049': 'Bucheron',
  '050': 'Miraculee',
  '051': 'Cure',
  '052': 'Espion',
  '053': 'Apiculteur',
  '054': 'Mercenaire',
  '055': 'Batard',
  '056': 'Roi des gueux',
  '057': 'Forgeronne',
  '058': 'Aubergiste',
  '059': 'Potier',
  '060': 'Horlogere',
  '061': 'Sculptrice',
  '062': 'Mendiante',
  '063': 'Agricultrice',
  '064': 'Sorciere',
  '065': 'Armuriere',
  '066': 'Serrurier',
  '067': 'Bergere',
  '068': 'Medecin',
  '069': 'Brigand',
  '070': 'Prince des voleurs',
  '071': 'Epiciere',
  '072': 'Barbare',
  '073': 'Tailleuse de pierre',
  '074': 'Usurpateur',
  '075': 'Faussaire',
  '076': 'Vigneron',
  '077': 'Colporteur',
  '078': 'Inventeur',
  '079': 'Tire-laine',
  '080': 'Ecuyer',
  '081': 'Fermiere',
  '082': 'Charpentier',
  '083': 'Philosophe',
  '084': 'Bourreau',
  '085': 'Boulangere',
  '086': 'Voyageuse',
  '087': 'Pecheur',
  '088': 'Voyante',
  '089': 'Carte retournee (village)',
  '090': 'Carte retournee (chateau)',
  '091': 'Revolutionnaire',
  '092': 'Moine',
};

function getCardName(cardId: string): string {
  return CARD_NAMES[cardId] ?? `Carte ${cardId}`;
}

function getPositionName(position: number): string {
  const row = Math.floor(position / 3);
  const col = position % 3;
  const rowNames = ['haut', 'milieu', 'bas'];
  const colNames = ['gauche', 'centre', 'droite'];
  return `${rowNames[row]}-${colNames[col]} (pos ${position})`;
}

// =============================================================================
// Evaluation de toutes les possibilites
// =============================================================================

export function evaluateAllPossibilities(
  context: DecisionLogContext
): EvaluatedPossibility[] {
  const { player, state, availableCards, cards, turnNumber } = context;
  const possibilities: EvaluatedPossibility[] = [];

  // Score et ressources actuels
  const scoreBefore = calculatePlayerScore(player, cards);
  const goldBefore = player.gold;
  const keysBefore = player.keys;

  // Coins sur les cartes du joueur
  const coinsOnCards = new Map<string, number>();
  for (const placed of player.board) {
    if (placed && placed.coinsOnCard > 0) {
      coinsOnCards.set(placed.cardId, placed.coinsOnCard);
    }
  }

  // Obtenir toutes les options d'achat
  const buyOptions = evaluateBuyOptions(
    player,
    availableCards,
    state.board.messengerLocation,
    cards
  );

  // Pour chaque option d'achat
  for (const buyOption of buyOptions) {
    // Determiner l'ID de la carte placee
    const placedCardId = buyOption.flipped
      ? (cards.get(buyOption.cardId)?.category === 'village' ? '089' : '090')
      : buyOption.cardId;

    const card = cards.get(buyOption.cardId);
    if (!card) continue;

    // Ressources apres achat
    const goldAfterBuy = buyOption.flipped
      ? goldBefore + 6
      : goldBefore - buyOption.cost;

    const keysAfterBuy = buyOption.flipped
      ? keysBefore + 2
      : keysBefore;

    // Evaluer les positions de placement
    const placeOptions = evaluatePlaceOptions(
      player,
      placedCardId,
      keysAfterBuy,
      coinsOnCards,
      cards
    );

    // Pour chaque position
    for (const placeOption of placeOptions) {
      // Construire la liste des actions
      const actions: string[] = [];

      // 1. Action d'achat
      if (buyOption.flipped) {
        actions.push(`1. Retourner ${getCardName(buyOption.cardId)} (+6 or, +2 cles)`);
      } else {
        actions.push(`1. Acheter ${getCardName(buyOption.cardId)} (cout: ${buyOption.cost} or)`);
      }

      // 2. Messager si la carte le deplace
      if (card.has_messenger && !buyOption.flipped) {
        const newLocation = state.board.messengerLocation === 'castle' ? 'village' : 'chateau';
        actions.push(`2. Messager se deplace vers ${newLocation}`);
      }

      // 3. Placement
      const placementStep = actions.length + 1;
      actions.push(`${placementStep}. Placer en position ${getPositionName(placeOption.position)}`);

      // 4. Effets de la carte
      if (!buyOption.flipped && card.effects && card.effects.length > 0) {
        const effectStep = actions.length + 1;
        for (const effect of card.effects) {
          const effectDesc = describeEffect(effect);
          if (effectDesc) {
            actions.push(`${effectStep}. Effet: ${effectDesc}`);
          }
        }
      }

      // Score apres placement
      const scoreAfter = scoreBefore + placeOption.deltaScore;

      // Calculer le delta total (inclut bonus economiques)
      let totalDelta = placeOption.deltaScore;

      // Ajustements economiques simplifies
      if (buyOption.flipped) {
        totalDelta -= 5; // Penalite carte retournee
      }

      // Construire la possibilite
      const possibility: EvaluatedPossibility = {
        rank: 0, // Sera rempli apres le tri
        cardId: buyOption.cardId,
        cardName: getCardName(buyOption.cardId),
        flipped: buyOption.flipped,
        position: placeOption.position,

        goldBefore,
        keysBefore,
        scoreBefore,

        goldAfter: goldAfterBuy,
        keysAfter: keysAfterBuy,
        scoreAfter,

        deltaScore: placeOption.deltaScore,
        totalDelta,

        cost: buyOption.cost,
        actions,
        reasoning: buyOption.flipped
          ? `Retourner pour ressources`
          : `Achat normal`,
      };

      possibilities.push(possibility);
    }
  }

  // Trier par delta total decroissant
  possibilities.sort((a, b) => b.totalDelta - a.totalDelta);

  // Assigner les rangs
  possibilities.forEach((p, index) => {
    p.rank = index + 1;
  });

  return possibilities;
}

function describeEffect(effect: any): string | null {
  switch (effect.type) {
    case 'gain_gold':
      return `+${effect.amount} or`;
    case 'gain_keys':
      return `+${effect.amount} cle(s)`;
    case 'gain_gold_per_shield':
      return `+${effect.amount} or par bouclier ${effect.color}`;
    case 'gain_keys_per_shield':
      return `+${effect.amount} cle par bouclier ${effect.color}`;
    case 'gain_gold_per_castle':
      return `+${effect.amount} or par carte chateau`;
    case 'gain_gold_per_village':
      return `+${effect.amount} or par carte village`;
    case 'gain_keys_per_castle':
      return `+${effect.amount} cle par carte chateau`;
    case 'gain_keys_per_village':
      return `+${effect.amount} cle par carte village`;
    case 'reduction_castle':
      return `-1 cout chateaux`;
    case 'reduction_village':
      return `-1 cout villages`;
    case 'reduction_both':
      return `-1 cout tous`;
    case 'fill_purses':
      return `Remplit ${effect.amount} bourses`;
    case 'fill_purses_select':
      return `Remplit ${effect.max_cards} bourses au choix`;
    case 'choice':
      return `Choix entre effets`;
    default:
      return null;
  }
}

// =============================================================================
// Formatage du log
// =============================================================================

function formatPossibility(p: EvaluatedPossibility): string {
  const lines: string[] = [];

  // Header
  const cardDesc = p.flipped
    ? `RETOURNER ${p.cardName}`
    : `Acheter ${p.cardName}`;
  lines.push(`#${p.rank} - ${cardDesc} -> pos ${p.position}`);
  lines.push(`   Delta score: ${p.deltaScore >= 0 ? '+' : ''}${p.deltaScore} pts`);

  // Ressources avant/apres
  lines.push(`   Or:    ${p.goldBefore} -> ${p.goldAfter} (${p.goldAfter >= p.goldBefore ? '+' : ''}${p.goldAfter - p.goldBefore})`);
  lines.push(`   Cles:  ${p.keysBefore} -> ${p.keysAfter} (${p.keysAfter >= p.keysBefore ? '+' : ''}${p.keysAfter - p.keysBefore})`);
  lines.push(`   Score: ${p.scoreBefore} -> ${p.scoreAfter} (${p.scoreAfter >= p.scoreBefore ? '+' : ''}${p.scoreAfter - p.scoreBefore})`);

  // Actions
  lines.push(`   Actions:`);
  for (const action of p.actions) {
    lines.push(`     ${action}`);
  }

  return lines.join('\n');
}

export interface LogOptions {
  showSummary: boolean;
  showTop: number;
  showBottom: number;
  showRandom: number;
}

const DEFAULT_LOG_OPTIONS: LogOptions = {
  showSummary: true,
  showTop: 5,
  showBottom: 5,
  showRandom: 3,
};

// =============================================================================
// Structure JSON complete pour export
// =============================================================================

export interface DecisionLogEntry {
  timestamp: string;
  turnNumber: number;
  playerName: string;
  playerId: string;
  playerState: {
    gold: number;
    keys: number;
    score: number;
    placedCards: number;
    board: (string | null)[];
    reductionCastle: number;
    reductionVillage: number;
  };
  gameState: {
    messengerLocation: 'castle' | 'village';
    availableCards: string[];
    castleCards: string[];
    villageCards: string[];
  };
  totalPossibilities: number;
  possibilities: EvaluatedPossibility[];
  chosenPossibility: EvaluatedPossibility | null;
}

// Stockage global des logs pour cette partie
let currentGameLogs: DecisionLogEntry[] = [];

export function resetGameLogs(): void {
  currentGameLogs = [];
}

export function getGameLogs(): DecisionLogEntry[] {
  return currentGameLogs;
}

export function logAIDecisions(
  context: DecisionLogContext,
  options: Partial<LogOptions> = {}
): EvaluatedPossibility[] {
  const opts = { ...DEFAULT_LOG_OPTIONS, ...options };
  const possibilities = evaluateAllPossibilities(context);

  const { player, state, availableCards, turnNumber, cards } = context;
  const placedCount = player.board.filter(p => p !== null).length;
  const currentScore = calculatePlayerScore(player, cards);

  // Creer l'entree de log complete
  const logEntry: DecisionLogEntry = {
    timestamp: new Date().toISOString(),
    turnNumber,
    playerName: player.name,
    playerId: player.id,
    playerState: {
      gold: player.gold,
      keys: player.keys,
      score: currentScore,
      placedCards: placedCount,
      board: player.board.map(p => p?.cardId ?? null),
      reductionCastle: player.reductionCastle,
      reductionVillage: player.reductionVillage,
    },
    gameState: {
      messengerLocation: state.board.messengerLocation,
      availableCards: [...availableCards],
      castleCards: [...state.board.castleCards],
      villageCards: [...state.board.villageCards],
    },
    totalPossibilities: possibilities.length,
    possibilities: possibilities, // TOUTES les possibilites
    chosenPossibility: possibilities.length > 0 ? possibilities[0] : null,
  };

  // Ajouter au log global
  currentGameLogs.push(logEntry);

  // Header dans le terminal
  console.log('\n' + '='.repeat(70));
  console.log(`IA HARD - Tour ${turnNumber} - ${player.name}`);
  console.log(`Plateau: ${placedCount}/9 cartes | Or: ${player.gold} | Cles: ${player.keys} | Score: ${currentScore}`);
  console.log('='.repeat(70));

  // Summary
  if (opts.showSummary) {
    console.log(`\nTotal possibilites evaluees: ${possibilities.length}`);

    const buyCount = possibilities.filter(p => !p.flipped).length;
    const flipCount = possibilities.filter(p => p.flipped).length;
    console.log(`  - Achats normaux: ${buyCount}`);
    console.log(`  - Retournements: ${flipCount}`);

    if (possibilities.length > 0) {
      const best = possibilities[0];
      const worst = possibilities[possibilities.length - 1];
      console.log(`  - Meilleur delta: ${best.totalDelta >= 0 ? '+' : ''}${best.totalDelta}`);
      console.log(`  - Pire delta: ${worst.totalDelta >= 0 ? '+' : ''}${worst.totalDelta}`);
    }
  }

  // Top N
  if (opts.showTop > 0 && possibilities.length > 0) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`TOP ${Math.min(opts.showTop, possibilities.length)} MEILLEURES OPTIONS:`);
    console.log('─'.repeat(50));

    const top = possibilities.slice(0, opts.showTop);
    for (const p of top) {
      console.log('\n' + formatPossibility(p));
    }
  }

  // Random sample
  if (opts.showRandom > 0 && possibilities.length > opts.showTop + opts.showBottom) {
    const middle = possibilities.slice(
      opts.showTop,
      possibilities.length - opts.showBottom
    );

    if (middle.length > 0) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`ECHANTILLON ALEATOIRE (${Math.min(opts.showRandom, middle.length)} options):`);
      console.log('─'.repeat(50));

      // Selectionner aleatoirement
      const shuffled = [...middle].sort(() => Math.random() - 0.5);
      const sample = shuffled.slice(0, opts.showRandom);

      for (const p of sample) {
        console.log('\n' + formatPossibility(p));
      }
    }
  }

  // Bottom N
  if (opts.showBottom > 0 && possibilities.length > opts.showTop) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`BOTTOM ${Math.min(opts.showBottom, possibilities.length - opts.showTop)} PIRES OPTIONS:`);
    console.log('─'.repeat(50));

    const bottom = possibilities.slice(-opts.showBottom);
    for (const p of bottom) {
      console.log('\n' + formatPossibility(p));
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');

  return possibilities;
}
