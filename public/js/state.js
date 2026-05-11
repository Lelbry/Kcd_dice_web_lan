export class Store {
  constructor() {
    this.state = null;
    this.selection = new Set();
    this.myPlayerId = null;
    this.connected = false;
    this.lastEvent = null;
    this.rolling = false;
    this.listeners = [];
  }

  setRolling(v) {
    this.rolling = v;
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
    if (prevDice !== newDice) {
      this.selection.clear();
    }
    if (snapshot?.phase !== 'playing') {
      this.selection.clear();
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
    this._notify();
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

  isMyTurn() {
    return this.state?.phase === 'playing' && this.state.currentPlayerId === this.myPlayerId;
  }
}
