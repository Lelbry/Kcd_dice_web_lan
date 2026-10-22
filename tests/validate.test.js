import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canHold, canBank, checkWin, isFarkle } from '../server/engine/validate.js';

test('canHold: triple of 1s from [1,1,1,2,3,4]', () => {
  const r = canHold([0, 1, 2], [1, 1, 1, 2, 3, 4]);
  assert.equal(r.ok, true);
  assert.equal(r.score, 1000);
});

test('canHold: invalid selection includes non-scoring 2', () => {
  const r = canHold([0, 3], [1, 1, 1, 2, 3, 4]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_scoring');
});

test('canHold: empty selection rejected', () => {
  const r = canHold([], [1, 2, 3]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'empty_selection');
});

test('canHold: out-of-range index rejected', () => {
  const r = canHold([5], [1, 2, 3]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_index');
});

test('canHold: duplicate index rejected', () => {
  const r = canHold([0, 0], [1, 1, 1]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'duplicate_index');
});

test('canHold: straight 1-6', () => {
  const r = canHold([0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]);
  assert.equal(r.ok, true);
  assert.equal(r.score, 1500);
});

test('canHold: only the 1 from a straight roll', () => {
  const r = canHold([0], [1, 2, 3, 4, 5, 6]);
  assert.equal(r.ok, true);
  assert.equal(r.score, 100);
});

test('canHold: subset that mixes 1 with non-scoring 2 fails', () => {
  const r = canHold([0, 1], [1, 2, 3, 4, 5, 6]);
  assert.equal(r.ok, false);
});

test('canBank: positive turn score allowed', () => {
  assert.equal(canBank(100), true);
});

test('canBank: zero not allowed', () => {
  assert.equal(canBank(0), false);
});

test('canBank: negative not allowed', () => {
  assert.equal(canBank(-50), false);
});

test('checkWin: equal to target wins', () => {
  assert.equal(checkWin(2000, 2000), true);
});

test('checkWin: above target wins', () => {
  assert.equal(checkWin(2050, 2000), true);
});

test('checkWin: below target does not win', () => {
  assert.equal(checkWin(1999, 2000), false);
});

test('isFarkle re-export works', () => {
  assert.equal(typeof isFarkle, 'function');
  assert.equal(isFarkle([2, 3, 4]), true);
});

import { validateLoadoutArray, sanitizeLoadout, DICE_TYPES } from '../server/engine/dice-types.js';
import { generateBotLoadout } from '../server/bot.js';

const N = 'normal';

test('loadout: cosmetic dice are unlimited in every mode', () => {
  const six = Array(6).fill('artist_r');
  assert.deepEqual(validateLoadoutArray(six, 'classic'), six);
  assert.deepEqual(validateLoadoutArray(six, 'pocket'), six);
});

test('loadout: classic rejects any cheating die', () => {
  assert.equal(validateLoadoutArray(['loaded', N, N, N, N, N], 'classic'), null);
});

test('loadout: pocket allows up to 3 different cheating dice, one of each', () => {
  assert.ok(validateLoadoutArray(['loaded', 'painted', 'lucky', 'tooth', 'tooth', N], 'pocket'));
  assert.equal(validateLoadoutArray(['loaded', 'loaded', N, N, N, N], 'pocket'), null);
  assert.equal(validateLoadoutArray(['loaded', 'painted', 'lucky', 'odd', N, N], 'pocket'), null);
});

test('loadout: unknown ids and wrong length are rejected', () => {
  assert.equal(validateLoadoutArray(['nope', N, N, N, N, N], 'pocket'), null);
  assert.equal(validateLoadoutArray([N, N], 'pocket'), null);
});

test('sanitizeLoadout: strips what the mode forbids and keeps the rest in place', () => {
  assert.deepEqual(
    sanitizeLoadout(['loaded', 'tooth', 'painted', N, N, N], 'classic'),
    [N, 'tooth', N, N, N, N],
  );
  assert.deepEqual(
    sanitizeLoadout(['loaded', 'loaded', 'painted', 'lucky', 'odd', 'hugo'], 'pocket'),
    ['loaded', N, 'painted', 'lucky', N, 'hugo'],
  );
});

test('generateBotLoadout: always valid for its mode', () => {
  for (const mode of ['classic', 'pocket']) {
    for (let i = 0; i < 200; i++) {
      const l = generateBotLoadout(mode);
      assert.ok(validateLoadoutArray(l, mode), `${mode}: ${l}`);
    }
  }
  const classic = generateBotLoadout('classic', () => 0.9);
  assert.ok(classic.every((id) => !DICE_TYPES.find((d) => d.id === id).special));
});

import { validateSelection, validateActivateBadge } from '../server/protocol.js';

test('protocol: a seventh die (index 6) can be held and targeted; index 7 cannot', () => {
  assert.deepEqual(validateSelection({ selection: [0, 6] }), { selection: [0, 6] });
  assert.equal(validateSelection({ selection: [7] }), null);
  assert.deepEqual(validateActivateBadge({ diceIndex: 6 }), { diceIndex: 6, diceIndices: null });
  assert.deepEqual(validateActivateBadge({ diceIndices: [0, 6] }), { diceIndex: null, diceIndices: [0, 6] });
  assert.equal(validateActivateBadge({ diceIndices: [1, 1] }), null);
  assert.equal(validateActivateBadge({ diceIndices: [] }), null);
  assert.deepEqual(validateActivateBadge({}), { diceIndex: null, diceIndices: null });
});
