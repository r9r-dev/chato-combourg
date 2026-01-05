#!/usr/bin/env npx tsx
/**
 * Compare le scoring entre le calculateur TypeScript et l'API backend
 *
 * Usage:
 *   npx tsx scripts/compare-scoring.ts
 *   npx tsx scripts/compare-scoring.ts --random 10  # 10 plateaux aleatoires
 */

import { calculateScore, Grid } from '../src/services/play/ai/evaluator/scoreCalculator';
import type { PlayCard } from '../src/types/play';

const BACKEND_URL = 'http://localhost:8080';

// Couleurs console
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';

interface APIScoreResponse {
  total_score: number;
  cards_score: number;
  keys_bonus: number;
  details: Array<{
    position: number;
    card_id: string;
    score: number;
    explanation: string;
  }>;
}

// Charger les cartes depuis l'API
async function loadCards(): Promise<Map<string, PlayCard>> {
  const [attributesResponse, effectsResponse] = await Promise.all([
    fetch(`${BACKEND_URL}/api/cards/attributes`),
    fetch(`${BACKEND_URL}/api/cards/effects`),
  ]);

  if (!attributesResponse.ok || !effectsResponse.ok) {
    throw new Error('Backend non disponible');
  }

  const attributes = await attributesResponse.json();
  const effects = await effectsResponse.json();

  const cards = new Map<string, PlayCard>();

  for (const [id, attrs] of Object.entries(attributes)) {
    const attr = attrs as any;
    const effect = (effects as any)[id];

    cards.set(id, {
      id,
      value: attr.value,
      shields: attr.shields,
      category: attr.category,
      has_messenger: effect?.has_messenger ?? false,
      has_price_reduction: attr.has_price_reduction,
      has_lock: attr.has_lock,
      has_coin_purse: attr.has_coin_purse,
      max_coins: attr.max_coins,
      effects: effect?.effects ?? [],
      lock_effect: effect?.lock_effect ?? null,
    });
  }

  return cards;
}

