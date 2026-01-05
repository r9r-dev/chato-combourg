#!/usr/bin/env npx tsx
/**
 * Benchmark de l'IA Hard
 *
 * Execute 1000 parties pour chaque configuration (2, 3, 4, 5 joueurs)
 * et produit des statistiques detaillees.
 *
 * Usage:
 *   npx tsx scripts/benchmark-hard-ai.ts
 *   npx tsx scripts/benchmark-hard-ai.ts --games 500
 *   npx tsx scripts/benchmark-hard-ai.ts --output results.json
 */

import type { SimConfig, SimPlayerConfig, SimGameResult } from '../src/simulation/types';
import { runMultipleGames, computeStats } from '../src/simulation/runner';
import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import { writeFileSync } from 'fs';

// =============================================================================
// Configuration
// =============================================================================

interface BenchmarkConfig {
  gamesPerConfig: number;
  outputFile?: string;
  verbose: boolean;
}

function parseArgs(): BenchmarkConfig {
  const args = process.argv.slice(2);
  let gamesPerConfig = 1000;
  let outputFile: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--games' || args[i] === '-n') {
      gamesPerConfig = parseInt(args[++i], 10);
    } else if (args[i] === '--output' || args[i] === '-o') {
      outputFile = args[++i];
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  return { gamesPerConfig, outputFile, verbose };
}

// =============================================================================
// Configurations de test
// =============================================================================

