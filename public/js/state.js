import { DEFAULT_LOADOUT, MAX_SPECIAL_DICE, DICE_TYPES_MAP } from './engine/dice-types.js';
import { GAME_MODES, DEFAULT_GAME_MODE } from './engine/rules.js';

const MODE_STORAGE_KEY = 'kcd2_selected_mode';

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
    this.myLoadout = [...DEFAULT_LOADOUT];
    this._loadLoadout();
    this._selectedMode = this._loadSelectedMode();
  }

  _loadLoadout() {
    try {
      const raw = localStorage.getItem('kcd2_loadout');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 6 && arr.every((id) => DICE_TYPES_MAP[id])) {
          const specials = arr.filter((id) => DICE_TYPES_MAP[id]?.special).length;
          if (specials <= MAX_SPECIAL_DICE) this.myLoadout = arr;
        }
      }
    } catch {}
  }

  _saveLoadout() {
    try { localStorage.setItem('kcd2_loadout', JSON.stringify(this.myLoadout)); } catch {}
  }

  _loadSelectedMode() {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved && GAME_MODES[saved]) return saved;
    } catch {}
    // Если loadout содержит специальные кости — явный сигнал, что игрок хочет pocket.
    const hasSpecial = this.myLoadout.some((id) => DICE_TYPES_MAP[id]?.special);
    return hasSpecial ? 'pocket' : DEFAULT_GAME_MODE;
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

  setLoadoutSlot(slotIdx, diceTypeId) {
    if (slotIdx < 0 || slotIdx >= 6) return false;
    if (!DICE_TYPES_MAP[diceTypeId]) return false;
    const next = [...this.myLoadout];
    next[slotIdx] = diceTypeId;
    const specials = next.filter((id) => DICE_TYPES_MAP[id]?.special).length;
    if (specials > MAX_SPECIAL_DICE) return false;
    this.myLoadout = next;
    this._saveLoadout();
    this._notify();
    return true;
  }

  getLoadout() {
    return [...this.myLoadout];
  }

  isMyTurn() {
    return this.state?.phase === 'playing' && this.state.currentPlayerId === this.myPlayerId;
  }
}