// Appeler l'API backend pour calculer le score
async function calculateScoreAPI(
  cards: string[],
  keys: number,
  coinsOnCards: Record<string, number>
): Promise<APIScoreResponse> {
  const response = await fetch(`${BACKEND_URL}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cards,
      keys,
      coins_on_cards: coinsOnCards,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Generer un plateau aleatoire
function generateRandomBoard(cardList: string[]): string[] {
  const shuffled = [...cardList].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 9);
}

// Comparer les scores
interface ComparisonResult {
  board: string[];
  keys: number;
  coins: Record<string, number>;
  apiScore: number;
  tsScore: number;
  match: boolean;
  apiDetails?: APIScoreResponse['details'];
}

async function compareScores(
  board: string[],
  keys: number,
  coinsOnCards: Record<string, number>,
  cardAttributes: Map<string, PlayCard>
): Promise<ComparisonResult> {
  // Calculer avec l'API
  const apiResult = await calculateScoreAPI(board, keys, coinsOnCards);

  // Calculer avec TypeScript
  const coinsMap = new Map(Object.entries(coinsOnCards));
  const tsResult = calculateScore(board, keys, coinsMap, cardAttributes);

  return {
    board,
    keys,
    coins: coinsOnCards,
    apiScore: apiResult.total_score,
    tsScore: tsResult.totalScore,
    match: apiResult.total_score === tsResult.totalScore,
    apiDetails: apiResult.details,
  };
}

// Afficher les resultats
function printResult(result: ComparisonResult, verbose: boolean = false) {
  const status = result.match
    ? `${GREEN}OK${RESET}`
    : `${RED}MISMATCH${RESET}`;

  console.log(`\n${BOLD}Plateau:${RESET} ${result.board.join(', ')}`);
  console.log(`${BOLD}Cles:${RESET} ${result.keys}`);

  if (Object.keys(result.coins).length > 0) {
    console.log(`${BOLD}Pieces:${RESET} ${JSON.stringify(result.coins)}`);
  }

  console.log(`${BOLD}Score API:${RESET} ${result.apiScore}`);
  console.log(`${BOLD}Score TS:${RESET}  ${result.tsScore}`);
  console.log(`${BOLD}Status:${RESET}   ${status}`);

  if (!result.match && result.apiDetails) {
    console.log(`\n${YELLOW}Details API:${RESET}`);
    for (const detail of result.apiDetails) {
      console.log(`  [${detail.position}] ${detail.card_id}: ${detail.score} pts`);
    }
  }

  if (verbose && result.apiDetails) {
    console.log(`\n${YELLOW}Details par carte:${RESET}`);
    for (const detail of result.apiDetails) {
      console.log(`  [${detail.position}] Carte ${detail.card_id}: ${detail.score} pts`);
      console.log(`       ${detail.explanation.split('\n')[0]}`);
    }
  }
}

// Plateaux de test specifiques
const TEST_BOARDS: Array<{ board: string[]; keys: number; coins: Record<string, number>; name: string }> = [
  {
    name: 'Plateau basique',
    board: ['001', '002', '003', '004', '005', '006', '007', '008', '009'],
    keys: 2,
    coins: {},
  },
  {
    name: 'Avec cles',
    board: ['017', '066', '010', '011', '012', '013', '014', '015', '016'],
    keys: 5,
    coins: {},
  },
  {
    name: 'Avec bourses et pieces',
    board: ['014', '025', '036', '041', '050', '051', '053', '058', '059'],
    keys: 2,
    coins: { '014': 3, '025': 5, '036': 8 },
  },
  {
    name: 'Cartes retournees',
    board: ['089', '090', '001', '002', '003', '004', '005', '006', '007'],
    keys: 4,
    coins: {},
  },
  {
    name: 'Synergies de couleurs',
    board: ['001', '009', '013', '019', '023', '028', '042', '065', '092'],
    keys: 3,
    coins: {},
  },
];

async function main() {
  const args = process.argv.slice(2);
  const randomCount = args.includes('--random')
    ? parseInt(args[args.indexOf('--random') + 1] || '5', 10)
    : 0;
  const verbose = args.includes('-v') || args.includes('--verbose');

  console.log(`${BOLD}=== Comparaison Scoring API vs TypeScript ===${RESET}\n`);

  // Charger les cartes
  console.log('Chargement des cartes...');
  const cardAttributes = await loadCards();
  console.log(`${cardAttributes.size} cartes chargees\n`);

  const results: ComparisonResult[] = [];

  // Tests specifiques
  console.log(`${BOLD}Tests specifiques:${RESET}`);
  for (const test of TEST_BOARDS) {
    console.log(`\n${YELLOW}--- ${test.name} ---${RESET}`);
    const result = await compareScores(test.board, test.keys, test.coins, cardAttributes);
    results.push(result);
    printResult(result, verbose);
  }

  // Tests aleatoires
  if (randomCount > 0) {
    console.log(`\n${BOLD}Tests aleatoires (${randomCount}):${RESET}`);

    const allCardIds = Array.from(cardAttributes.keys()).filter(
      id => id !== '089' && id !== '090' // Exclure cartes retournees
    );

    for (let i = 0; i < randomCount; i++) {
      const board = generateRandomBoard(allCardIds);
      const keys = Math.floor(Math.random() * 6);
      const coins: Record<string, number> = {};

      // Ajouter des pieces sur certaines bourses
      for (const cardId of board) {
        const card = cardAttributes.get(cardId);
        if (card?.has_coin_purse && Math.random() > 0.5) {
          coins[cardId] = Math.floor(Math.random() * (card.max_coins + 1));
        }
      }

      console.log(`\n${YELLOW}--- Test aleatoire ${i + 1} ---${RESET}`);
      const result = await compareScores(board, keys, coins, cardAttributes);
      results.push(result);
      printResult(result, verbose);
    }
  }

  // Resume
  const matches = results.filter(r => r.match).length;
  const mismatches = results.filter(r => !r.match).length;

  console.log(`\n${BOLD}=== Resume ===${RESET}`);
  console.log(`Total: ${results.length} tests`);
  console.log(`${GREEN}OK: ${matches}${RESET}`);
  if (mismatches > 0) {
    console.log(`${RED}Erreurs: ${mismatches}${RESET}`);
    process.exit(1);
  }

  console.log(`\n${GREEN}Tous les tests passent !${RESET}`);
}

main().catch(error => {
  console.error(`${RED}Erreur: ${error.message}${RESET}`);
  process.exit(1);
});