function createConfigs(): { name: string; players: SimPlayerConfig[] }[] {
  return [
    {
      name: '2 joueurs (Hard vs Hard)',
      players: [
        { name: 'Hard 1', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 2', type: 'ai', aiLevel: 'hard' },
      ],
    },
    {
      name: '3 joueurs (Hard x3)',
      players: [
        { name: 'Hard 1', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 2', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 3', type: 'ai', aiLevel: 'hard' },
      ],
    },
    {
      name: '4 joueurs (Hard x4)',
      players: [
        { name: 'Hard 1', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 2', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 3', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 4', type: 'ai', aiLevel: 'hard' },
      ],
    },
    {
      name: '5 joueurs (Hard x5)',
      players: [
        { name: 'Hard 1', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 2', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 3', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 4', type: 'ai', aiLevel: 'hard' },
        { name: 'Hard 5', type: 'ai', aiLevel: 'hard' },
      ],
    },
  ];
}

// =============================================================================
// Analyse des resultats
// =============================================================================

interface DetailedStats {
  configName: string;
  playerCount: number;
  totalGames: number;
  totalScores: number[];

  // Score stats
  minScore: number;
  maxScore: number;
  avgScore: number;
  medianScore: number;
  stdDev: number;

  // Percentiles
  p10: number;
  p25: number;
  p75: number;
  p90: number;

  // Distribution
  under40: number;
  under50: number;
  under60: number;
  over70: number;
  over80: number;

  // Problemes detectes
  emptyPursesCount: number;  // Parties avec bourses vides
  lowScoreCount: number;     // Parties avec score < 40
  flippedCardsCount: number; // Parties avec cartes retournees

  // Timing
  avgDurationMs: number;
}

function analyzeResults(configName: string, results: SimGameResult[]): DetailedStats {
  const allScores: number[] = [];
  let emptyPursesCount = 0;
  let flippedCardsCount = 0;
  let totalDuration = 0;

  for (const result of results) {
    totalDuration += result.durationMs;

    for (const player of result.players) {
      allScores.push(player.score);

      // Detecter bourses vides
      const hasEmptyPurse = player.coinsOnCards.some((coins, i) => {
        // Une bourse est vide si la carte a une bourse et coins = 0
        // On ne peut pas savoir ici si c'est une carte bourse, donc on compte les 0
        return coins === 0;
      });

      // Compter les cartes retournees
      if (player.flippedCount > 0) {
        flippedCardsCount++;
      }
    }
  }

  // Trier pour les stats
  allScores.sort((a, b) => a - b);
  const n = allScores.length;

  // Calculs statistiques
  const sum = allScores.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const median = allScores[Math.floor(n / 2)];

  // Ecart-type
  const variance = allScores.reduce((acc, score) => acc + Math.pow(score - avg, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    configName,
    playerCount: results[0]?.players.length ?? 0,
    totalGames: results.length,
    totalScores: allScores,

    minScore: allScores[0],
    maxScore: allScores[n - 1],
    avgScore: Math.round(avg * 10) / 10,
    medianScore: median,
    stdDev: Math.round(stdDev * 10) / 10,

    p10: allScores[Math.floor(n * 0.1)],
    p25: allScores[Math.floor(n * 0.25)],
    p75: allScores[Math.floor(n * 0.75)],
    p90: allScores[Math.floor(n * 0.9)],

    under40: allScores.filter(s => s < 40).length,
    under50: allScores.filter(s => s < 50).length,
    under60: allScores.filter(s => s < 60).length,
    over70: allScores.filter(s => s >= 70).length,
    over80: allScores.filter(s => s >= 80).length,

    emptyPursesCount,
    lowScoreCount: allScores.filter(s => s < 40).length,
    flippedCardsCount,

    avgDurationMs: Math.round(totalDuration / results.length),
  };
}

// =============================================================================
// Affichage
// =============================================================================

function makeBar(value: number, max: number, width: number = 20): string {
  const filled = Math.round((value / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function printDetailedStats(stats: DetailedStats) {
  console.log('\n' + boxen(
    chalk.bold.magenta(stats.configName) + chalk.dim(` | ${stats.totalGames} parties | ${stats.totalScores.length} scores`),
    { padding: { left: 1, right: 1, top: 0, bottom: 0 }, borderColor: 'magenta', borderStyle: 'round' }
  ));

  // Stats de base
  const baseTable = new Table({
    style: { head: [], border: ['gray'] },
  });

  baseTable.push(
    [chalk.dim('Min'), chalk.red(stats.minScore), chalk.dim('Max'), chalk.green(stats.maxScore)],
    [chalk.dim('Moyenne'), chalk.bold.white(stats.avgScore), chalk.dim('Mediane'), chalk.yellow(stats.medianScore)],
    [chalk.dim('Ecart-type'), chalk.cyan(stats.stdDev), chalk.dim('Duree moy.'), chalk.dim(`${stats.avgDurationMs}ms`)],
  );
  console.log(baseTable.toString());

  // Percentiles
  console.log(chalk.dim(`  Percentiles: P10=${stats.p10} | P25=${stats.p25} | P50=${stats.medianScore} | P75=${stats.p75} | P90=${stats.p90}`));

  // Distribution
  const distTable = new Table({
    head: ['Plage', 'Nb', '%', 'Distribution'].map(h => chalk.bold(h)),
    style: { head: [], border: ['gray'] },
    colWidths: [12, 8, 10, 30],
  });

  const total = stats.totalScores.length;
  const addRow = (label: string, count: number, color: typeof chalk.red) => {
    const pct = (count / total * 100).toFixed(1);
    distTable.push([label, String(count), `${pct}%`, color(makeBar(count, total, 25))]);
  };

  addRow('< 40 pts', stats.under40, chalk.red);
  addRow('< 50 pts', stats.under50, chalk.hex('#FFA500'));
  addRow('< 60 pts', stats.under60, chalk.yellow);
  addRow('>= 70 pts', stats.over70, chalk.green);
  addRow('>= 80 pts', stats.over80, chalk.cyan);

  console.log(distTable.toString());

  // Problemes
  if (stats.lowScoreCount > 0 || stats.flippedCardsCount > 0) {
    console.log(chalk.dim(`  Problemes: ${stats.lowScoreCount} scores < 40 | ${stats.flippedCardsCount} avec cartes retournees`));
  }
}

function printSummary(allStats: DetailedStats[]) {
  console.log('\n' + boxen(
    chalk.bold.yellow('RESUME GLOBAL'),
    { padding: 1, borderColor: 'yellow', borderStyle: 'double' }
  ));

  const summaryTable = new Table({
    head: ['Config', 'Moy', 'Min', 'Max', 'P10', 'P90', '<40', '<50', '>70', '>80'].map(h => chalk.bold(h)),
    style: { head: [], border: ['gray'] },
  });

  for (const stats of allStats) {
    const total = stats.totalScores.length;
    summaryTable.push([
      chalk.magenta(`${stats.playerCount}P`),
      chalk.bold.white(stats.avgScore),
      chalk.red(stats.minScore),
      chalk.green(stats.maxScore),
      chalk.dim(stats.p10),
      chalk.dim(stats.p90),
      chalk.red(`${(stats.under40 / total * 100).toFixed(1)}%`),
      chalk.hex('#FFA500')(`${(stats.under50 / total * 100).toFixed(1)}%`),
      chalk.green(`${(stats.over70 / total * 100).toFixed(1)}%`),
      chalk.cyan(`${(stats.over80 / total * 100).toFixed(1)}%`),
    ]);
  }

  console.log(summaryTable.toString());

  // Score global
  const allScores = allStats.flatMap(s => s.totalScores);
  const globalAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const globalUnder40 = allScores.filter(s => s < 40).length;
  const globalOver70 = allScores.filter(s => s >= 70).length;

  console.log('\n' + chalk.bold('Score moyen global: ') + chalk.bold.yellow(globalAvg.toFixed(1)));
  console.log(chalk.bold('Taux < 40 pts: ') + chalk.red(`${(globalUnder40 / allScores.length * 100).toFixed(2)}%`));
  console.log(chalk.bold('Taux >= 70 pts: ') + chalk.green(`${(globalOver70 / allScores.length * 100).toFixed(2)}%`));
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const config = parseArgs();
  const configs = createConfigs();
  const allStats: DetailedStats[] = [];
  const allResults: Record<string, SimGameResult[]> = {};

  console.log('\n' + boxen(
    chalk.bold.yellow('BENCHMARK IA HARD'),
    { padding: 1, borderColor: 'yellow', borderStyle: 'double' }
  ));

  console.log(chalk.dim(`\nConfiguration: ${config.gamesPerConfig} parties par config`));
  console.log(chalk.dim(`Configurations: 2P, 3P, 4P, 5P (toutes Hard vs Hard)`));
  console.log(chalk.dim(`Total: ${config.gamesPerConfig * 4} parties\n`));

  const startTime = Date.now();

  for (const testConfig of configs) {
    const simConfig: SimConfig = {
      players: testConfig.players,
      verbose: config.verbose,
    };

    process.stdout.write(chalk.cyan(`${testConfig.name}: `));

    const results = await runMultipleGames(
      simConfig,
      config.gamesPerConfig,
      'http://localhost:8080',
      (current, total) => {
        const pct = Math.round((current / total) * 100);
        process.stdout.write(`\r${chalk.cyan(testConfig.name)}: ${makeBar(current, total, 30)} ${pct}%`);
      }
    );

    process.stdout.write(`\r${chalk.green('✓')} ${testConfig.name}: ${results.length} parties         \n`);

    allResults[testConfig.name] = results;
    const stats = analyzeResults(testConfig.name, results);
    allStats.push(stats);
  }

  const totalTime = Date.now() - startTime;
  console.log(chalk.dim(`\nTemps total: ${(totalTime / 1000).toFixed(1)}s`));

  // Afficher les stats detaillees
  for (const stats of allStats) {
    printDetailedStats(stats);
  }

  // Resume
  printSummary(allStats);

  // Sauvegarder si demande
  if (config.outputFile) {
    const output = {
      timestamp: new Date().toISOString(),
      config: {
        gamesPerConfig: config.gamesPerConfig,
      },
      stats: allStats.map(s => ({
        ...s,
        totalScores: undefined, // Trop volumineux
      })),
      summary: {
        globalAvg: allStats.flatMap(s => s.totalScores).reduce((a, b) => a + b, 0) / allStats.flatMap(s => s.totalScores).length,
        totalGames: config.gamesPerConfig * 4,
        totalTime: totalTime,
      },
    };

    writeFileSync(config.outputFile, JSON.stringify(output, null, 2));
    console.log(chalk.dim(`\nResultats sauvegardes: ${config.outputFile}`));
  }
}

main().catch(err => {
  console.error(chalk.red('Erreur:'), err.message);
  process.exit(1);
});
