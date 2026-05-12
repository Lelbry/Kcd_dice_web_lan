import { randomInt } from 'node:crypto';
import { DICE_COUNT, DEFAULT_TARGET } from './engine/rules.js';
import { canHold, canBank, checkWin, isFarkle } from './engine/validate.js';
import {
  ServerMsg,
  ClientMsg,
  validateHello,
  validateStartGame,
  validateSelection,
} from './protocol.js';
import { rollBotPersona, moodLabel } from './bot.js';

const FARKLE_PASS_DELAY_MS = 1800;
const RECONNECT_GRACE_MS = 60_000;
const HISTORY_LIMIT = 50;
const MAX_PLAYERS = 2;

function rollDice(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = randomInt(1, 7);
  return out;
}

export class GameRoom {
  constructor() {
    this.phase = 'lobby';
    this.targetScore = DEFAULT_TARGET;
    this.players = [];
    this.currentPlayerIdx = 0;
    this.turn = this._emptyTurn();
    this.winnerId = null;
    this.history = [];
    this.farkleTimer = null;
    this._onStateChanged = null;
  }

  /** Зарегистрировать коллбэк, который вызывается после каждого broadcast state. */
  setStateChangedHandler(fn) {
    this._onStateChanged = fn;
  }

  _emptyTurn() {
    return {
      awaitingFirstRoll: true,
      diceOnTable: [],
      lockedDice: [],
      roundScore: 0,
      isFarkle: false,
      isHotDice: false,
    };
  }

  addPlayer(clientId, name, socket) {
    const existing = this.players.find((p) => p.clientId === clientId);
    if (existing) {
      if (existing.releaseTimer) {
        clearTimeout(existing.releaseTimer);
        existing.releaseTimer = null;
      }
      existing.socket = socket;
      existing.connected = true;
      if (name) existing.name = name;
      this._broadcastState();
      this._sendTo(existing, { type: ServerMsg.EVENT, payload: { type: 'reconnected', playerId: existing.id } });
      return { player: existing, isNew: false };
    }
    if (this.players.length >= MAX_PLAYERS) {
      return { player: null, isNew: false, error: 'room_full' };
    }
    const id = `p${this.players.length}`;
    const player = {
      id,
      clientId,
      name: name || `Player ${this.players.length + 1}`,
      socket,
      connected: true,
      totalScore: 0,
      releaseTimer: null,
      isBot: false,
    };
    this.players.push(player);
    this._broadcastState();
    return { player, isNew: true };
  }

  /** Добавить виртуального игрока-бота. Только в lobby и если слот свободен. */
  addBot() {
    if (this.phase !== 'lobby') return { ok: false, error: 'not_in_lobby' };
    if (this.players.length >= MAX_PLAYERS) return { ok: false, error: 'room_full' };
    if (!this.players.some((p) => !p.isBot)) return { ok: false, error: 'need_human_first' };

    const id = `p${this.players.length}`;
    const persona = rollBotPersona(Math.random, this._currentBotNames());
    const bot = {
      id,
      clientId: `bot:${id}:${Date.now()}`,
      name: persona.firstName,
      firstName: persona.firstName,
      mood: persona.mood,
      socket: null,
      connected: true,
      totalScore: 0,
      releaseTimer: null,
      isBot: true,
    };
    this.players.push(bot);
    this._broadcastState();
    return { ok: true, bot };
  }

  /** Убрать всех ботов из лобби. Только в lobby. */
  removeBot() {
    if (this.phase !== 'lobby') return { ok: false, error: 'not_in_lobby' };
    const before = this.players.length;
    this.players = this.players.filter((p) => !p.isBot);
    // Переиндексировать оставшихся игроков (id pX по позиции).
    this.players.forEach((p, idx) => {
      p.id = `p${idx}`;
    });
    if (this.players.length !== before) {
      this._broadcastState();
      return { ok: true };
    }
    return { ok: false, error: 'no_bot' };
  }

  _currentBotNames() {
    return this.players.filter((p) => p.isBot).map((p) => p.firstName);
  }

  removePlayer(clientId, { immediate = false } = {}) {
    const player = this.players.find((p) => p.clientId === clientId);
    if (!player) return;
    player.connected = false;
    player.socket = null;
    if (immediate) {
      this.players = this.players.filter((p) => p !== player);
      this._broadcastState();
      return;
    }
    if (player.releaseTimer) clearTimeout(player.releaseTimer);
    player.releaseTimer = setTimeout(() => {
      this.players = this.players.filter((p) => p !== player);
      if (this.phase === 'playing') {
        this.phase = 'lobby';
        this.turn = this._emptyTurn();
        this.history.push({ ts: Date.now(), type: 'aborted', reason: 'player_left' });
      }
      this._broadcastState();
    }, RECONNECT_GRACE_MS);
    this._broadcastState();
  }

