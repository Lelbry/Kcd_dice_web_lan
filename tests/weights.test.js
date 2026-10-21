import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DICE_TYPES, rollWeighted } from '../server/engine/dice-types.js';

function distribution(weights, n) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) counts[rollWeighted(weights) - 1]++;
  return counts.map((c) => (c / n) * 100);
}

// 100k rolls: sigma ~0.12pp, so the ±0.7pp band is ~6 sigma wide and never flakes.
test('fairness baseline: normal die stays within 16.0..17.4% per face over 100k rolls', () => {
  const pct = distribution([1, 1, 1, 1, 1, 1], 100_000);
  pct.forEach((p, i) => {
    assert.ok(p >= 16.0 && p <= 17.4, `face ${i + 1}: ${p.toFixed(2)}%`);
  });
});

test('catalog has 40 dice with unique ids and colors', () => {
  assert.equal(DICE_TYPES.length, 40);
  assert.equal(new Set(DICE_TYPES.map((d) => d.id)).size, 40);
  assert.equal(new Set(DICE_TYPES.map((d) => d.color)).size, 40);
  for (const dt of DICE_TYPES) {
    assert.match(dt.color, /^#[0-9a-f]{6}$/, dt.id);
    assert.equal(dt.weights.length, 6, dt.id);
    assert.ok(dt.weights.every((w) => Number.isInteger(w) && w >= 0), dt.id);
    if (!dt.special) assert.deepEqual(dt.weights, [1, 1, 1, 1, 1, 1], dt.id);
  }
});

for (const dt of DICE_TYPES) {
  test(`weight fidelity: ${dt.id} within ±1.5pp of declared weights`, () => {
    const total = dt.weights.reduce((s, w) => s + w, 0);
    const pct = distribution(dt.weights, 20_000);
    dt.weights.forEach((w, i) => {
      const expected = (w / total) * 100;
      if (w === 0) {
        assert.equal(pct[i], 0, `face ${i + 1} must never roll`);
      } else {
        assert.ok(Math.abs(pct[i] - expected) <= 1.5,
          `face ${i + 1}: got ${pct[i].toFixed(2)}%, expected ${expected.toFixed(2)}%`);
      }
    });
  });
}
