import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  BADGES,
  scoreWithBadge,
  canHoldWithBadge,
  activationBlocker,
} from '../server/engine/badges.js';
import { GameRoom } from '../server/room.js';
import { BotDriver, decideBotBadge } from '../server/bot.js';
import { GAME_MODES } from '../server/engine/rules.js';

const turn = (over = {}) => ({
  awaitingFirstRoll: false,
  isFarkle: false,
  doubleArmed: false,
  diceOnTable: [1, 2, 3, 4, 6, 6],
  roundScore: 0,
  ...over,
});

test('catalogue: 8 badges, active ones have charges, unique ids', () => {
  assert.equal(BADGES.length, 8);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 8);
  for (const b of BADGES) {
    if (b.kind === 'active') assert.ok(b.charges >= 1, b.id);
  }
});

test('carpenter: 3+5 scores 150 and makes the lone 3 holdable', () => {
  assert.deepEqual(
    { valid: scoreWithBadge([3, 5], 'carpenter').valid, score: scoreWithBadge([3, 5], 'carpenter').score },
    { valid: true, score: 150 },
  );
  assert.equal(scoreWithBadge([3, 5, 1], 'carpenter').score, 250);
  assert.equal(scoreWithBadge([3, 5, 3, 5], 'carpenter').score, 300);
  assert.equal(scoreWithBadge([3], 'carpenter').valid, false);
  assert.equal(scoreWithBadge([3, 5], 'doubling').valid, false);
});

test('executioner: 4+5+6 scores 500, a regular triple still wins when better', () => {
  assert.equal(scoreWithBadge([4, 5, 6], 'executioner').score, 500);
  assert.equal(scoreWithBadge([4, 5, 6, 1], 'executioner').score, 600);
  assert.equal(scoreWithBadge([5, 5, 5], 'executioner').score, 500);
  assert.equal(scoreWithBadge([4, 6], 'executioner').valid, false);
});

test('canHoldWithBadge keeps canHold errors and falls back for badges without combos', () => {
  assert.deepEqual(canHoldWithBadge([0, 0], [3, 5], 'carpenter'), { ok: false, reason: 'duplicate_index' });
  assert.equal(canHoldWithBadge([0, 1], [3, 5], 'carpenter').score, 150);
  assert.equal(canHoldWithBadge([0, 1], [3, 5], 'headstart').ok, false);
});

test('activationBlocker: timing rules per badge', () => {
  const base = { charges: 1, isMyTurn: true };
  assert.equal(activationBlocker('doubling', { ...base, turn: turn() }), null);
  assert.equal(activationBlocker('doubling', { ...base, turn: turn({ doubleArmed: true }) }), 'badge_already_armed');
  assert.equal(activationBlocker('doubling', { ...base, turn: turn({ awaitingFirstRoll: true }) }), 'badge_needs_roll');
  assert.equal(activationBlocker('doubling', { ...base, charges: 0, turn: turn() }), 'badge_no_charges');
  assert.equal(activationBlocker('doubling', { ...base, isMyTurn: false, turn: turn() }), 'not_your_turn');
  assert.equal(activationBlocker('resurrection', { ...base, turn: turn() }), 'badge_needs_farkle');
  assert.equal(activationBlocker('resurrection', { ...base, turn: turn({ isFarkle: true }) }), null);
  assert.equal(activationBlocker('transmutation', { ...base, turn: turn() }), 'badge_needs_die');
  assert.equal(activationBlocker('transmutation', { ...base, turn: turn(), diceIndex: 9 }), 'badge_needs_die');
  assert.equal(activationBlocker('exchange', { ...base, turn: turn(), diceIndex: 2 }), null);
  assert.equal(activationBlocker('headstart', { ...base, turn: turn() }), 'badge_passive');
});

// --- GameRoom integration -------------------------------------------------

function fakeHuman(id, badge) {
  const sent = [];
  return {
    id, clientId: id, name: id, connected: true, isBot: false, totalScore: 0,
    socket: { send: (m) => sent.push(JSON.parse(m)) }, sent,
    loadout: Array(6).fill('normal'), badge,
  };
}