  handleMessage(player, msg) {
    if (!msg || typeof msg.type !== 'string') {
      return this._sendError(player, 'bad_message');
    }

    if (msg.type === ClientMsg.PONG) return;

    if (this.phase === 'lobby') {
      if (msg.type === ClientMsg.START_GAME) return this._startGame(player, msg.payload);
      if (msg.type === ClientMsg.ADD_BOT) {
        const r = this.addBot();
        if (!r.ok) return this._sendError(player, r.error || 'cannot_add_bot');
        return;
      }
      if (msg.type === ClientMsg.REMOVE_BOT) {
        const r = this.removeBot();
        if (!r.ok) return this._sendError(player, r.error || 'cannot_remove_bot');
        return;
      }
      return this._sendError(player, 'not_in_lobby');
    }

    if (this.phase === 'finished') {
      if (msg.type === ClientMsg.NEW_GAME) return this._newGame(player);
      return this._sendError(player, 'game_finished');
    }

    if (this.phase === 'playing') {
      if (this.farkleTimer) {
        return this._sendError(player, 'wait_for_pass');
      }
      const current = this._currentPlayer();
      if (player.id !== current.id) {
        return this._sendError(player, 'not_your_turn');
      }
      switch (msg.type) {
        case ClientMsg.ROLL:
          return this._handleRoll(player);
        case ClientMsg.SCORE_AND_ROLL:
          return this._handleScoreAction(player, msg.payload, /* bank */ false);
        case ClientMsg.SCORE_AND_BANK:
          return this._handleScoreAction(player, msg.payload, /* bank */ true);
        default:
          return this._sendError(player, 'unknown_action');
      }
    }
  }

  _startGame(player, payload) {
    if (this.players.length < MAX_PLAYERS) {
      return this._sendError(player, 'need_two_players');
    }
    if (!this.players.every((p) => p.connected)) {
      return this._sendError(player, 'player_disconnected');
    }
    const v = validateStartGame(payload);
    if (!v) return this._sendError(player, 'invalid_target');
    this.targetScore = v.targetScore;
    for (const p of this.players) p.totalScore = 0;
    this._rerollBotPersonas();
    this.currentPlayerIdx = 0;
    this.turn = this._emptyTurn();
    this.winnerId = null;
    this.history = [];
    this.phase = 'playing';
    this._pushHistory({ type: 'game_started', targetScore: this.targetScore });
    this._broadcastState();
  }

  _newGame(player) {
    this.phase = 'lobby';
    this.winnerId = null;
    this.turn = this._emptyTurn();
    for (const p of this.players) p.totalScore = 0;
    this._rerollBotPersonas();
    this.history = [];
    this._broadcastState();
  }

  _rerollBotPersonas() {
    const usedNames = [];
    for (const p of this.players) {
      if (!p.isBot) continue;
      const persona = rollBotPersona(Math.random, usedNames);
      p.firstName = persona.firstName;
      p.mood = persona.mood;
      p.name = persona.firstName;
      usedNames.push(persona.firstName);
    }
  }

  _handleRoll(player) {
    if (!this.turn.awaitingFirstRoll) {
      return this._sendError(player, 'already_rolled');
    }
    this.turn.awaitingFirstRoll = false;
    this.turn.isHotDice = false;
    this.turn.isFarkle = false;
    this.turn.diceOnTable = rollDice(DICE_COUNT);
    this._pushHistory({ type: 'rolled', playerId: player.id, dice: [...this.turn.diceOnTable] });
    this._broadcastEvent({ type: 'rolled', playerId: player.id, dice: [...this.turn.diceOnTable] });
    if (isFarkle(this.turn.diceOnTable)) {
      this._triggerFarkle(player);
    } else {
      this._broadcastState();
    }
  }

