// Lobby: shared settings, ready check and the start countdown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../server/room.js';
import { GAME_MODES } from '../server/engine/rules.js';

function socket() {
  const sent = [];
  return { sent, send: (m) => sent.push(JSON.parse(m)) };
}

function room(opts = {}) {
  return new GameRoom({ startCountdownMs: 0, ...opts });
}

function join(r, clientId) {
  return r.addPlayer(clientId, clientId, socket()).player;
}

const errorsOf = (p) => p.socket.sent.filter((m) => m.type === 'error').map((m) => m.payload.code);
const ready = (r, p, value = true) => r.handleMessage(p, { type: 'set_ready', payload: { ready: value } });
const settings = (r, p, payload) => r.handleMessage(p, { type: 'set_settings', payload });
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

test('two humans: nothing starts until both are ready, then the lobby settings are used', () => {
  const r = room();
  const a = join(r, 'a');
  const b = join(r, 'b');
  settings(r, a, { mode: 'pocket', targetScore: 6000 });
  ready(r, a);
  assert.equal(r.phase, 'lobby');
  assert.equal(r.toSnapshot().players.find((p) => p.id === a.id).ready, true);
  ready(r, b);
  assert.equal(r.phase, 'playing');
  assert.equal(r.gameMode, 'pocket');
  assert.equal(r.targetScore, 6000);
});

test('ready needs a second player; with a bot the game starts as soon as the human is ready', () => {
  const r = room({ startCountdownMs: 5000 });
  const a = join(r, 'a');
  ready(r, a);
  assert.deepEqual(errorsOf(a), ['need_two_players']);
  r.addBot();
  assert.equal(r.phase, 'lobby');
  ready(r, a);
  assert.equal(r.phase, 'playing');
});

test('the countdown runs, and backing out, leaving or changing settings cancels it', async () => {
  const r = room({ startCountdownMs: 40 });
  const a = join(r, 'a');
  const b = join(r, 'b');
  ready(r, a);
  ready(r, b);
  const snap = r.toSnapshot();
  assert.equal(snap.phase, 'lobby');
  assert.ok(snap.countdownMs > 0 && snap.countdownMs <= 40);

  ready(r, b, false);
  assert.equal(r.toSnapshot().countdownMs, null);
  await wait(60);
  assert.equal(r.phase, 'lobby');

  ready(r, b);
  settings(r, a, { targetScore: 3000 });
  assert.equal(r.toSnapshot().countdownMs, null);
  assert.equal(a.ready, false);
  assert.equal(b.ready, false);

  ready(r, a);
  ready(r, b);
  r.removePlayer('b');
  assert.equal(r.toSnapshot().countdownMs, null);
  await wait(60);
  assert.equal(r.phase, 'lobby');
  r.addPlayer('b', 'b', socket());
  ready(r, b);
  await wait(60);
  assert.equal(r.phase, 'playing');
});

test('changing your dice or badge clears your own ready only', () => {
  const r = room({ startCountdownMs: 5000 });
  const a = join(r, 'a');
  const b = join(r, 'b');
  ready(r, a);
  ready(r, b);
  r.handleMessage(a, { type: 'set_loadout', payload: { loadout: ['tooth', 'normal', 'normal', 'normal', 'normal', 'normal'], mode: 'classic' } });
  assert.equal(a.ready, false);
  assert.equal(b.ready, true);
  ready(r, a);
  r.handleMessage(b, { type: 'set_badge', payload: { badgeId: 'headstart' } });
  assert.equal(b.ready, false);
  // Sending the same loadout again (clients do on reconnect) keeps ready.
  ready(r, b);
  r.handleMessage(b, { type: 'set_badge', payload: { badgeId: 'headstart' } });
  assert.equal(b.ready, true);
  r._cancelCountdown();
});

test('settings: bad values are refused, a target that does not fit the new mode resets to its default', () => {
  const r = room();
  const a = join(r, 'a');
  settings(r, a, { mode: 'nope' });
  settings(r, a, { tier: 'platinum' });
  settings(r, a, { targetScore: 12345 });
  assert.deepEqual(errorsOf(a), ['bad_settings', 'bad_settings', 'bad_settings']);
  settings(r, a, { targetScore: 10000 });
  settings(r, a, { mode: 'badge', tier: 'gold' });
  assert.deepEqual(r.toSnapshot().settings, { mode: 'badge', targetScore: GAME_MODES.badge.defaultTarget, tier: 'gold' });
});

test('start_game is retired', () => {
  const r = room();
  const a = join(r, 'a');
  join(r, 'b');
  r.handleMessage(a, { type: 'start_game', payload: { mode: 'classic', targetScore: 2000 } });
  assert.equal(r.phase, 'lobby');
  assert.deepEqual(errorsOf(a), ['use_ready']);
});

test('removing a bot keeps the human id (the client only learns it once)', () => {
  const r = room();
  r.players.push({ id: 'p0', clientId: 'x', isBot: true, connected: true, ready: true });
  const a = join(r, 'a');
  assert.equal(a.id, 'p1');
  r.removeBot();
  assert.equal(a.id, 'p1');
  r.addBot();
  assert.deepEqual(r.players.map((p) => p.id).sort(), ['p0', 'p1']);
});

test('after a game everyone is back to not ready; bots stay ready', () => {
  const r = room();
  const a = join(r, 'a');
  r.addBot();
  ready(r, a);
  assert.equal(r.phase, 'playing');
  r.phase = 'finished';
  r.handleMessage(a, { type: 'new_game' });
  assert.equal(r.phase, 'lobby');
  assert.equal(a.ready, false);
  assert.equal(r.players.find((p) => p.isBot).ready, true);
  assert.equal(r.settings.mode, 'classic');
});