function startBadgeRoom(b0, b1) {
  const room = new GameRoom({ farklePassDelayMs: 0, farkleRescueDelayMs: 0 });
  room.players = [fakeHuman('p0', b0), fakeHuman('p1', b1)];
  room.settings = { mode: 'badge', targetScore: GAME_MODES.badge.defaultTarget, tier: 'tin' };
  room._startGame();
  room.currentPlayerIdx = 0;
  room.turn = room._emptyTurn();
  return room;
}

const errorsOf = (p) => p.sent.filter((m) => m.type === 'error').map((m) => m.payload.code);

test('room: headstart starts at 500, active badges get their charges', () => {
  const room = startBadgeRoom('headstart', 'doubling');
  const [a, b] = room.players;
  assert.equal(a.totalScore, 500);
  assert.equal(b.totalScore, 0);
  assert.equal(b.badgeCharges, 1);
  const snap = room.toSnapshot();
  assert.equal(snap.players[1].badge, 'doubling');
  assert.equal(snap.players[1].badgeCharges, 1);
});

test('room: doubling doubles the next held score and is spent', () => {
  const room = startBadgeRoom('doubling', 'headstart');
  const me = room.players[0];
  room.turn.awaitingFirstRoll = false;
  room.turn.diceOnTable = [1, 2, 3, 4, 6, 6];
  room.turn.diceTypeIds = Array(6).fill('normal');
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.equal(me.badgeCharges, 0);
  assert.equal(room.turn.doubleArmed, true);
  me.badgeCharges = 1;
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.deepEqual(errorsOf(me), ['badge_already_armed']);
  room.handleMessage(me, { type: 'score_and_bank', payload: { selection: [0] } });
  assert.equal(me.totalScore, 200);
});

test('room: transmutation turns the chosen die into a 5', () => {
  const room = startBadgeRoom('transmutation', 'headstart');
  const me = room.players[0];
  room.turn.awaitingFirstRoll = false;
  room.turn.diceOnTable = [1, 2, 3, 4, 6, 6];
  room.turn.diceTypeIds = Array(6).fill('normal');
  room.handleMessage(me, { type: 'activate_badge', payload: { diceIndex: 1 } });
  assert.equal(room.turn.diceOnTable[1], 5);
  assert.equal(me.badgeCharges, 0);
  room.handleMessage(me, { type: 'activate_badge', payload: { diceIndex: 2 } });
  assert.deepEqual(errorsOf(me), ['badge_no_charges']);
});

test('room: carpenter lets a player hold 3+5 for 150', () => {
  const room = startBadgeRoom('carpenter', 'headstart');
  const me = room.players[0];
  room.turn.awaitingFirstRoll = false;
  room.turn.diceOnTable = [3, 5, 2, 2, 4, 6];
  room.turn.diceTypeIds = Array(6).fill('normal');
  room.handleMessage(me, { type: 'score_and_bank', payload: { selection: [0, 1] } });
  assert.deepEqual(errorsOf(me), []);
  assert.equal(me.totalScore, 150);
});

test('room: resurrection undoes a farkle and keeps the round score', () => {
  const room = startBadgeRoom('resurrection', 'headstart');
  const me = room.players[0];
  room.farkleRescueDelayMs = 60_000;
  room.turn.awaitingFirstRoll = false;
  room.turn.roundScore = 400;
  room.turn.diceOnTable = [2, 3, 4, 6];
  room.turn.diceTypeIds = Array(4).fill('normal');
  room._triggerFarkle(me);
  assert.ok(room.farkleTimer);
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.equal(me.badgeCharges, 1);
  assert.equal(room.turn.roundScore, 400);
  assert.equal(room.turn.diceOnTable.length, 4);
  assert.equal(room.history.find((h) => h.type === 'farkle').rescued, true);
  clearTimeout(room.farkleTimer);
  room.farkleTimer = null;
});

