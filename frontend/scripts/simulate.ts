#!/usr/bin/env npx tsx
/**
 * CLI pour simuler des parties de Chateau Combo
 *
 * Usage:
 *   npx tsx scripts/simulate.ts easy normal hard     # 3 joueurs IA
 *   npx tsx scripts/simulate.ts normal normal -n 10  # 10 parties
 *   npx tsx scripts/simulate.ts hard hard -v         # Mode verbose
 *   npx tsx scripts/simulate.ts random hard          # Humain aleatoire vs IA
 *
 * Options:
 *   -n, --games <N>     Nombre de parties (defaut: 1)
 *   -v, --verbose       Afficher le detail des tours
 *   -s, --seed <N>      Seed pour reproductibilite
 *   -t, --training      Collecter les donnees d'entrainement
 *   --json              Sortie JSON (pour scripts)
 */

import type { SimConfig, SimPlayerConfig } from '../src/simulation/types';
import { runGame, runMultipleGames, computeStats } from '../src/simulation/runner';
import { loadCards } from '../src/simulation/engine';
import { Grid, RULES, KEYS_RULES } from '../src/services/play/ai/evaluator/scoreCalculator';
import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import terminalImage from 'terminal-image';
import sharp from 'sharp';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Parsing des arguments
// =============================================================================

function parseArgs(): {
  players: SimPlayerConfig[];
  games: number;
  verbose: boolean;
  seed?: number;
  training: boolean;
  json: boolean;
} {
  const args = process.argv.slice(2);
  const players: SimPlayerConfig[] = [];
  let games = 1;
  let verbose = false;
  let seed: number | undefined;
  let training = false;
  let json = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-n' || arg === '--games') {
      games = parseInt(args[++i], 10);
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg === '-s' || arg === '--seed') {
      seed = parseInt(args[++i], 10);
    } else if (arg === '-t' || arg === '--training') {
      training = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      const player = parsePlayer(arg, players.length + 1);
      if (player) {
        players.push(player);
      }
    }
    i++;
  }

  // Defaut: 2 joueurs Normal vs Hard
  if (players.length === 0) {
    players.push({ name: 'IA Normal', type: 'ai', aiLevel: 'normal' });
    players.push({ name: 'IA Hard', type: 'ai', aiLevel: 'hard' });
  }

  if (players.length < 2) {
    console.error(chalk.red('Erreur: Il faut au moins 2 joueurs'));
    process.exit(1);
  }

  if (players.length > 5) {
    console.error(chalk.red('Erreur: Maximum 5 joueurs'));
    process.exit(1);
  }

  return { players, games, verbose, seed, training, json };
}

function parsePlayer(arg: string, index: number): SimPlayerConfig | null {
  const lower = arg.toLowerCase();

  if (lower === 'easy' || lower === 'facile' || lower === 'e') {
    return { name: `IA Facile ${index}`, type: 'ai', aiLevel: 'easy' };
  }
  if (lower === 'normal' || lower === 'moyen' || lower === 'n' || lower === 'm') {
    return { name: `IA Normal ${index}`, type: 'ai', aiLevel: 'normal' };
  }
  if (lower === 'hard' || lower === 'difficile' || lower === 'h' || lower === 'd') {
    return { name: `IA Hard ${index}`, type: 'ai', aiLevel: 'hard' };
  }
  if (lower === 'random' || lower === 'aleatoire' || lower === 'r' || lower === 'humain') {
    return { name: `Humain ${index}`, type: 'human_random' };
  }

  console.error(chalk.yellow(`Joueur inconnu: ${arg}. Utilise: easy, normal, hard, random`));
  return null;
}

