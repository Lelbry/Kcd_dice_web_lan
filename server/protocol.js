import { TARGET_OPTIONS, DICE_COUNT, GAME_MODES, GAME_MODE_IDS, DEFAULT_GAME_MODE } from './engine/rules.js';
import { validateLoadoutArray } from './engine/dice-types.js';
import { isValidBadge } from './engine/badges.js';

export const ClientMsg = {
  HELLO: 'hello',
  CREATE_LOBBY: 'create_lobby',
  JOIN_LOBBY: 'join_lobby',
  START_GAME: 'start_game',
  ROLL: 'roll',
  SCORE_AND_ROLL: 'score_and_roll',
  SCORE_AND_BANK: 'score_and_bank',
  NEW_GAME: 'new_game',
  ADD_BOT: 'add_bot',
  REMOVE_BOT: 'remove_bot',
  SET_PROFILE: 'set_profile',
  SET_LOADOUT: 'set_loadout',
  SURRENDER: 'surrender',
  SELECT_PREVIEW: 'select_preview',
  SET_BADGE: 'set_badge',
  ACTIVATE_BADGE: 'activate_badge',
  PONG: 'pong',
};

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
  LOBBY_INFO: 'lobby_info',
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
  return { name, clientId, color };
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
  const mode = GAME_MODE_IDS.includes(payload?.mode) ? payload.mode : DEFAULT_GAME_MODE;
  const modeCfg = GAME_MODES[mode];
  const t = payload?.targetScore;
  if (!modeCfg.targets.includes(t)) return null;
  return { targetScore: t, mode };
}

export function validateLoadout(payload) {
  const mode = GAME_MODE_IDS.includes(payload?.mode) ? payload.mode : 'pocket';
  const loadout = validateLoadoutArray(payload?.loadout, mode);
  if (!loadout) return null;
  return { loadout: [...loadout], mode };
}

export function validateSelection(payload) {
  const sel = payload?.selection;
  if (!Array.isArray(sel)) return null;
  if (sel.length === 0 || sel.length > DICE_COUNT) return null;
  if (!sel.every((i) => Number.isInteger(i) && i >= 0 && i < DICE_COUNT)) return null;
  if (new Set(sel).size !== sel.length) return null;
  return { selection: sel };
}

export function validateSetBadge(payload) {
  return isValidBadge(payload?.badgeId) ? { badgeId: payload.badgeId } : null;
}

export function validateActivateBadge(payload) {
  const idx = payload?.diceIndex;
  if (idx === undefined || idx === null) return { diceIndex: null };
  if (!Number.isInteger(idx) || idx < 0 || idx >= DICE_COUNT) return null;
  return { diceIndex: idx };
}
