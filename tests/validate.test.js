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
