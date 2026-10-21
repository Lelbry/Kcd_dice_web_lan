import { DEFAULT_LOADOUT, DICE_TYPES_MAP, validateLoadoutArray } from './engine/dice-types.js';
import { GAME_MODES, GAME_MODE_IDS, DEFAULT_GAME_MODE } from './engine/rules.js';

const MODE_STORAGE_KEY = 'kcd2_selected_mode';
const LEGACY_LOADOUT_KEY = 'kcd2_loadout';
const loadoutKey = (mode) => `kcd2_loadout_${mode}`;

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
      const target = legacy.some?.((id) => DICE_TYPES_MAP[id]?.special) ? 'pocket' : 'classic';
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
    const prevDice = this.state?.turn?.diceOnTable?.join(',') ?? '';
    const newDice = snapshot?.turn?.diceOnTable?.join(',') ?? '';
    const prevPlayer = this.state?.currentPlayerId;
    const newPlayer = snapshot?.currentPlayerId;
    if (prevDice !== newDice || prevPlayer !== newPlayer) {
      this.selection.clear();
      this.opponentSelection.clear();
    }
    if (prevPlayer !== newPlayer || snapshot?.phase !== 'playing') {
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
    return this.state?.phase === 'playing' && this.state.currentPlayerId === this.myPlayerId;
  }
}
