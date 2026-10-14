import { randomInt } from 'node:crypto';
import { DICE_COUNT, DEFAULT_TARGET, GAME_MODES, DEFAULT_GAME_MODE } from './engine/rules.js';
import { canHold, canBank, checkWin, isFarkle } from './engine/validate.js';
import {
  ServerMsg,
  ClientMsg,
  validateHello,
  validateStartGame,
  validateSelection,
  validateSetProfile,
  validateLoadout,
  DEFAULT_DICE_COLOR,
} from './protocol.js';
import { rollBotPersona, moodLabel, generateBotLoadout } from './bot.js';
import { DICE_TYPES_MAP, DEFAULT_LOADOUT, rollWeighted } from './engine/dice-types.js';

const FARKLE_PASS_DELAY_MS = 3500;
const RECONNECT_GRACE_MS = 60_000;
const HISTORY_LIMIT = 50;
const MAX_PLAYERS = 2;

function rollDice(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = randomInt(1, 7);
  return out;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rollDiceWeighted(typeIds) {
  return typeIds.map((id) => {
    const dt = DICE_TYPES_MAP[id];
    if (!dt) return randomInt(1, 7);
    return rollWeighted(dt.weights);
  });
}

export class GameRoom {
  constructor() {
    this.phase = 'lobby';
    this.gameMode = DEFAULT_GAME_MODE;
    this.targetScore = DEFAULT_TARGET;
    this.players = [];
    this.currentPlayerIdx = 0;
    this.turn = this._emptyTurn();
    this.winnerId = null;
    this.history = [];
    this.farkleTimer = null;
    this._onStateChanged = null;
    this.onEmpty = null;
  }

  /** Зарегистрировать коллбэк, который вызывается после каждого broadcast state. */
  setStateChangedHandler(fn) {
    this._onStateChanged = fn;
  }

  _emptyTurn() {
    return {
      awaitingFirstRoll: true,
      diceOnTable: [],
      diceTypeIds: [],
      lockedDice: [],
      lockedDiceTypeIds: [],
      roundScore: 0,
      isFarkle: false,
      isHotDice: false,
    };
  }

  /** Найти наименьший свободный pN id (p0, p1, ...) без коллизий
   *  с уже живущими игроками. Нужно когда кто-то ушёл и оставил «дырку». */
  _nextFreeId() {
    const used = new Set(this.players.map((p) => p.id));
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const candidate = `p${i}`;
      if (!used.has(candidate)) return candidate;
    }
    return null;
  }

  addPlayer(clientId, name, socket, color = DEFAULT_DICE_COLOR) {
    const existing = this.players.find((p) => p.clientId === clientId);
    if (existing) {
      if (existing.releaseTimer) {
        clearTimeout(existing.releaseTimer);
        existing.releaseTimer = null;
      }
      existing.socket = socket;
      existing.connected = true;
      if (name) existing.name = name;
      if (color) existing.color = color;
      this._broadcastState();
      this._sendTo(existing, { type: ServerMsg.EVENT, payload: { type: 'reconnected', playerId: existing.id } });
      return { player: existing, isNew: false };
    }
    if (this.players.length >= MAX_PLAYERS) {
      return { player: null, isNew: false, error: 'room_full' };
    }
    const id = this._nextFreeId();
    if (!id) return { player: null, isNew: false, error: 'room_full' };
    const player = {
      id,
      clientId,
      name: name || `Player ${this.players.length + 1}`,
      socket,
      connected: true,
      totalScore: 0,
      releaseTimer: null,
      isBot: false,
      color: color || DEFAULT_DICE_COLOR,
      loadout: [...DEFAULT_LOADOUT],
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

    const id = this._nextFreeId();
    if (!id) return { ok: false, error: 'room_full' };
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
      color: persona.color || DEFAULT_DICE_COLOR,
      loadout: [...DEFAULT_LOADOUT],
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
      if (this.players.length === 0) this.onEmpty?.();
      else this._broadcastState();
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
      if (this.players.length === 0) this.onEmpty?.();
      else this._broadcastState();
    }, RECONNECT_GRACE_MS);
    this._broadcastState();
  }

  handleMessage(player, msg) {
    if (!msg || typeof msg.type !== 'string') {
      return this._sendError(player, 'bad_message');
    }

    if (msg.type === ClientMsg.PONG) return;

    // SET_PROFILE — приемлемо в любой фазе (можно поменять цвет/имя в игре)
    if (msg.type === ClientMsg.SET_PROFILE) {
      const v = validateSetProfile(msg.payload);
      if (!v) return this._sendError(player, 'bad_profile');
      if (v.name) player.name = v.name;
      if (v.color) player.color = v.color;
      this._broadcastState();
      return;
    }

    if (this.phase === 'lobby') {
      if (msg.type === ClientMsg.SET_LOADOUT) {
        const v = validateLoadout(msg.payload);
        if (!v) return this._sendError(player, 'bad_loadout');
        player.loadout = v.loadout;
        this._broadcastState();
        return;
      }
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
      if (msg.type === ClientMsg.SELECT_PREVIEW) {
        const sel = msg.payload?.selection;
        if (!Array.isArray(sel)) return;
        for (const p of this.players) {
          if (p.id !== player.id && p.connected && p.socket) {
            try {
              p.socket.send(JSON.stringify({
                type: ServerMsg.EVENT,
                payload: { type: 'select_preview', playerId: player.id, selection: sel },
              }));
            } catch {}
          }
        }
        return;
      }
      if (msg.type === ClientMsg.SURRENDER) {
        const opponent = this.players.find((p) => p.id !== player.id);
        if (!opponent) return this._sendError(player, 'no_opponent');
        this.phase = 'finished';
        this.winnerId = opponent.id;
        this._pushHistory({ type: 'surrendered', playerId: player.id });
        this._broadcastEvent({ type: 'surrendered', playerId: player.id });
        this._pushHistory({ type: 'won', playerId: opponent.id });
        this._broadcastEvent({ type: 'won', playerId: opponent.id });
        this._broadcastState();
        return;
      }
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
    this.gameMode = v.mode;
    this.targetScore = v.targetScore;
    const modeCfg = GAME_MODES[this.gameMode];
    for (const p of this.players) p.totalScore = 0;
    // Персона бота уже выставлена в addBot или в _newGame — НЕ перерандомим здесь,
    // иначе имя в лобби сменится при старте игры (баг отчёта пользователя).
    // Подстраховка: если бот вдруг без mood (legacy) — выставить.
    for (const p of this.players) {
      if (p.isBot && !p.mood) {
        const persona = rollBotPersona(Math.random, this._currentBotNames().filter((n) => n !== p.firstName));
        p.mood = persona.mood;
      }
      if (p.isBot && modeCfg.allowSpecialDice) {
        p.loadout = generateBotLoadout();
      }
    }
    // Случайный первый игрок при каждом старте партии (через crypto.randomInt).
    this.currentPlayerIdx = randomInt(0, this.players.length);
    this.turn = this._emptyTurn();
    this.winnerId = null;
    this.history = [];
    this.phase = 'playing';
    const firstPlayerId = this.players[this.currentPlayerIdx].id;
    this._pushHistory({ type: 'game_started', targetScore: this.targetScore, firstPlayerId });
    this._broadcastState();
  }

  _newGame(player) {
    this.phase = 'lobby';
    this.gameMode = DEFAULT_GAME_MODE;
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
      p.color = persona.color || DEFAULT_DICE_COLOR;
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
    const modeCfg = GAME_MODES[this.gameMode];
    const loadout = modeCfg?.allowSpecialDice ? (player.loadout || DEFAULT_LOADOUT) : DEFAULT_LOADOUT;
    const shuffled = shuffleArray([...loadout]);
    this.turn.diceTypeIds = shuffled;
    this.turn.diceOnTable = rollDiceWeighted(shuffled);
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
    const heldTypeIds = sel.map((i) => this.turn.diceTypeIds[i] || 'normal');
    const remainingValues = this.turn.diceOnTable.filter((_, i) => !sel.includes(i));
    const remainingTypeIds = this.turn.diceTypeIds.filter((_, i) => !sel.includes(i));

    this.turn.roundScore += hold.score;
    this.turn.lockedDice = [...this.turn.lockedDice, ...heldValues];
    this.turn.lockedDiceTypeIds = [...this.turn.lockedDiceTypeIds, ...heldTypeIds];
    this.turn.diceOnTable = remainingValues;
    this.turn.diceTypeIds = remainingTypeIds;
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
    const modeCfg2 = GAME_MODES[this.gameMode];
    const loadout = modeCfg2?.allowSpecialDice ? (player.loadout || DEFAULT_LOADOUT) : DEFAULT_LOADOUT;
    if (this.turn.diceOnTable.length === 0) {
      this.turn.isHotDice = true;
      this.turn.lockedDice = [];
      this.turn.lockedDiceTypeIds = [];
      const hotShuffled = shuffleArray([...loadout]);
      this.turn.diceTypeIds = hotShuffled;
      this.turn.diceOnTable = rollDiceWeighted(hotShuffled);
      this._pushHistory({ type: 'hot_dice', playerId: player.id });
      this._broadcastEvent({ type: 'hotdice', playerId: player.id, dice: [...this.turn.diceOnTable] });
    } else {
      this.turn.isHotDice = false;
      this.turn.diceOnTable = rollDiceWeighted(this.turn.diceTypeIds);
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
      gameMode: this.gameMode,
      targetScore: this.targetScore,
      players: this.players.map((p) => {
        const base = {
          id: p.id,
          name: p.name,
          connected: p.connected,
          totalScore: p.totalScore,
          isBot: !!p.isBot,
          color: p.color || DEFAULT_DICE_COLOR,
          loadout: p.loadout || DEFAULT_LOADOUT,
        };
        if (p.isBot && finished) {
          base.mood = p.mood;
          base.moodLabel = moodLabel(p.mood);
          base.fullName = `${p.firstName} ${moodLabel(p.mood)}`;
        }
        return base;
      }),
      currentPlayerId: this.phase === 'playing' ? this._currentPlayer()?.id : null,
      turn: {
        ...this.turn,
        diceOnTable: [...this.turn.diceOnTable],
        diceTypeIds: [...this.turn.diceTypeIds],
        lockedDice: [...this.turn.lockedDice],
        lockedDiceTypeIds: [...this.turn.lockedDiceTypeIds],
      },
      winnerId: this.winnerId,
      history: this.history.slice(-HISTORY_LIMIT),
    };
  }
}

export { validateHello };
