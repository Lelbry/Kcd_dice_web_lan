import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  decideBotAction,
  chooseGreedySelection,
  MOODS,
  MOOD_KEYS,
  randomMood,
  randomFirstName,
  randomBotColor,
  FIRST_NAMES,
  BOT_COLORS,
  rollBotPersona,
} from '../server/bot.js';
import { ClientMsg } from '../server/protocol.js';

function makeSnapshot({
  diceOnTable,
  lockedDice = [],
  roundScore = 0,
  botTotal = 0,
  oppTotal = 0,
  target = 2000,
  botMood = 'calculated',
} = {}) {
  return {
    phase: 'playing',
    targetScore: target,
    players: [
      { id: 'p0', name: 'Митяй', totalScore: botTotal, isBot: true, mood: botMood },
      { id: 'p1', name: 'Sasha', totalScore: oppTotal, isBot: false },
    ],
    currentPlayerId: 'p0',
    turn: {
      awaitingFirstRoll: false,
      diceOnTable,
      lockedDice,
      roundScore,
      isFarkle: false,
      isHotDice: false,
    },
    winnerId: null,
    history: [],
  };
}

const bot = { id: 'p0', totalScore: 0, mood: 'calculated' };

// ---- chooseGreedySelection ----

test('greedy: [1,1,1,5,5,5] selects all 6', () => {
  const sel = chooseGreedySelection([1, 1, 1, 5, 5, 5]);
  assert.equal(sel.length, 6);
});

test('greedy: [1,2,3,4,5,6] selects all 6 (straight)', () => {
  const sel = chooseGreedySelection([1, 2, 3, 4, 5, 6]);
  assert.equal(sel.length, 6);
});

test('greedy: [1,2,3,4,6,6] selects only index of 1', () => {
  const sel = chooseGreedySelection([1, 2, 3, 4, 6, 6]);
  assert.deepEqual(sel, [0]);
});

test('greedy: [2,3,4,6] returns null (farkle)', () => {
  const sel = chooseGreedySelection([2, 3, 4, 6]);
  assert.equal(sel, null);
});

test('greedy: [1,1,1,2,3,4] picks the three 1s', () => {
  const sel = chooseGreedySelection([1, 1, 1, 2, 3, 4]);
  assert.deepEqual(sel.sort(), [0, 1, 2]);
});

test('greedy: [5,5,2,2,4,6] picks both 5s (no straight present)', () => {
  const sel = chooseGreedySelection([5, 5, 2, 2, 4, 6]);
  assert.deepEqual(sel.sort(), [0, 1]);
});

test('greedy prefers larger valid selection: 2-6 straight over single 5', () => {
  // [5,5,2,3,4,6] — наличие 2,3,4,5,6 даёт 2-6 стрит (750), вместо пары 5 (100)
  const sel = chooseGreedySelection([5, 5, 2, 3, 4, 6]);
  assert.equal(sel.length, 5);
});

// ---- decideBotAction: forced bank on win ----

test('forced bank: total + projected >= target', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6], // single 1 = 100
    botTotal: 1950,
    target: 2000,
  });
  const d = decideBotAction(snap, snap.players[0]);
  assert.equal(d.type, ClientMsg.SCORE_AND_BANK);
});

test('forced bank: reckless mood still banks if win is in pocket', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6],
    botTotal: 1950,
    target: 2000,
    botMood: 'reckless',
  });
  const d = decideBotAction(snap, snap.players[0]);
  assert.equal(d.type, ClientMsg.SCORE_AND_BANK);
});

// ---- decideBotAction: thresholds per mood ----

test('cautious banks at roundScore 300 (>250 base)', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6], // +100 → projected 400
    roundScore: 300,
    botMood: 'cautious',
  });
  const rng = () => 0.99; // disable rofl
  const d = decideBotAction(snap, snap.players[0], rng);
  assert.equal(d.type, ClientMsg.SCORE_AND_BANK);
});

test('cautious rolls at projected 50 (<250)', () => {
  // Никаких стритов: только одинокая 5 — projected 50
  const snap = makeSnapshot({
    diceOnTable: [5, 6, 6, 2, 2, 4],
    roundScore: 0,
    botMood: 'cautious',
  });
  const rng = () => 0.99;
  const d = decideBotAction(snap, snap.players[0], rng);
  assert.equal(d.type, ClientMsg.SCORE_AND_ROLL);
});

test('reckless rolls at 800 projected (<1100 base)', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6], // +100 → projected 800
    roundScore: 700,
    botMood: 'reckless',
  });
  const rng = () => 0.99;
  const d = decideBotAction(snap, snap.players[0], rng);
  assert.equal(d.type, ClientMsg.SCORE_AND_ROLL);
});

test('reckless banks at 1200 projected (>1100 base)', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6], // +100 → projected 1200
    roundScore: 1100,
    botMood: 'reckless',
  });
  const rng = () => 0.99;
  const d = decideBotAction(snap, snap.players[0], rng);
  assert.equal(d.type, ClientMsg.SCORE_AND_BANK);
});

