import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  BADGES,
  BADGES_MAP,
  BADGE_TIERS,
  badgeStats,
  badgeText,
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

test('catalogue: 14 badges, unique ids, every badge has stats at every tier', () => {
  assert.equal(BADGES.length, 14);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 14);
  for (const b of BADGES) {
    assert.ok(b.special ? !!b.stats && !b.tiers : !!b.tiers && !b.stats, b.id);
    for (const tier of BADGE_TIERS) {
      const st = badgeStats(b.id, tier);
      if (b.kind === 'active') assert.ok(st.charges >= 1, `${b.id}/${tier}`);
      assert.doesNotMatch(badgeText(b.id, tier), /\{|\}/, `${b.id}/${tier} has an unfilled placeholder`);
    }
  }
});

test('tiers: a higher tier never has fewer charges or a weaker effect; special badges ignore the tier', () => {
  const power = (st) => [st.charges, st.startBonus, st.shield, st.rerollMax, st.bankMultiplier];
  for (const b of BADGES) {
    const [tin, silver, gold] = BADGE_TIERS.map((t) => power(badgeStats(b.id, t)));
    if (b.special) {
      assert.deepEqual(tin, gold, b.id);
      continue;
    }
    for (let i = 0; i < tin.length; i++) {
      assert.ok(tin[i] <= silver[i] && silver[i] <= gold[i], `${b.id}: ${tin} / ${silver} / ${gold}`);
    }
    assert.notDeepEqual(tin, gold, `${b.id} is the same at tin and gold`);
  }
  assert.equal(badgeStats('doubling', 'gold').charges, 3);
  assert.equal(badgeStats('headstart', 'gold').startBonus, 1000);
  assert.equal(badgeStats('warlord', 'silver').bankMultiplier, 1.5);
  assert.equal(badgeStats('nope', 'gold').charges, 0);
  assert.equal(badgeStats('doubling', 'platinum').charges, 1);
});

