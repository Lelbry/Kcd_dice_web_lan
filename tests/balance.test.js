import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { simulateGame } from '../scripts/sim-core.js';
import { GAME_MODES } from '../server/engine/rules.js';

const NORMAL = Array(6).fill('normal');
const TARGET = GAME_MODES.pocket.defaultTarget;

function winRate(a, b, games) {
  let wins = 0;
  for (let i = 0; i < games; i++) if (simulateGame(a, b, TARGET).winner === 0) wins++;
  return wins / games;
}

// loaded x3 is no longer a legal loadout (one of each); kept as an engine-level stress check.
test('loaded x3 beats an all-normal loadout in more than 55% of 200 pocket games', () => {
  const rate = winRate(['loaded', 'loaded', 'loaded', 'normal', 'normal', 'normal'], NORMAL, 200);
  assert.ok(rate > 0.55, `loaded win rate ${(rate * 100).toFixed(1)}%`);
});

test('best legal pocket set (loaded, painted, lucky) beats all-normal in more than 55% of 200 games', () => {
  const rate = winRate(['loaded', 'painted', 'lucky', 'normal', 'normal', 'normal'], NORMAL, 200);
  assert.ok(rate > 0.55, `legal set win rate ${(rate * 100).toFixed(1)}%`);
});

test('mirror match of all-normal loadouts is roughly even', () => {
  const rate = winRate(NORMAL, NORMAL, 400);
  assert.ok(rate > 0.4 && rate < 0.6, `mirror win rate ${(rate * 100).toFixed(1)}%`);
});

test('unlucky x2 (anti-1/6) loses to an all-normal loadout', () => {
  const rate = winRate(['unlucky', 'unlucky', 'normal', 'normal', 'normal', 'normal'], NORMAL, 400);
  assert.ok(rate < 0.5, `unlucky win rate ${(rate * 100).toFixed(1)}%`);
});