// ---- forced reroll when 0 dice remain ----

test('forced reroll: all 6 selected → score_and_roll', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 5, 6], // straight, 1500
    botTotal: 0,
    target: 2000,
  });
  const d = decideBotAction(snap, snap.players[0]);
  assert.equal(d.type, ClientMsg.SCORE_AND_ROLL);
});

// ---- comeback boost ----

test('comeback boost: opponent close to win, cautious pushes harder', () => {
  // base 250. Opponent at 1500/2000 → distance 500 → ×1.8 → threshold 450.
  // Projected 400 should now ROLL (without boost it would bank).
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6],
    roundScore: 300,
    botMood: 'cautious',
    oppTotal: 1500,
    target: 2000,
  });
  const rng = () => 0.99;
  const d = decideBotAction(snap, snap.players[0], rng);
  assert.equal(d.type, ClientMsg.SCORE_AND_ROLL);
});

test('cold-blooded ignores comeback boost', () => {
  // base 500. Without boost, projected 600 banks.
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6],
    roundScore: 500,
    botMood: 'cold-blooded',
    oppTotal: 1500,
    target: 2000,
  });
  const rng = () => 0.99;
  const d = decideBotAction(snap, snap.players[0], rng);
  assert.equal(d.type, ClientMsg.SCORE_AND_BANK);
});

// ---- rofl flip ----

test('rofl: random < 0.05 flips the decision', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6], // +100 → projected 100
    roundScore: 0,
    botMood: 'calculated',
  });
  // First call (threshold computation for non-wild does not consume rng);
  // we want the rofl branch to fire. Use rng=0.01 (< 0.05).
  const rng = () => 0.01;
  const d = decideBotAction(snap, snap.players[0], rng);
  // Without rofl: projected 100 < 450 base → roll. With rofl flip → bank.
  assert.equal(d.type, ClientMsg.SCORE_AND_BANK);
});

test('cold-blooded never rofls (rng=0 still respects threshold)', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6],
    roundScore: 0,
    botMood: 'cold-blooded',
  });
  const rng = () => 0;
  const d = decideBotAction(snap, snap.players[0], rng);
  // projected 100 < 500 base → roll, no flip.
  assert.equal(d.type, ClientMsg.SCORE_AND_ROLL);
});

// ---- wild mood ----

test('wild mood: deterministic with seeded rng', () => {
  const snap = makeSnapshot({
    diceOnTable: [1, 2, 3, 4, 6, 6],
    roundScore: 500,
    botMood: 'wild',
  });
  // rng=0 → wild threshold = 200, projected = 600 → bank
  const dBank = decideBotAction(snap, snap.players[0], () => 0);
  assert.equal(dBank.type, ClientMsg.SCORE_AND_BANK);
  // rng=0.99 → wild threshold = ~1586, projected = 600 → roll
  const dRoll = decideBotAction(snap, snap.players[0], () => 0.99);
  assert.equal(dRoll.type, ClientMsg.SCORE_AND_ROLL);
});

// ---- persona generators ----

test('randomMood returns one of MOOD_KEYS', () => {
  const m = randomMood();
  assert.ok(MOOD_KEYS.includes(m));
});

test('randomFirstName returns from pool', () => {
  const n = randomFirstName();
  assert.ok(FIRST_NAMES.includes(n));
});

test('randomFirstName respects exclude', () => {
  const excluded = FIRST_NAMES.slice(0, FIRST_NAMES.length - 1);
  const left = FIRST_NAMES[FIRST_NAMES.length - 1];
  const n = randomFirstName(Math.random, excluded);
  assert.equal(n, left);
});

test('rollBotPersona returns mood+firstName+color', () => {
  const p = rollBotPersona();
  assert.ok(MOOD_KEYS.includes(p.mood));
  assert.ok(FIRST_NAMES.includes(p.firstName));
  assert.ok(BOT_COLORS.includes(p.color));
  assert.match(p.color, /^#[0-9a-f]{6}$/i);
});

test('randomBotColor returns hex from BOT_COLORS', () => {
  for (let i = 0; i < 50; i++) {
    const c = randomBotColor();
    assert.ok(BOT_COLORS.includes(c));
  }
});

test('BOT_COLORS все валидные hex #RRGGBB', () => {
  for (const c of BOT_COLORS) {
    assert.match(c, /^#[0-9a-f]{6}$/i, `${c} не валидный hex`);
  }
});

test('all moods have valid labels and descriptions', () => {
  for (const k of MOOD_KEYS) {
    assert.equal(typeof MOODS[k].label, 'string');
    assert.ok(MOODS[k].label.length > 0);
    assert.equal(typeof MOODS[k].description, 'string');
    assert.ok(MOODS[k].description.length > 0);
  }
});