  _handleScoreAction(player, payload, doBank) {
    if (this.turn.awaitingFirstRoll) {
      return this._sendError(player, 'must_roll_first');
    }
    const v = validateSelection(payload);
    if (!v) return this._sendError(player, 'invalid_selection');
    const sel = v.selection;
    if (sel.some((i) => i >= this.turn.diceOnTable.length)) {
      return this._sendError(player, 'invalid_index');
    }
    const hold = canHold(sel, this.turn.diceOnTable);
    if (!hold.ok) return this._sendError(player, `bad_hold:${hold.reason}`);

    const heldValues = sel.map((i) => this.turn.diceOnTable[i]);
    const remainingValues = this.turn.diceOnTable.filter((_, i) => !sel.includes(i));

    this.turn.roundScore += hold.score;
    this.turn.lockedDice = [...this.turn.lockedDice, ...heldValues];
    this.turn.diceOnTable = remainingValues;
    this._pushHistory({
      type: 'held',
      playerId: player.id,
      dice: heldValues,
      score: hold.score,
      roundScore: this.turn.roundScore,
    });

    if (doBank) {
      if (!canBank(this.turn.roundScore)) {
        return this._sendError(player, 'cannot_bank');
      }
      player.totalScore += this.turn.roundScore;
      const banked = this.turn.roundScore;
      this._pushHistory({ type: 'banked', playerId: player.id, score: banked, total: player.totalScore });
      this._broadcastEvent({ type: 'banked', playerId: player.id, score: banked, total: player.totalScore });
      if (checkWin(player.totalScore, this.targetScore)) {
        this.phase = 'finished';
        this.winnerId = player.id;
        this._pushHistory({ type: 'won', playerId: player.id });
        this._broadcastEvent({ type: 'won', playerId: player.id });
        this._broadcastState();
        return;
      }
      this._passTurn();
      return;
    }

    // score_and_roll
    if (this.turn.diceOnTable.length === 0) {
      this.turn.isHotDice = true;
      this.turn.lockedDice = [];
      this.turn.diceOnTable = rollDice(DICE_COUNT);
      this._pushHistory({ type: 'hot_dice', playerId: player.id });
      this._broadcastEvent({ type: 'hotdice', playerId: player.id, dice: [...this.turn.diceOnTable] });
    } else {
      this.turn.isHotDice = false;
      this.turn.diceOnTable = rollDice(this.turn.diceOnTable.length);
      this._broadcastEvent({ type: 'rolled', playerId: player.id, dice: [...this.turn.diceOnTable] });
    }

    if (isFarkle(this.turn.diceOnTable)) {
      this._triggerFarkle(player);
    } else {
      this._broadcastState();
    }
  }

  _triggerFarkle(player) {
    this.turn.isFarkle = true;
    const lostScore = this.turn.roundScore;
    this._pushHistory({ type: 'farkle', playerId: player.id, lostScore });
    this._broadcastEvent({ type: 'farkle', playerId: player.id, lostScore });
    this._broadcastState();
    this.farkleTimer = setTimeout(() => {
      this.farkleTimer = null;
      this._passTurn();
    }, FARKLE_PASS_DELAY_MS);
  }

  _passTurn() {
    this.currentPlayerIdx = (this.currentPlayerIdx + 1) % this.players.length;
    this.turn = this._emptyTurn();
    this._pushHistory({ type: 'turn_passed', toPlayerId: this._currentPlayer().id });
    this._broadcastState();
  }

  _currentPlayer() {
    return this.players[this.currentPlayerIdx];
  }

  _pushHistory(entry) {
    this.history.push({ ts: Date.now(), ...entry });
    if (this.history.length > HISTORY_LIMIT) {
      this.history.splice(0, this.history.length - HISTORY_LIMIT);
    }
  }

  _sendError(player, code) {
    this._sendTo(player, { type: ServerMsg.ERROR, payload: { code } });
  }

  _sendTo(player, msg) {
    if (!player?.socket || !player.connected) return;
    try {
      player.socket.send(JSON.stringify(msg));
    } catch {
      // ignore broken socket — close handler will mark disconnected
    }
  }

  _broadcastEvent(payload) {
    const msg = { type: ServerMsg.EVENT, payload };
    const data = JSON.stringify(msg);
    for (const p of this.players) {
      if (p.connected && p.socket) {
        try { p.socket.send(data); } catch { /* ignore */ }
      }
    }
  }

  _broadcastState() {
    const snapshot = this.toSnapshot();
    const msg = { type: ServerMsg.STATE, payload: snapshot };
    const data = JSON.stringify(msg);
    for (const p of this.players) {
      if (p.connected && p.socket) {
        try { p.socket.send(data); } catch { /* ignore */ }
      }
    }
    // Уведомить внешних подписчиков (например, BotDriver).
    try {
      this._onStateChanged?.();
    } catch (err) {
      console.error('[room] state callback failed:', err);
    }
  }

  toSnapshot() {
    const finished = this.phase === 'finished';
    return {
      phase: this.phase,
      targetScore: this.targetScore,
      players: this.players.map((p) => {
        const base = {
          id: p.id,
          name: p.name,
          connected: p.connected,
          totalScore: p.totalScore,
          isBot: !!p.isBot,
        };
        if (p.isBot && finished) {
          base.mood = p.mood;
          base.moodLabel = moodLabel(p.mood);
          base.fullName = `${p.firstName} ${moodLabel(p.mood)}`;
        }
        return base;
      }),
      currentPlayerId: this.phase === 'playing' ? this._currentPlayer()?.id : null,
      turn: { ...this.turn, diceOnTable: [...this.turn.diceOnTable], lockedDice: [...this.turn.lockedDice] },
      winnerId: this.winnerId,
      history: this.history.slice(-HISTORY_LIMIT),
    };
  }
}

export { validateHello };