function printHelp() {
  console.log(boxen(
    chalk.bold.yellow('Simulateur Chateau Combo'),
    { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
  ));

  console.log(`
${chalk.cyan.bold('Usage:')}
  npx tsx scripts/simulate.ts <joueurs...> [options]

${chalk.cyan.bold('Joueurs:')}
  ${chalk.green('easy, e, facile')}     IA Facile
  ${chalk.blue('normal, n, moyen')}    IA Normale
  ${chalk.magenta('hard, h, difficile')}  IA Difficile
  ${chalk.cyan('random, r, humain')}   Joueur aleatoire

${chalk.cyan.bold('Options:')}
  -n, --games <N>     Nombre de parties (defaut: 1)
  -v, --verbose       Afficher le detail des tours
  -s, --seed <N>      Seed pour reproductibilite
  -t, --training      Collecter les donnees d'entrainement
  --json              Sortie JSON

${chalk.cyan.bold('Exemples:')}
  npx tsx scripts/simulate.ts easy normal hard
  npx tsx scripts/simulate.ts n n h -n 100
  npx tsx scripts/simulate.ts hard hard -v -s 42
`);
}

// =============================================================================
// Helpers
// =============================================================================

function getLevelColor(level: string) {
  switch (level) {
    case 'easy': return chalk.green;
    case 'normal': return chalk.blue;
    case 'hard': return chalk.magenta;
    default: return chalk.cyan;
  }
}

function getLevelName(level: string) {
  switch (level) {
    case 'easy': return 'IA Easy';
    case 'normal': return 'IA Normal';
    case 'hard': return 'IA Hard';
    case 'human': return 'Humain';
    default: return level;
  }
}

function makeBar(value: number, max: number, width: number = 20, filled: string = '█', empty: string = '░'): string {
  const filledCount = Math.round((value / max) * width);
  return filled.repeat(filledCount) + empty.repeat(width - filledCount);
}

function makeColoredBar(pct: number, width: number = 20): string {
  const bar = makeBar(pct, 100, width);
  if (pct >= 70) return chalk.green(bar);
  if (pct >= 50) return chalk.yellow(bar);
  if (pct >= 30) return chalk.hex('#FFA500')(bar); // orange
  return chalk.red(bar);
}

const CARDS_PATH = path.join(__dirname, '../../backend/cards/thumbs');
const CARD_WIDTH = 82;  // Largeur d'une carte en pixels pour l'affichage (+15%)
const CARD_HEIGHT = 115; // Hauteur proportionnelle (+15%)

async function createCoinBadge(coins: number): Promise<Buffer> {
  // Creer un badge rond avec le nombre de pieces (or)
  const size = 24;
  const svg = `
    <svg width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="#d4af37" stroke="#8B7500" stroke-width="2"/>
      <text x="${size/2}" y="${size/2 + 5}" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a2e">${coins}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function createScoreBadge(score: number): Promise<Buffer> {
  // Creer un badge rond avec le score (bleu/vert selon valeur)
  const size = 28;
  const color = score >= 10 ? '#22c55e' : score >= 5 ? '#3b82f6' : score > 0 ? '#6366f1' : '#ef4444';
  const strokeColor = score >= 10 ? '#166534' : score >= 5 ? '#1e40af' : score > 0 ? '#4338ca' : '#991b1b';
  const svg = `
    <svg width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="${color}" stroke="${strokeColor}" stroke-width="2"/>
      <text x="${size/2}" y="${size/2 + 5}" text-anchor="middle" font-size="13" font-weight="bold" fill="white">${score}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Calculer le score individuel de chaque carte
function calculateCardScores(
  cards: (string | null)[],
  keys: number,
  coinsOnCards: number[],
  cardsMap: Map<string, any>
): number[] {
  const cardIds = cards.map(c => c ?? '');
  const coinsMap = new Map<string, number>();

  for (let i = 0; i < cards.length; i++) {
    if (cards[i] && coinsOnCards[i] > 0) {
      coinsMap.set(cards[i]!, coinsOnCards[i]);
    }
  }

  const grid = new Grid(cardIds, coinsMap, cardsMap);
  const scores: number[] = [];

  for (let position = 0; position < 9; position++) {
    const cardId = cardIds[position];
    if (!cardId) {
      scores.push(0);
      continue;
    }

    const rule = RULES[cardId];
    if (rule) {
      if (KEYS_RULES.has(cardId)) {
        scores.push(rule(grid, position, keys));
      } else {
        scores.push(rule(grid, position));
      }
    } else {
      scores.push(0);
    }
  }

  return scores;
}

async function createBoardImage(cards: (string | null)[], coinsOnCards?: number[], cardScores?: number[]): Promise<Buffer | null> {
  try {
    const composites: sharp.OverlayOptions[] = [];

    for (let i = 0; i < 9; i++) {
      const cardId = cards[i];
      const row = Math.floor(i / 3);
      const col = i % 3;

      let cardBuffer: Buffer;

      if (cardId) {
        const cardPath = path.join(CARDS_PATH, `carte_${cardId}.webp`);
        if (existsSync(cardPath)) {
          // Redimensionner la carte
          cardBuffer = await sharp(cardPath)
            .resize(CARD_WIDTH, CARD_HEIGHT)
            .toBuffer();
        } else {
          // Carte non trouvee - creer un placeholder gris
          cardBuffer = await sharp({
            create: { width: CARD_WIDTH, height: CARD_HEIGHT, channels: 3, background: { r: 60, g: 60, b: 60 } }
          }).png().toBuffer();
        }
      } else {
        // Emplacement vide - creer un placeholder sombre
        cardBuffer = await sharp({
          create: { width: CARD_WIDTH, height: CARD_HEIGHT, channels: 3, background: { r: 30, g: 30, b: 30 } }
        }).png().toBuffer();
      }

      const cardLeft = col * (CARD_WIDTH + 4);
      const cardTop = row * (CARD_HEIGHT + 4);

      composites.push({
        input: cardBuffer,
        left: cardLeft,
        top: cardTop,
      });

      // Ajouter badge de score en haut au milieu
      const score = cardScores?.[i] ?? 0;
      if (cardId) {
        const scoreBadge = await createScoreBadge(score);
        composites.push({
          input: scoreBadge,
          left: cardLeft + Math.floor((CARD_WIDTH - 28) / 2),  // Centre horizontal
          top: cardTop + 4,                                      // En haut
        });
      }

      // Ajouter badge de pieces si present (decale vers le bas)
      const coins = coinsOnCards?.[i] ?? 0;
      if (coins > 0) {
        const coinBadge = await createCoinBadge(coins);
        composites.push({
          input: coinBadge,
          left: cardLeft + Math.floor((CARD_WIDTH - 24) / 2),  // Centre horizontal
          top: cardTop + Math.floor(CARD_HEIGHT / 3),          // 1/3 depuis le haut
        });
      }
    }

    // Creer l'image composite
    const totalWidth = 3 * CARD_WIDTH + 2 * 4;
    const totalHeight = 3 * CARD_HEIGHT + 2 * 4;

    const boardImage = await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 3,
        background: { r: 20, g: 20, b: 20 }
      }
    })
      .composite(composites)
      .png()
      .toBuffer();

    return boardImage;
  } catch (error) {
    return null;
  }
}

