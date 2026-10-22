import { randomInt } from 'node:crypto';
import { GameRoom } from './room.js';
import { BotDriver } from './bot.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const EMPTY_LOBBY_TTL_MS = 10 * 60 * 1000;

// KCD_BOT_SPEED=4 makes bots think 4x faster (used by the e2e tests); unset in production.
function botTiming() {
  const speed = Number(process.env.KCD_BOT_SPEED) || 1;
  if (speed === 1) return {};
  const t = (ms) => Math.round(ms / speed);
  return {
    firstRollDelayMinMs: t(600), firstRollDelayMaxMs: t(1200),
    postRollDelayMinMs: t(2500), postRollDelayMaxMs: t(3500), previewMs: t(1000),
  };
}

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(0, CODE_CHARS.length)];
  }
  return code;
}

export class LobbyManager {
  constructor() {
    this.lobbies = new Map();
  }

  create() {
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (this.lobbies.has(code) && attempts < 100);
    if (this.lobbies.has(code)) return null;

    const room = new GameRoom();
    const botDriver = new BotDriver(room, botTiming());
    room.setStateChangedHandler(() => botDriver.tick());

    const entry = { room, botDriver, code, createdAt: Date.now(), cleanupTimer: null };
    room.onEmpty = () => this._scheduleCleanup(code);
    this.lobbies.set(code, entry);
    return entry;
  }

  get(code) {
    return this.lobbies.get(code?.toUpperCase()) || null;
  }

  _scheduleCleanup(code) {
    const entry = this.lobbies.get(code);
    if (!entry) return;
    if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
    entry.cleanupTimer = setTimeout(() => {
      if (entry.room.players.length === 0) {
        entry.botDriver.cancel();
        this.lobbies.delete(code);
      }
    }, EMPTY_LOBBY_TTL_MS);
  }

  stats() {
    return { lobbies: this.lobbies.size };
  }
}
