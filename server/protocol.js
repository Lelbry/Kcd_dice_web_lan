import { MAX_DICE, GAME_MODES, GAME_MODE_IDS } from './engine/rules.js';
import { validateLoadoutArray } from './engine/dice-types.js';
import { isValidBadge, BADGE_TIERS } from './engine/badges.js';

export const ClientMsg = {
  HELLO: 'hello',
  CREATE_LOBBY: 'create_lobby',
  JOIN_LOBBY: 'join_lobby',
  START_GAME: 'start_game', // retired: the game starts when both players are ready
  SET_SETTINGS: 'set_settings',
  SET_READY: 'set_ready',
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

// Lobby settings change: any subset of mode / targetScore / tier, merged onto current settings.
// A target that does not fit the (new) mode falls back to that mode's default target.
export function validateSettings(payload, current) {
  if (!payload || typeof payload !== 'object') return null;
  const out = { mode: current.mode, targetScore: current.targetScore, tier: current.tier };
  if (payload.mode !== undefined) {
    if (!GAME_MODE_IDS.includes(payload.mode)) return null;
    out.mode = payload.mode;
  }
  if (payload.tier !== undefined) {
    if (!BADGE_TIERS.includes(payload.tier)) return null;
    out.tier = payload.tier;
  }
  const cfg = GAME_MODES[out.mode];
  if (payload.targetScore !== undefined) {
    if (!cfg.targets.includes(payload.targetScore)) return null;
    out.targetScore = payload.targetScore;
  }
  if (!cfg.targets.includes(out.targetScore)) out.targetScore = cfg.defaultTarget;
  return out;
}

export function validateSetReady(payload) {
  return typeof payload?.ready === 'boolean' ? { ready: payload.ready } : null;
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
  if (sel.length === 0 || sel.length > MAX_DICE) return null;
  if (!sel.every((i) => Number.isInteger(i) && i >= 0 && i < MAX_DICE)) return null;
  if (new Set(sel).size !== sel.length) return null;
  return { selection: sel };
}

export function validateSetBadge(payload) {
  return isValidBadge(payload?.badgeId) ? { badgeId: payload.badgeId } : null;
}

// {diceIndex} for one-die badges, {diceIndices} for the reroll badges, nothing for the rest.
export function validateActivateBadge(payload) {
  const idx = payload?.diceIndex;
  const list = payload?.diceIndices;
  const isIdx = (i) => Number.isInteger(i) && i >= 0 && i < MAX_DICE;
  if (list !== undefined && list !== null) {
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_DICE || !list.every(isIdx)) return null;
    if (new Set(list).size !== list.length) return null;
    return { diceIndex: null, diceIndices: [...list] };
  }
  if (idx === undefined || idx === null) return { diceIndex: null, diceIndices: null };
  if (!isIdx(idx)) return null;
  return { diceIndex: idx, diceIndices: null };
}