test('emperor: three ones score 2000, and still combine with other dice', () => {
  assert.equal(scoreWithBadge([1, 1, 1], 'emperor').score, 2000);
  assert.equal(scoreWithBadge([1, 1, 1, 5], 'emperor').score, 2050);
  assert.equal(scoreWithBadge([1, 1, 1, 1], 'emperor').score, 2100);
  assert.equal(scoreWithBadge([1, 1, 1], 'doubling').score, 1000);
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

function startBadgeRoom(b0, b1, tier = 'tin') {
  const room = new GameRoom({ farklePassDelayMs: 0, farkleRescueDelayMs: 0 });
  room.players = [fakeHuman('p0', b0), fakeHuman('p1', b1)];
  room.settings = { mode: 'badge', targetScore: GAME_MODES.badge.defaultTarget, tier };
  room._startGame();
  room.currentPlayerIdx = 0;
  room.turn = room._emptyTurn();
  return room;
}

const errorsOf = (p) => p.sent.filter((m) => m.type === 'error').map((m) => m.payload.code);

test('room: headstart and charges follow the lobby tier', () => {
  const tin = startBadgeRoom('headstart', 'doubling');
  assert.equal(tin.players[0].totalScore, 250);
  assert.equal(tin.players[1].totalScore, 0);
  assert.equal(tin.players[1].badgeCharges, 1);
  const gold = startBadgeRoom('headstart', 'doubling', 'gold');
  assert.equal(gold.players[0].totalScore, 1000);
  assert.equal(gold.players[1].badgeCharges, 3);
  const snap = gold.toSnapshot();
  assert.equal(snap.players[1].badge, 'doubling');
  assert.equal(snap.players[1].badgeCharges, 3);
  assert.equal(snap.players[1].badgeTier, 'gold');
  const def = startBadgeRoom('defence', 'emperor', 'silver');
  assert.equal(def.players[0].shield, 2);
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

function readyTable(room, dice) {
  room.turn.awaitingFirstRoll = false;
  room.turn.diceOnTable = [...dice];
  room.turn.diceTypeIds = dice.map(() => 'normal');
}

test('room: fortune rerolls up to its tier\'s number of chosen dice', () => {
  const room = startBadgeRoom('fortune', 'headstart', 'silver');
  const me = room.players[0];
  readyTable(room, [1, 2, 3, 4, 6, 6]);
  room.handleMessage(me, { type: 'activate_badge', payload: { diceIndices: [1, 2, 3] } });
  assert.deepEqual(errorsOf(me), ['badge_needs_dice']);
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.deepEqual(errorsOf(me), ['badge_needs_dice', 'badge_needs_dice']);
  room.handleMessage(me, { type: 'activate_badge', payload: { diceIndices: [4, 5] } });
  assert.equal(me.badgeCharges, 0);
  const entry = me.badgeLog[0];
  assert.deepEqual(entry.diceIndices, [4, 5]);
  assert.deepEqual(entry.from, [6, 6]);
  assert.deepEqual(room.turn.diceOnTable.slice(0, 4), [1, 2, 3, 4]);
  assert.deepEqual(entry.to, room.turn.diceOnTable.slice(4));
});

test('room: wedding rerolls up to three dice at any tier', () => {
  const room = startBadgeRoom('wedding', 'headstart', 'tin');
  const me = room.players[0];
  readyTable(room, [1, 2, 3, 4, 6, 6]);
  room.handleMessage(me, { type: 'activate_badge', payload: { diceIndices: [1, 2, 3] } });
  assert.deepEqual(errorsOf(me), []);
  assert.equal(me.badgeLog[0].to.length, 3);
});

test('room: might adds a seventh die for the whole turn, hot dice included', () => {
  const room = startBadgeRoom('might', 'headstart', 'silver');
  const me = room.players[0];
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.equal(room.turn.extraDice, 1);
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.deepEqual(errorsOf(me), ['badge_already_armed']);
  room.handleMessage(me, { type: 'roll' });
  assert.equal(room.turn.diceOnTable.length, 7);
  assert.equal(room.turn.diceTypeIds.length, 7);
  // After the roll it can no longer be used this turn.
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.ok(errorsOf(me).includes('badge_needs_turn_start'));
  // Hold all seven (seven ones) -> hot dice brings seven fresh dice.
  if (room.farkleTimer) { clearTimeout(room.farkleTimer); room.farkleTimer = null; }
  readyTable(room, [1, 1, 1, 1, 1, 1, 1]);
  room.turn.extraDice = 1;
  room.handleMessage(me, { type: 'score_and_roll', payload: { selection: [0, 1, 2, 3, 4, 5, 6] } });
  assert.equal(room.turn.roundScore, 16000);
  assert.equal(room.turn.diceOnTable.length, 7);
  if (room.farkleTimer) clearTimeout(room.farkleTimer);
});

test('room: bird king gives two seventh-die turns at any tier', () => {
  const room = startBadgeRoom('bird_king', 'headstart', 'tin');
  assert.equal(room.players[0].badgeCharges, 2);
});

test('room: warlord grows the banked round by its tier, rounded to 50', () => {
  const room = startBadgeRoom('warlord', 'headstart', 'silver');
  const me = room.players[0];
  readyTable(room, [1, 5, 2, 3, 4, 6]);
  room.turn.roundScore = 250;
  room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.equal(room.turn.bankMultiplier, 1.5);
  room.handleMessage(me, { type: 'score_and_bank', payload: { selection: [0, 1] } });
  // (250 + 150) * 1.5 = 600
  assert.equal(me.totalScore, 600);
  assert.equal(room.history.find((h) => h.type === 'banked').multiplier, 1.5);

  const gold = startBadgeRoom('warlord', 'headstart', 'gold');
  const g = gold.players[0];
  readyTable(gold, [5, 2, 3, 4, 6, 6]);
  gold.turn.roundScore = 75;
  gold.handleMessage(g, { type: 'activate_badge', payload: {} });
  gold.handleMessage(g, { type: 'score_and_bank', payload: { selection: [0] } });
  assert.equal(g.totalScore, 250);
});

test('room: emperor banks 2000 for three ones', () => {
  const room = startBadgeRoom('emperor', 'headstart');
  const me = room.players[0];
  readyTable(room, [1, 1, 1, 2, 3, 4]);
  room.handleMessage(me, { type: 'score_and_bank', payload: { selection: [0, 1, 2] } });
  assert.deepEqual(errorsOf(me), []);
  assert.equal(me.totalScore, 2000);
});

test('room: gold defence burns three activations', () => {
  const room = startBadgeRoom('doubling', 'defence', 'gold');
  const [me, opp] = room.players;
  readyTable(room, [1, 2, 3, 4, 6, 6]);
  for (let i = 0; i < 3; i++) room.handleMessage(me, { type: 'activate_badge', payload: {} });
  assert.equal(me.badgeCharges, 0);
  assert.equal(opp.shield, 0);
  assert.equal(room.turn.doubleArmed, false);
  assert.equal(me.badgeLog.filter((e) => e.type === 'badge_blocked').length, 3);
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
  const room = startBadgeRoom('resurrection', 'headstart', 'silver');
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
function playBotGame(badges, target = GAME_MODES.badge.defaultTarget, tier = 'tin') {
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
    room.settings = { mode: 'badge', targetScore: target, tier };
    room._startGame();
    const guard = setTimeout(() => {
      driver.cancel();
      reject(new Error(`game did not finish: ${JSON.stringify({ badges, turn: room.turn, last: room.history.slice(-3) })}`));
    }, 10_000);
    const done = resolve;
    resolve = (r) => { clearTimeout(guard); done(r); };
  });
}

test('room: bot-vs-bot badge games always finish at every tier, every badge gets used', async () => {
  const used = new Set();
  for (const tier of BADGE_TIERS) for (const b of BADGES) {
    const games = b.kind === 'active' ? 4 : 1;
    for (let i = 0; i < games; i++) {
      const room = await playBotGame([b.id, 'headstart'], GAME_MODES.badge.defaultTarget, tier);
      assert.equal(room.phase, 'finished');
      for (const p of room.players) for (const e of p.badgeLog) used.add(e.badgeId);
    }
  }
  for (const b of BADGES.filter((x) => x.kind === 'active')) assert.ok(used.has(b.id), `${b.id} never activated`);
});