// Cache global des cartes pour calcul des scores
let globalCardsCache: Map<string, any> | null = null;

async function ensureCardsLoaded(): Promise<Map<string, any>> {
  if (!globalCardsCache) {
    globalCardsCache = await loadCards();
  }
  return globalCardsCache;
}

async function printBoard(cards: (string | null)[], coinsOnCards: number[], title: string, score: number, gold: number, keys: number, saveToFile?: string) {
  // Header
  console.log(boxen(
    chalk.bold(title) + chalk.red(` ${score} pts`) + chalk.dim(` | Or: ${gold} | Cles: ${keys}`),
    { padding: { left: 1, right: 1, top: 0, bottom: 0 }, borderColor: 'red', borderStyle: 'round' }
  ));

  // Calculer les scores individuels de chaque carte
  const cardsMap = await ensureCardsLoaded();
  const cardScores = calculateCardScores(cards, keys, coinsOnCards, cardsMap);

  // Creer l'image composite
  const boardImage = await createBoardImage(cards, coinsOnCards, cardScores);

  // Sauvegarder l'image si demande
  if (boardImage && saveToFile) {
    const { writeFile } = await import('fs/promises');
    await writeFile(saveToFile, boardImage);
    console.log(chalk.dim(`  Image sauvegardee: ${saveToFile}`));
  }

  // Essayer d'afficher l'image dans le terminal
  if (boardImage && process.stdout.isTTY) {
    try {
      const imageStr = await terminalImage.buffer(boardImage, { width: 58, height: 35 });
      console.log(imageStr);
    } catch {
      // Fallback si echec
    }
  }

  // Toujours afficher les IDs en dessous pour reference
  const boardTable = new Table({
    style: { head: [], border: ['gray'] },
    colWidths: [14, 14, 14],
    colAligns: ['center', 'center', 'center'],
  });

  for (let row = 0; row < 3; row++) {
    const rowCards = [];
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const cardId = cards[idx];
      const coins = coinsOnCards[idx] || 0;
      const cardScore = cardScores[idx] || 0;

      let cellContent: string;
      if (cardId) {
        // ID de la carte
        if (cardId === '089' || cardId === '090') {
          cellContent = chalk.dim.strikethrough(cardId);
        } else if (parseInt(cardId) <= 46) {
          cellContent = chalk.blue(cardId);
        } else {
          cellContent = chalk.green(cardId);
        }

        // Score de la carte
        const scoreColor = cardScore >= 10 ? chalk.green : cardScore >= 5 ? chalk.cyan : cardScore > 0 ? chalk.white : chalk.red;
        cellContent += scoreColor(` [${cardScore}]`);

        // Pieces si presentes
        if (coins > 0) {
          cellContent += chalk.yellow(` +${coins}`);
        }
      } else {
        cellContent = chalk.dim('---');
      }
      rowCards.push(cellContent);
    }
    boardTable.push(rowCards);
  }
  console.log(boardTable.toString());
}

