import { randomInt } from 'node:crypto';
import { GameRoom } from './room.js';
import { BotDriver } from './bot.js';

// Алфавит без визуально похожих символов (0/O, 1/I, отсутствует Z из-за похожести на 2 в некоторых шрифтах — оставим, не критично).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 5;
const DEFAULT_MAX_ROOMS = 50;
// Если в комнате нет ни одного игрока в течение этого времени после создания — удалить.
const ORPHAN_CREATE_TTL_MS = 60_000;

function generateCode() {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Управляет всеми активными игровыми комнатами. Каждая комната живёт
 * по пятисимвольному коду из CODE_ALPHABET. Комнаты создаются хостом,
 * подбираются по коду гостем. Пустые комнаты автоматически очищаются.
 */
export class RoomManager {
  constructor({ maxRooms = DEFAULT_MAX_ROOMS } = {}) {
    this.maxRooms = maxRooms;
    this.rooms = new Map(); // code -> { room, botDriver, createdAt, orphanTimer }
  }

  /**
   * Создать новую комнату. Возвращает { code, room } или null, если
   * лимит активных комнат достигнут.
   */
  createRoom() {
    if (this.rooms.size >= this.maxRooms) return null;

    let code;
    // Защита от теоретической коллизии — генерируем до 10 раз.
    for (let i = 0; i < 10; i++) {
      const candidate = generateCode();
      if (!this.rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) return null;

    const room = new GameRoom();
    room.code = code;
    const botDriver = new BotDriver(room);
    room.setStateChangedHandler(() => botDriver.tick());
    room.setEmptyHandler(() => this.disposeRoom(code));

    const orphanTimer = setTimeout(() => {
      // Если за ORPHAN_CREATE_TTL_MS никто так и не вошёл — удалить.
      if (this.rooms.has(code) && room.players.length === 0) {
        this.disposeRoom(code);
      }
    }, ORPHAN_CREATE_TTL_MS);
    // Не блокировать event loop.
    if (typeof orphanTimer.unref === 'function') orphanTimer.unref();

    this.rooms.set(code, { room, botDriver, createdAt: Date.now(), orphanTimer });
    return { code, room };
  }

  /** Получить комнату по коду или null. Код нормализуется в upper. */
  getRoom(code) {
    if (typeof code !== 'string') return null;
    const entry = this.rooms.get(code.toUpperCase());
    if (!entry) return null;
    // Игрок зашёл — orphanTimer больше не нужен.
    if (entry.orphanTimer) {
      clearTimeout(entry.orphanTimer);
      entry.orphanTimer = null;
    }
    return entry.room;
  }

  /** Удалить комнату и снять все её таймеры. */
  disposeRoom(code) {
    const entry = this.rooms.get(code);
    if (!entry) return;
    if (entry.orphanTimer) clearTimeout(entry.orphanTimer);
    entry.botDriver.cancel();
    entry.room.dispose();
    this.rooms.delete(code);
  }

  /** Сколько активных комнат сейчас. */
  size() {
    return this.rooms.size;
  }

  /** Снять все таймеры — для graceful shutdown. */
  shutdown() {
    for (const code of [...this.rooms.keys()]) {
      this.disposeRoom(code);
    }
  }
}

export const ROOM_CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`);
