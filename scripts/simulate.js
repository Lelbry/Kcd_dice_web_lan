#!/usr/bin/env node
/**
 * Симуляция 100 игр для подбора целей (targetScore) в двух режимах:
 *   1. Классический — все обычные кости
 *   2. Карманные кости — до 3 специальных костей на игрока
 */

import { DICE_TYPES, DICE_TYPES_MAP, DEFAULT_LOADOUT } from '../server/engine/dice-types.js';
import { simulateGame } from './sim-core.js';

const GAMES_PER_CONFIG = 100;

function runSimulation(label, loadout1, loadout2, targetScore, numGames = GAMES_PER_CONFIG) {
  const results = [];
  for (let i = 0; i < numGames; i++) {
    results.push(simulateGame(loadout1, loadout2, targetScore));
  }

  const turns = results.map((r) => r.turns);
  const farkles = results.map((r) => r.farkles);
  const hotDice = results.map((r) => r.hotDice);
  const maxRounds = results.map((r) => r.maxRoundScore);
  const avgTurns = turns.reduce((a, b) => a + b, 0) / numGames;
  const medTurns = turns.sort((a, b) => a - b)[Math.floor(numGames / 2)];
  const minTurns = Math.min(...turns);
  const maxTurns = Math.max(...turns);
  const avgFarkles = farkles.reduce((a, b) => a + b, 0) / numGames;
  const avgHotDice = hotDice.reduce((a, b) => a + b, 0) / numGames;
  const maxRound = Math.max(...maxRounds);

  return {
    label,
    target: targetScore,
    avgTurns: avgTurns.toFixed(1),
    medTurns,
    minTurns,
    maxTurns,
    avgFarkles: avgFarkles.toFixed(1),
    avgHotDice: avgHotDice.toFixed(1),
    maxRound,
  };
}

// --- Loadout configurations ---

const CLASSIC = DEFAULT_LOADOUT; // all normal

// Best scoring loadouts (3 special + 3 normal)
const LOADOUT_SCORING = ['loaded', 'painted', 'lucky', 'normal', 'normal', 'normal'];
const LOADOUT_ANTIOCH = ['antioch', 'antioch', 'antioch', 'normal', 'normal', 'normal'];
const LOADOUT_ODD = ['odd', 'loaded', 'painted', 'normal', 'normal', 'normal'];
const LOADOUT_MIXED = ['shrewd_cheat', 'painted', 'lucky', 'normal', 'normal', 'normal'];
const LOADOUT_AGGRESSIVE = ['loaded', 'loaded', 'loaded', 'normal', 'normal', 'normal'];

// --- Run simulations ---

console.log('='.repeat(80));
console.log('  СИМУЛЯЦИЯ ИГР В КОСТИ KCD2');
console.log('  По 100 игр на каждую конфигурацию');
console.log('  Стратегия: жадный выбор + банк при 450+ очках');
console.log('='.repeat(80));
console.log();

// Classic mode
console.log('--- КЛАССИЧЕСКИЙ РЕЖИМ (все обычные кости) ---');
console.log();
const classicTargets = [1500, 2000, 2500, 3000, 3500, 4000, 5000];
const classicResults = classicTargets.map((t) =>
  runSimulation('Classic', CLASSIC, CLASSIC, t),
);
console.log(
  'Цель'.padEnd(8),
  'Ходов(avg)'.padEnd(12),
  'Медиана'.padEnd(9),
  'Мин'.padEnd(6),
  'Макс'.padEnd(7),
  'Зонки(avg)'.padEnd(12),
  'HotDice(avg)'.padEnd(14),
  'Макс.раунд',
);
for (const r of classicResults) {
  console.log(
    String(r.target).padEnd(8),
    r.avgTurns.padEnd(12),
    String(r.medTurns).padEnd(9),
    String(r.minTurns).padEnd(6),
    String(r.maxTurns).padEnd(7),
    r.avgFarkles.padEnd(12),
    r.avgHotDice.padEnd(14),
    String(r.maxRound),
  );
}