// =============================================================================
// Affichage
// =============================================================================

function printGameResult(result: any) {
  console.log(boxen(
    chalk.bold(`Resultats`) + chalk.dim(` (${result.turns} tours, ${result.durationMs}ms)`),
    { padding: { left: 1, right: 1, top: 0, bottom: 0 }, borderColor: 'gray', borderStyle: 'round' }
  ));

  const table = new Table({
    head: ['', 'Joueur', 'Score', 'Or', 'Cles'].map(h => chalk.bold(h)),
    style: { head: [], border: ['gray'] },
  });

  for (const player of result.players) {
    const medal = player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : '  ';
    const color = player.rank === 1 ? chalk.yellow.bold : chalk.white;
    const flipped = player.flippedCount > 0 ? chalk.dim(` (${player.flippedCount} ret.)`) : '';

    table.push([
      medal,
      color(player.name) + flipped,
      color(`${player.score} pts`),
      chalk.yellow(player.gold),
      chalk.cyan(player.keys),
    ]);
  }

  console.log(table.toString());
}

async function printStats(stats: any, results?: any[]) {
  // Header
  console.log('\n' + boxen(
    chalk.bold.yellow('RAPPORT DE SIMULATION'),
    { padding: 1, borderColor: 'yellow', borderStyle: 'double' }
  ));

  // Resume
  const summaryTable = new Table({
    style: { head: [], border: ['gray'] },
  });
  summaryTable.push(
    [chalk.bold('Parties jouees'), chalk.cyan(stats.totalGames)],
    [chalk.bold('Duree moyenne'), chalk.dim(`${stats.avgDurationMs}ms`)],
    [chalk.bold('Tours moyens'), chalk.dim(stats.avgTurns)],
  );
  console.log(summaryTable.toString());

  // Victoires
  console.log('\n' + chalk.bold.underline('Victoires'));
  const winsTable = new Table({
    head: ['Joueur', 'Victoires', '%', ''].map(h => chalk.bold(h)),
    style: { head: [], border: ['gray'] },
    colWidths: [20, 12, 10, 25],
  });

  const sortedWins = Object.entries(stats.winsByPlayer)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  for (const [player, wins] of sortedWins) {
    const pct = (wins as number) / stats.totalGames * 100;
    const level = player.includes('hard') ? 'hard' : player.includes('normal') ? 'normal' : player.includes('easy') ? 'easy' : 'human';
    const color = getLevelColor(level);

    winsTable.push([
      color(player),
      String(wins),
      `${pct.toFixed(1)}%`,
      makeColoredBar(pct),
    ]);
  }
  console.log(winsTable.toString());

  // Distribution par niveau d'IA
  if (results && results.length > 0) {
    const scoresByLevel: Record<string, number[]> = {};
    const worstByLevel: Record<string, { score: number; cards: (string | null)[]; coinsOnCards: number[]; gold: number; keys: number }> = {};

    for (const result of results) {
      for (const player of result.players) {
        const level = player.aiLevel ?? 'human';
        if (!scoresByLevel[level]) {
          scoresByLevel[level] = [];
        }
        scoresByLevel[level].push(player.score);

        // Tracker le pire score pour ce niveau
        if (!worstByLevel[level] || player.score < worstByLevel[level].score) {
          worstByLevel[level] = {
            score: player.score,
            cards: player.cards,
            coinsOnCards: player.coinsOnCards,
            gold: player.gold,
            keys: player.keys,
          };
        }
      }
    }

    // Trier les niveaux: easy, normal, hard, human
    const levelOrder = ['easy', 'normal', 'hard', 'human'];
    const levels = Object.keys(scoresByLevel).sort((a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b));

    for (const level of levels) {
      const scores = scoresByLevel[level];
      scores.sort((a: number, b: number) => a - b);

      const total = scores.length;
      const min = scores[0];
      const max = scores[scores.length - 1];
      const median = scores[Math.floor(total / 2)];
      const mean = Math.round(scores.reduce((a, b) => a + b, 0) / total);

      const under40 = scores.filter(s => s < 40).length;
      const under50 = scores.filter(s => s < 50).length;
      const under60 = scores.filter(s => s < 60).length;
      const over70 = scores.filter(s => s >= 70).length;
      const over80 = scores.filter(s => s >= 80).length;

      const p10 = scores[Math.floor(total * 0.1)];
      const p25 = scores[Math.floor(total * 0.25)];
      const p75 = scores[Math.floor(total * 0.75)];
      const p90 = scores[Math.floor(total * 0.9)];

      const color = getLevelColor(level);
      const levelName = getLevelName(level);

      // Box pour ce niveau
      console.log('\n' + boxen(
        color.bold(levelName) + chalk.dim(` (${total} scores)`),
        { padding: { left: 1, right: 1, top: 0, bottom: 0 }, borderColor: level === 'hard' ? 'magenta' : level === 'normal' ? 'blue' : level === 'easy' ? 'green' : 'cyan', borderStyle: 'round' }
      ));

      // Stats de base
      const statsTable = new Table({
        style: { head: [], border: ['gray'] },
        colWidths: [12, 12, 12, 12],
      });
      statsTable.push(
        [chalk.dim('Min'), chalk.dim('Max'), chalk.dim('Mediane'), chalk.dim('Moyenne')],
        [
          chalk.red(min),
          chalk.green(max),
          chalk.yellow(median),
          chalk.bold.white(mean),
        ],
      );
      console.log(statsTable.toString());

      // Distribution
      const distTable = new Table({
        head: ['Plage', '%', 'Barre', 'Nb'].map(h => chalk.bold(h)),
        style: { head: [], border: ['gray'] },
        colWidths: [12, 10, 25, 8],
      });

      const addDistRow = (label: string, count: number, barColor: typeof chalk.red) => {
        const pct = (count / total * 100);
        distTable.push([
          label,
          `${pct.toFixed(1)}%`,
          barColor(makeBar(pct, 100, 20)),
          chalk.dim(String(count)),
        ]);
      };

      addDistRow('< 40 pts', under40, chalk.red);
      addDistRow('< 50 pts', under50, chalk.hex('#FFA500'));
      addDistRow('< 60 pts', under60, chalk.yellow);
      addDistRow('>= 70 pts', over70, chalk.green);
      addDistRow('>= 80 pts', over80, chalk.cyan);

      console.log(distTable.toString());

      // Percentiles
      console.log(chalk.dim(`  Percentiles: P10=${p10} | P25=${p25} | P50=${median} | P75=${p75} | P90=${p90}`));

      // Afficher le pire board pour ce niveau
      const worst = worstByLevel[level];
      if (worst) {
        console.log('');
        await printBoard(
          worst.cards,
          worst.coinsOnCards,
          `Pire ${levelName}`,
          worst.score,
          worst.gold,
          worst.keys
        );
      }
    }
  }

  // Footer
  console.log('\n' + chalk.dim('─'.repeat(60)));
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const { players, games, verbose, seed, training, json } = parseArgs();

  if (!json) {
    console.log('\n' + boxen(
      chalk.bold.yellow('SIMULATION CHATEAU COMBO'),
      { padding: 1, borderColor: 'yellow', borderStyle: 'double' }
    ));

    // Config table
    const configTable = new Table({
      style: { head: [], border: ['gray'] },
    });

    players.forEach((p, i) => {
      const color = getLevelColor(p.aiLevel ?? 'human');
      configTable.push([chalk.dim(`Joueur ${i + 1}`), color(p.name)]);
    });

    configTable.push(
      [chalk.dim('Parties'), chalk.cyan(games)],
    );
    if (seed !== undefined) configTable.push([chalk.dim('Seed'), chalk.dim(seed)]);
    if (verbose) configTable.push([chalk.dim('Mode'), chalk.yellow('Verbose')]);
    if (training) configTable.push([chalk.dim('Training'), chalk.green('Actif')]);

    console.log(configTable.toString());
  }

  const config: SimConfig = {
    players,
    seed,
    verbose,
    collectTrainingData: training,
  };

  try {
    if (games === 1) {
      if (!json) console.log(chalk.dim('\nSimulation en cours...'));

      const { result, trainingData, decisionLogs } = await runGame(config);

      if (json) {
        console.log(JSON.stringify({ result, trainingData, decisionLogs }, null, 2));
      } else {
        printGameResult(result);

        if (trainingData) {
          console.log(chalk.dim(`\nDonnees d'entrainement: ${trainingData.states.length} etats collectes`));
        }

        // Sauvegarder les logs de decisions en JSON si verbose
        if (verbose && decisionLogs && decisionLogs.length > 0) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const logFilename = `ai-decisions-${timestamp}.json`;
          const logPath = path.join(__dirname, '..', logFilename);

          await writeFile(logPath, JSON.stringify(decisionLogs, null, 2));
          console.log(chalk.green(`\nLogs IA sauvegardes: ${logFilename}`));
          console.log(chalk.dim(`  ${decisionLogs.length} decisions enregistrees`));
          console.log(chalk.dim(`  Chemin: ${logPath}`));
        }
      }
    } else {
      if (!json) {
        process.stdout.write(chalk.dim('\nSimulation: '));
      }

      const results = await runMultipleGames(
        config,
        games,
        'http://localhost:8080',
        json ? undefined : (current, total) => {
          const pct = Math.round((current / total) * 100);
          const bar = makeBar(current, total, 30, '█', '░');
          process.stdout.write(`\r${chalk.dim('Simulation:')} ${chalk.cyan(bar)} ${chalk.bold(`${pct}%`)} ${chalk.dim(`(${current}/${total})`)}`);
        }
      );

      if (!json) {
        process.stdout.write('\r' + ' '.repeat(70) + '\r');
      }

      if (json) {
        const stats = computeStats(results);
        console.log(JSON.stringify({ results, stats }, null, 2));
      } else {
        const stats = computeStats(results);
        await printStats(stats, results);
      }
    }
  } catch (error: any) {
    if (json) {
      console.log(JSON.stringify({ error: error.message }));
    } else {
      console.error('\n' + boxen(
        chalk.red.bold('Erreur: ') + chalk.red(error.message),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      ));
      if (error.message.includes('Backend')) {
        console.error(chalk.dim('Lancez le backend: cd backend && python -m uvicorn app.main:app --port 8080'));
      }
    }
    process.exit(1);
  }
}

main();
