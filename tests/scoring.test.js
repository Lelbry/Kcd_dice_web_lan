import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { scoreSelection, isFarkle } from '../server/engine/scoring.js';

test('single 1 = 100', () => {
  const r = scoreSelection([1]);
  assert.equal(r.score, 100);
  assert.equal(r.valid, true);
});

test('single 5 = 50', () => {
  assert.equal(scoreSelection([5]).score, 50);
});

test('two 1s = 200', () => {
  assert.equal(scoreSelection([1, 1]).score, 200);
});

test('two 5s = 100', () => {
  assert.equal(scoreSelection([5, 5]).score, 100);
});

test('three 1s = 1000', () => {
  assert.equal(scoreSelection([1, 1, 1]).score, 1000);
});

test('three 2s = 200', () => {
  assert.equal(scoreSelection([2, 2, 2]).score, 200);
});

test('three 3s = 300', () => {
  assert.equal(scoreSelection([3, 3, 3]).score, 300);
});

test('three 4s = 400', () => {
  assert.equal(scoreSelection([4, 4, 4]).score, 400);
});

test('three 5s = 500', () => {
  assert.equal(scoreSelection([5, 5, 5]).score, 500);
});

test('three 6s = 600', () => {
  assert.equal(scoreSelection([6, 6, 6]).score, 600);
});

test('four 1s = 2000', () => {
  assert.equal(scoreSelection([1, 1, 1, 1]).score, 2000);
});

test('five 1s = 4000', () => {
  assert.equal(scoreSelection([1, 1, 1, 1, 1]).score, 4000);
});

test('six 1s = 8000', () => {
  assert.equal(scoreSelection([1, 1, 1, 1, 1, 1]).score, 8000);
});

test('four 3s = 1200', () => {
  assert.equal(scoreSelection([3, 3, 3, 3]).score, 1200);
});

test('five 2s = 800', () => {
  assert.equal(scoreSelection([2, 2, 2, 2, 2]).score, 800);
});

test('six 2s = 1600', () => {
  assert.equal(scoreSelection([2, 2, 2, 2, 2, 2]).score, 1600);
});

test('three 1s + three 5s = 1500', () => {
  assert.equal(scoreSelection([1, 1, 1, 5, 5, 5]).score, 1500);
});

test('four 1s + two 5s = 2100', () => {
  assert.equal(scoreSelection([1, 1, 1, 1, 5, 5]).score, 2100);
});

test('five 1s + one 5 = 4050', () => {
  assert.equal(scoreSelection([1, 1, 1, 1, 1, 5]).score, 4050);
});

test('straight 1-6 = 1500', () => {
  assert.equal(scoreSelection([1, 2, 3, 4, 5, 6]).score, 1500);
});

test('straight 1-6 unsorted', () => {
  assert.equal(scoreSelection([3, 1, 6, 5, 2, 4]).score, 1500);
});

test('straight 1-5 = 500', () => {
  assert.equal(scoreSelection([1, 2, 3, 4, 5]).score, 500);
});

test('straight 2-6 = 750', () => {
  assert.equal(scoreSelection([2, 3, 4, 5, 6]).score, 750);
});

test('single 1 selected from larger roll', () => {
  assert.equal(scoreSelection([1]).score, 100);
});

test('invalid: lone 2', () => {
  const r = scoreSelection([2]);
  assert.equal(r.valid, false);
  assert.equal(r.score, 0);
});

test('invalid: two 5s + lone 2', () => {
  assert.equal(scoreSelection([5, 5, 2]).valid, false);
});

test('invalid: [2,3,4,6]', () => {
  assert.equal(scoreSelection([2, 3, 4, 6]).valid, false);
});

test('invalid: pair of 3s alone', () => {
  assert.equal(scoreSelection([3, 3]).valid, false);
});

test('invalid: empty', () => {
  assert.equal(scoreSelection([]).valid, false);
});

test('invalid: out of range value', () => {
  assert.equal(scoreSelection([7]).valid, false);
  assert.equal(scoreSelection([0]).valid, false);
});

test('breakdown carries scoring details', () => {
  const r = scoreSelection([1, 1, 1, 5]);
  assert.equal(r.score, 1050);
  assert.equal(r.valid, true);
  assert.equal(r.breakdown.length, 2);
});

test('isFarkle: [2,3,4,6] = true', () => {
  assert.equal(isFarkle([2, 3, 4, 6]), true);
});

test('isFarkle: contains 1 = false', () => {
  assert.equal(isFarkle([1, 2, 3, 4]), false);
});

test('isFarkle: triple = false', () => {
  assert.equal(isFarkle([3, 3, 3, 2]), false);
});

test('isFarkle: 1-6 straight = false', () => {
  assert.equal(isFarkle([1, 2, 3, 4, 5, 6]), false);
});

test('isFarkle: 1-5 straight = false', () => {
  assert.equal(isFarkle([1, 2, 3, 4, 5]), false);
});

test('isFarkle: 2-6 straight = false', () => {
  assert.equal(isFarkle([2, 3, 4, 5, 6]), false);
});

test('isFarkle: [2,2,3,4] = true', () => {
  assert.equal(isFarkle([2, 2, 3, 4]), true);
});

test('isFarkle: lone die with 5 = false', () => {
  assert.equal(isFarkle([5]), false);
});

test('isFarkle: lone die with 2 = true', () => {
  assert.equal(isFarkle([2]), true);
});

test('isFarkle: [4,6,2,3] = true', () => {
  assert.equal(isFarkle([4, 6, 2, 3]), true);
});

test('isFarkle: empty roll = false (no farkle without rolling)', () => {
  assert.equal(isFarkle([]), false);
});
