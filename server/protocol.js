import { TARGET_OPTIONS, DICE_COUNT } from './engine/rules.js';

export const ClientMsg = {
  HELLO: 'hello',
  START_GAME: 'start_game',
  ROLL: 'roll',
  SCORE_AND_ROLL: 'score_and_roll',
  SCORE_AND_BANK: 'score_and_bank',
  NEW_GAME: 'new_game',
  ADD_BOT: 'add_bot',
  REMOVE_BOT: 'remove_bot',
  SET_PROFILE: 'set_profile',
  PONG: 'pong',
};

export const RoomAction = {
  CREATE: 'create',
  JOIN: 'join',
};

// Должен совпадать с алфавитом в room-manager.js.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LEN = 5;
export const ROOM_CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LEN}}$`);

export const DEFAULT_DICE_COLOR = '#f4e8c1';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(s) {
  return typeof s === 'string' && HEX_COLOR_RE.test(s);
}

export const ServerMsg = {
  STATE: 'state',
  EVENT: 'event',
  ERROR: 'error',
  PING: 'ping',
};

export function parseMessage(raw) {
  try {
    const msg = JSON.parse(raw);
    if (typeof msg !== 'object' || msg === null) return null;
    if (typeof msg.type !== 'string') return null;
    return msg;
  } catch {
    return null;
  }
}

export function validateHello(payload) {
  if (typeof payload?.name !== 'string') return null;
  if (typeof payload?.clientId !== 'string') return null;
  const name = payload.name.trim().slice(0, 20) || 'Player';
  const clientId = payload.clientId.trim().slice(0, 64);
  if (!clientId) return null;
  const color = isValidHexColor(payload?.color) ? payload.color : DEFAULT_DICE_COLOR;

  const roomAction = payload?.roomAction;
  if (roomAction !== RoomAction.CREATE && roomAction !== RoomAction.JOIN) return null;

  let roomCode = null;
  if (roomAction === RoomAction.JOIN) {
    if (typeof payload?.roomCode !== 'string') return null;
    roomCode = payload.roomCode.trim().toUpperCase();
    if (!ROOM_CODE_RE.test(roomCode)) return null;
  }

  return { name, clientId, color, roomAction, roomCode };
}

export function validateSetProfile(payload) {
  const out = {};
  if (typeof payload?.name === 'string') {
    const n = payload.name.trim().slice(0, 20);
    if (n) out.name = n;
  }
  if (isValidHexColor(payload?.color)) {
    out.color = payload.color;
  }
  return Object.keys(out).length === 0 ? null : out;
}

export function validateStartGame(payload) {
  const t = payload?.targetScore;
  if (!TARGET_OPTIONS.includes(t)) return null;
  return { targetScore: t };
}

export function validateSelection(payload) {
  const sel = payload?.selection;
  if (!Array.isArray(sel)) return null;
  if (sel.length === 0 || sel.length > DICE_COUNT) return null;
  if (!sel.every((i) => Number.isInteger(i) && i >= 0 && i < DICE_COUNT)) return null;
  if (new Set(sel).size !== sel.length) return null;
  return { selection: sel };
}
