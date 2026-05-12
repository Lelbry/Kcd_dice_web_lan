// Эмпирический аудит RNG, используемого сервером.
// Бросает 100 000 раз по 6 костей и считает:
//   - частоту каждой грани (ожидается ~1/6 = 16.67% у каждой);
//   - средняя «доля 1 и 5» в броске (ожидается 2/6 = 33.3%);
//   - доля бросков, где есть хотя бы одна «1» или «5» (~91.2%);
//   - доля бросков, помеченных как FARKLE движком игры (~2%).
//
// Запуск:  node tests/rng-audit.mjs

import { randomInt } from 'node:crypto';
import { isFarkle } from '../server/engine/scoring.js';

const TRIALS = 100_000;
const DICE_PER_ROLL = 6;

const faceCounts = [0, 0, 0, 0, 0, 0, 0]; // 1..6
let totalDice = 0;
let rollsWithAnyOneOrFive = 0;
let farkles = 0;
let totalOneOrFiveDice = 0;

const t0 = Date.now();

for (let trial = 0; trial < TRIALS; trial++) {
  const roll = new Array(DICE_PER_ROLL);
  for (let i = 0; i < DICE_PER_ROLL; i++) {
    const v = randomInt(1, 7);
    roll[i] = v;
    faceCounts[v]++;
    totalDice++;
    if (v === 1 || v === 5) totalOneOrFiveDice++;
  }
  if (roll.some((v) => v === 1 || v === 5)) rollsWithAnyOneOrFive++;
  if (isFarkle(roll)) farkles++;
}

const dt = Date.now() - t0;
const expectedPerFace = totalDice / 6;
const expectedRollsWithOneOrFive = TRIALS * (1 - Math.pow(4 / 6, 6));

console.log(`Бросков: ${TRIALS.toLocaleString()} × ${DICE_PER_ROLL} = ${totalDice.toLocaleString()} костей. Время: ${dt} мс\n`);
console.log('Распределение граней (ожидается ~16.67 % у каждой):');
for (let f = 1; f <= 6; f++) {
  const pct = (100 * faceCounts[f]) / totalDice;
  const deviationPct = (100 * (faceCounts[f] - expectedPerFace)) / expectedPerFace;
  const sign = deviationPct >= 0 ? '+' : '';
  console.log(`  «${f}»: ${pct.toFixed(3)} %   (отклонение от 16.667 %: ${sign}${deviationPct.toFixed(2)} %)`);
}

const oneOrFivePct = (100 * totalOneOrFiveDice) / totalDice;
console.log(`\nДоля костей со значением «1» или «5»: ${oneOrFivePct.toFixed(3)} %   (ожидается 33.333 %)`);

const rollsWithPct = (100 * rollsWithAnyOneOrFive) / TRIALS;
console.log(`Бросков с хотя бы одной «1» или «5» из 6 костей: ${rollsWithPct.toFixed(3)} %`);
console.log(`  Теоретически: 1 − (4/6)^6 = ${((1 - Math.pow(4 / 6, 6)) * 100).toFixed(3)} %`);

const farklePct = (100 * farkles) / TRIALS;
console.log(`\nДоля FARKLE (никаких зачётных в 6 костях): ${farklePct.toFixed(3)} %   (теория ~2.31 %)`);

console.log('\nВывод: если отклонение каждой грани от 16.667 % меньше ~1 % — RNG ровный.');
