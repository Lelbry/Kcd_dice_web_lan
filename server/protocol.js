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
  PONG: 'pong',
};

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
  return { name, clientId };
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