test('room: defence eats the opponent\'s first activation', () => {
  const room = startBadgeRoom('doubling', 'defence');
  const [me, opp] = room.players;
  room.turn.awaitingFirstRoll = false;
  room.turn.diceOnTable = [1, 2, 3, 4, 6, 6];
  room.turn.diceTypeIds = Array(6).fill('normal');
  me.badgeCharges = 2;
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.equal(me.badgeCharges, 1);
  assert.equal(opp.shield, 0);
  assert.equal(room.turn.doubleArmed, false);
  assert.ok(room.history.some((h) => h.type === 'badge_blocked'));
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.equal(room.turn.doubleArmed, true);
});

test('room: badges are ignored outside badge mode', () => {
  const room = new GameRoom();
  room.players = [fakeHuman('p0', 'headstart'), fakeHuman('p1', 'doubling')];
  room.settings = { mode: 'pocket', targetScore: 4000, tier: 'tin' };
  room._startGame();
  assert.equal(room.players[0].totalScore, 0);
  assert.equal(room.toSnapshot().players[0].badge, undefined);
});

test('bot: picks badge moments sensibly', () => {
  const bot = { id: 'p1', gameBadge: 'doubling', badgeCharges: 2 };
  const snap = (t) => ({ currentPlayerId: 'p1', turn: turn(t) });
  assert.equal(decideBotBadge(snap({ diceOnTable: [1, 2, 3, 4, 6, 6] }), bot), null);
  assert.equal(decideBotBadge(snap({ diceOnTable: [1, 1, 1, 4, 6, 2] }), bot)?.type, 'activate_badge');
  const tr = { ...bot, gameBadge: 'transmutation', badgeCharges: 1 };
  assert.deepEqual(decideBotBadge(snap({ diceOnTable: [1, 5, 3] }), tr)?.payload, { diceIndex: 2 });
  const rs = { ...bot, gameBadge: 'resurrection' };
  assert.equal(decideBotBadge(snap({ isFarkle: true, roundScore: 500, diceOnTable: [2, 3] }), rs)?.type, 'activate_badge');
  assert.equal(decideBotBadge(snap({ isFarkle: true, roundScore: 0, diceOnTable: [2] }), rs), null);
});

// Full bot-vs-bot games through the real room, with timers at zero.
function playBotGame(badges, target = GAME_MODES.badge.defaultTarget) {
  return new Promise((res, reject) => {
    let resolve = res;
    // A small rescue window so the bot's resurrection lands before the farkle passes the turn.
    const room = new GameRoom({ farklePassDelayMs: 0, farkleRescueDelayMs: 20 });
    const driver = new BotDriver(room, {
      firstRollDelayMinMs: 0, firstRollDelayMaxMs: 0, postRollDelayMinMs: 0, postRollDelayMaxMs: 0, previewMs: 0,
    });
    room.setStateChangedHandler(() => {
      if (room.phase === 'finished') {
        driver.cancel();
        resolve(room);
        return;
      }
      driver.tick();
    });
    room.players = badges.map((badge, i) => ({
      ...fakeHuman(`p${i}`, badge), isBot: true, mood: 'calculated', firstName: `Bot${i}`, socket: null,
    }));
    // Bots draw a random badge at start; pin the requested ones afterwards.
    room._setupBadgeOriginal = room._setupBadge;
    room._setupBadge = (p) => {
      p.isBot = false;
      room._setupBadgeOriginal(p);
      p.isBot = true;
    };
    room.settings = { mode: 'badge', targetScore: target, tier: 'tin' };
    room._startGame();
    const guard = setTimeout(() => {
      driver.cancel();
      reject(new Error(`game did not finish: ${JSON.stringify({ badges, turn: room.turn, last: room.history.slice(-3) })}`));
    }, 10_000);
    const done = resolve;
    resolve = (r) => { clearTimeout(guard); done(r); };
  });
}

test('room: bot-vs-bot badge games always finish, every badge gets used', async () => {
  const used = new Set();
  for (const b of BADGES) {
    const games = b.kind === 'active' ? 10 : 3;
    for (let i = 0; i < games; i++) {
      const room = await playBotGame([b.id, 'headstart']);
      assert.equal(room.phase, 'finished');
      for (const p of room.players) for (const e of p.badgeLog) used.add(e.badgeId);
    }
  }
  for (const b of BADGES.filter((x) => x.kind === 'active')) assert.ok(used.has(b.id), `${b.id} never activated`);
});