console.log();
console.log('--- РЕЖИМ "КАРМАННЫЕ КОСТИ" (3 специальных + 3 обычных) ---');
console.log();

const loadoutConfigs = [
  { name: 'Loaded+Painted+Lucky', loadout: LOADOUT_SCORING },
  { name: '3x Antioch', loadout: LOADOUT_ANTIOCH },
  { name: 'Odd+Loaded+Painted', loadout: LOADOUT_ODD },
  { name: 'Shrewd+Painted+Lucky', loadout: LOADOUT_MIXED },
  { name: '3x Loaded', loadout: LOADOUT_AGGRESSIVE },
];

const specialTargets = [2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000];

for (const cfg of loadoutConfigs) {
  console.log(`\n  Loadout: ${cfg.name} [${cfg.loadout.join(', ')}]`);
  console.log(
    '  Цель'.padEnd(10),
    'Ходов(avg)'.padEnd(12),
    'Медиана'.padEnd(9),
    'Мин'.padEnd(6),
    'Макс'.padEnd(7),
    'Зонки(avg)'.padEnd(12),
    'HotDice(avg)'.padEnd(14),
    'Макс.раунд',
  );
  const results = specialTargets.map((t) =>
    runSimulation(cfg.name, cfg.loadout, cfg.loadout, t),
  );
  for (const r of results) {
    console.log(
      `  ${String(r.target).padEnd(8)}`,
      r.avgTurns.padEnd(12),
      String(r.medTurns).padEnd(9),
      String(r.minTurns).padEnd(6),
      String(r.maxTurns).padEnd(7),
      r.avgFarkles.padEnd(12),
      r.avgHotDice.padEnd(14),
      String(r.maxRound),
    );
  }
}

// Mixed matchup: special vs classic
console.log();
console.log('--- СМЕШАННЫЙ МАТЧ: Специальные vs Классические ---');
console.log('  (Игрок 1 = Loaded+Painted+Lucky, Игрок 2 = все обычные)');
console.log();

const mixedTargets = [2000, 3000, 4000, 5000];
console.log(
  '  Цель'.padEnd(10),
  'Ходов(avg)'.padEnd(12),
  'Побед P1(%)'.padEnd(13),
  'Зонки(avg)'.padEnd(12),
);
for (const t of mixedTargets) {
  const results = [];
  for (let i = 0; i < GAMES_PER_CONFIG; i++) {
    results.push(simulateGame(LOADOUT_SCORING, CLASSIC, t));
  }
  const avgTurns = (results.reduce((a, r) => a + r.turns, 0) / GAMES_PER_CONFIG).toFixed(1);
  const p1Wins = results.filter((r) => r.winner === 0).length;
  const avgFarkles = (results.reduce((a, r) => a + r.farkles, 0) / GAMES_PER_CONFIG).toFixed(1);
  console.log(
    `  ${String(t).padEnd(8)}`,
    avgTurns.padEnd(12),
    `${p1Wins}%`.padEnd(13),
    avgFarkles.padEnd(12),
  );
}

console.log();
console.log('='.repeat(80));
console.log('  РЕКОМЕНДАЦИИ');
console.log('='.repeat(80));
console.log();
console.log('  Классический режим: цели 2000 / 3000 / 4000 (оставляем как есть)');
console.log();

// Calculate recommended targets for special dice mode
// Look at classic mode at 2000/3000/4000 and match turn counts
const classic2k = classicResults.find((r) => r.target === 2000);
const classic3k = classicResults.find((r) => r.target === 3000);
const classic4k = classicResults.find((r) => r.target === 4000);

console.log(`  Для сравнения, классический режим:`);
console.log(`    Цель 2000: ~${classic2k.avgTurns} ходов (медиана ${classic2k.medTurns})`);
console.log(`    Цель 3000: ~${classic3k.avgTurns} ходов (медиана ${classic3k.medTurns})`);
console.log(`    Цель 4000: ~${classic4k.avgTurns} ходов (медиана ${classic4k.medTurns})`);
console.log();
console.log('  Рекомендуемые цели для "Карманных костей" подобраны так,');
console.log('  чтобы длительность партии была аналогичной классике.');
