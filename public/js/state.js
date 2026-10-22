import { DEFAULT_LOADOUT, DICE_TYPES_MAP, validateLoadoutArray } from './engine/dice-types.js';
import { GAME_MODES, GAME_MODE_IDS, DEFAULT_GAME_MODE } from './engine/rules.js';
import { DEFAULT_BADGE, isValidBadge } from './engine/badges.js';

const MODE_STORAGE_KEY = 'kcd2_selected_mode';
const BADGE_STORAGE_KEY = 'kcd2_badge';
const LEGACY_LOADOUT_KEY = 'kcd2_loadout';
const loadoutKey = (mode) => `kcd2_loadout_${mode}`;
const diceKey = (snap) => (snap && snap.turn && snap.turn.diceOnTable ? snap.turn.diceOnTable.join(',') : '');

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export class Store {
  constructor() {
    this.state = null;
    this.selection = new Set();
    this.opponentSelection = new Set();
    this.myPlayerId = null;
    this.connected = false;
    this.lastEvent = null;
    this.rolling = false;
    this._rollingStartedAt = 0;
    this.listeners = [];
    this.loadouts = this._loadLoadouts();
    this._selectedMode = this._loadSelectedMode();
    this.myBadge = this._loadBadge();
    this.badgeTargeting = false;
    this.badgePulse = null;
    this.badgeFx = null;
    this.onBadgeTarget = null;
  }

  _loadBadge() {
    try {
      const saved = localStorage.getItem(BADGE_STORAGE_KEY);
      if (isValidBadge(saved)) return saved;
    } catch {}
    return DEFAULT_BADGE;
  }

  setBadge(id) {
    if (!isValidBadge(id)) return;
    this.myBadge = id;
    try { localStorage.setItem(BADGE_STORAGE_KEY, id); } catch {}
    this._notify();
  }

  setBadgeTargeting(on) {
    this.badgeTargeting = on;
    this._notify();
  }

  // Short-lived visual effects after a badge fires: pulse the owner's medallion, mark the touched die.
  flashBadge(playerId, diceIndex = null, ms = 900) {
    const until = Date.now() + ms;
    this.badgePulse = { playerId, until };
    this.badgeFx = Number.isInteger(diceIndex) ? { diceIndex, until } : null;
    this._notify();
    setTimeout(() => this._notify(), ms + 20);
  }

  // Each mode keeps its own set of dice so switching modes never loses a pocket loadout.
  _loadLoadouts() {
    const out = {};
    for (const mode of GAME_MODE_IDS) {
      const arr = readJson(loadoutKey(mode));
      out[mode] = validateLoadoutArray(arr, mode) ? arr : [...DEFAULT_LOADOUT];
    }
    const legacy = readJson(LEGACY_LOADOUT_KEY);
    if (legacy && readJson(loadoutKey('pocket')) === null && readJson(loadoutKey('classic')) === null) {
      const target = Array.isArray(legacy) && legacy.some((id) => DICE_TYPES_MAP[id] && DICE_TYPES_MAP[id].special) ? 'pocket' : 'classic';
      if (validateLoadoutArray(legacy, target)) {
        out[target] = legacy;
        try { localStorage.setItem(loadoutKey(target), JSON.stringify(legacy)); } catch {}
      }
    }
    return out;
  }

  _loadSelectedMode() {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved && GAME_MODES[saved]) return saved;
    } catch {}
    return DEFAULT_GAME_MODE;
  }

  setSelectedMode(mode) {
    if (!GAME_MODES[mode]) return;
    this._selectedMode = mode;
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch {}
    this._notify();
  }

  setRolling(v) {
    this.rolling = v;
    if (v) this._rollingStartedAt = Date.now();
    this._notify();
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  _notify() {
    for (const fn of this.listeners) fn();
  }

  setSnapshot(snapshot) {
    // Mode is a shared lobby setting: follow the server so loadout and texts match the game that will start.
    if (snapshot && snapshot.settings && GAME_MODES[snapshot.settings.mode] && snapshot.settings.mode !== this._selectedMode) {
      this._selectedMode = snapshot.settings.mode;
      try { localStorage.setItem(MODE_STORAGE_KEY, this._selectedMode); } catch {}
    }
    const prevDice = diceKey(this.state);
    const newDice = diceKey(snapshot);
    const prevPlayer = this.state ? this.state.currentPlayerId : undefined;
    const newPlayer = snapshot ? snapshot.currentPlayerId : undefined;
    if (prevDice !== newDice || prevPlayer !== newPlayer) {
      this.selection.clear();
      this.opponentSelection.clear();
      this.badgeTargeting = false;
    }
    if (prevPlayer !== newPlayer || !snapshot || snapshot.phase !== 'playing') {
      this.rolling = false;
    }
    if (this.rolling && this._rollingStartedAt && Date.now() - this._rollingStartedAt > 3000) {
      this.rolling = false;
    }
    this.state = snapshot;
    this._notify();
  }

  setConnected(v) {
    this.connected = v;
    this._notify();
  }

  setMyPlayerId(id) {
    this.myPlayerId = id;
    this._notify();
  }

  setLastEvent(ev) {
    this.lastEvent = ev;
  }

  toggleSelection(idx) {
    if (this.selection.has(idx)) this.selection.delete(idx);
    else this.selection.add(idx);
    this._notify();
  }

  clearSelection() {
    this.selection.clear();
    this._notify();
  }

  getSelectionArray() {
    return [...this.selection].sort((a, b) => a - b);
  }

  setOpponentSelection(indices) {
    this.opponentSelection.clear();
    for (const i of indices) this.opponentSelection.add(i);
    this._notify();
  }

  setLoadoutSlot(slotIdx, diceTypeId, mode = this._selectedMode) {
    if (slotIdx < 0 || slotIdx >= 6) return false;
    const next = this.getLoadout(mode);
    next[slotIdx] = diceTypeId;
    if (!validateLoadoutArray(next, mode)) return false;
    this.loadouts[mode] = next;
    try { localStorage.setItem(loadoutKey(mode), JSON.stringify(next)); } catch {}
    this._notify();
    return true;
  }

  getLoadout(mode = this._selectedMode) {
    return [...(this.loadouts[mode] || DEFAULT_LOADOUT)];
  }

  isMyTurn() {
    return !!this.state && this.state.phase === 'playing' && this.state.currentPlayerId === this.myPlayerId;
  }
}
