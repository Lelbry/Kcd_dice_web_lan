import { randomInt } from 'node:crypto';
import { scoreSelection } from './engine/scoring.js';
import { ClientMsg } from './protocol.js';

export const MOODS = {
  cautious: {
    label: 'Осторожный',
    base: 250,
    roflChance: 0.05,
    useComeback: true,
    description: 'играл осторожно, банковал рано',
  },
  calculated: {
    label: 'Расчётливый',
    base: 450,
    roflChance: 0.05,
    useComeback: true,
    description: 'действовал сбалансированно',
  },
  bold: {
    label: 'Дерзкий',
    base: 700,
    roflChance: 0.05,
    useComeback: true,
    description: 'шёл на лишние броски, охотился за hot dice',
  },
  reckless: {
    label: 'Безбашенный',
    base: 1100,
    roflChance: 0.05,
    useComeback: true,
    description: 'катил кости почти до конца хода каждый раз',
  },
  'cold-blooded': {
    label: 'Хладнокровный',
    base: 500,
    roflChance: 0,
    useComeback: false,
    description: 'играл хладнокровно, без эмоций и рискованных глупостей',
  },
  wild: {
    label: 'Шальной',
    base: null,
    roflChance: 0,
    useComeback: false,
    description: 'был непредсказуем — порой банковал гроши, порой шёл ва-банк',
  },
};

export const MOOD_KEYS = Object.keys(MOODS);

export const FIRST_NAMES = [
  // KCD2 / czech flavor
  'Индро', 'Ян', 'Радек', 'Ярослав', 'Вацлав', 'Йозеф', 'Гануш', 'Радзиг',
  // Formula 1
  'Шумахер', 'Хэмилтон', 'Феттель', 'Алонсо', 'Райкконен', 'Ферстаппен',
  'Леклер', 'Сенна', 'Прост',
  // wild card
  'Митяй',
];

function randPick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export function randomMood(rng = Math.random) {
  return MOOD_KEYS[Math.floor(rng() * MOOD_KEYS.length)];
}

export function randomFirstName(rng = Math.random, exclude = []) {
  const pool = FIRST_NAMES.filter((n) => !exclude.includes(n));
  return randPick(pool.length > 0 ? pool : FIRST_NAMES, rng);
}

export function moodLabel(mood) {
  return MOODS[mood]?.label ?? '???';
}

export function moodDescription(mood) {
  return MOODS[mood]?.description ?? '';
}

/**
 * Жадный выбор всех зачётных костей.
 * Перебираем подмножества от больших к малым, ищем максимальную валидную выборку.
 * Для 6 костей это 2^6=64 — допустимо.
 */
export function chooseGreedySelection(dice) {
  const n = dice.length;
  let bestSelection = null;
  let bestScore = -1;
  let bestSize = -1;

  for (let mask = 1; mask < (1 << n); mask++) {
    const sel = [];
    const vals = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sel.push(i);
        vals.push(dice[i]);
      }
    }
    const r = scoreSelection(vals);
    if (!r.valid) continue;
    // Prefer larger selection (more dice used), break ties by score.
    if (sel.length > bestSize || (sel.length === bestSize && r.score > bestScore)) {
      bestSize = sel.length;
      bestScore = r.score;
      bestSelection = sel;
    }
  }
  return bestSelection; // null если ни одного зачётного — это зонк
}

function computeThreshold(mood, botTotal, oppTotal, target, rng = Math.random) {
  if (mood === 'wild') {
    return 200 + Math.floor(rng() * 1400); // 200..1600
  }
  const cfg = MOODS[mood] ?? MOODS.calculated;
  let threshold = cfg.base;
  if (cfg.useComeback) {
    const oppDistance = target - oppTotal;
    if (oppDistance <= 500) threshold *= 1.8;
    else if (oppDistance <= 1000) threshold *= 1.4;

    if (botTotal < oppTotal - 800) threshold *= 1.3;
  }
  return Math.floor(threshold);
}

/**
 * Решение бота для текущей фазы выбора.
 *
 * Возвращает один из:
 *   { type: 'score_and_bank', payload: { selection } }
 *   { type: 'score_and_roll', payload: { selection } }
 *
 * @param snapshot — gameState snapshot (см. GameRoom.toSnapshot)
 * @param bot — объект игрока-бота (с полями totalScore, mood)
 * @param rng — функция случайных чисел (для тестов)
 */
export function decideBotAction(snapshot, bot, rng = Math.random) {
  const turn = snapshot.turn;
  const opponent = snapshot.players.find((p) => p.id !== bot.id);
  if (!opponent) {
    return { type: ClientMsg.SCORE_AND_BANK, payload: { selection: chooseGreedySelection(turn.diceOnTable) ?? [] } };
  }

  const selection = chooseGreedySelection(turn.diceOnTable);
  if (!selection || selection.length === 0) {
    // Зонк — но FSM комнаты не должен сюда нас впустить.
    return null;
  }

  const heldValues = selection.map((i) => turn.diceOnTable[i]);
  const heldScore = scoreSelection(heldValues).score;
  const projectedRound = (turn.roundScore || 0) + heldScore;

  // Forced bank: победа в кармане.
  if (bot.totalScore + projectedRound >= snapshot.targetScore) {
    return { type: ClientMsg.SCORE_AND_BANK, payload: { selection } };
  }

  // Forced roll: все 6 отложили → hot dice триггер. Банковать нет смысла, всё равно
  // правило заставит перебросить все 6 (но игрок-человек волен и сбанковать на пустом —
  // в нашей трактовке UI разрешает; для бота catalog: всегда продолжать на пустом столе).
  if (selection.length === turn.diceOnTable.length) {
    return { type: ClientMsg.SCORE_AND_ROLL, payload: { selection } };
  }

  const threshold = computeThreshold(bot.mood, bot.totalScore, opponent.totalScore, snapshot.targetScore, rng);

  let bank = projectedRound >= threshold;

  const roflChance = MOODS[bot.mood]?.roflChance ?? 0.05;
  if (roflChance > 0 && rng() < roflChance) {
    bank = !bank;
  }

  return bank
    ? { type: ClientMsg.SCORE_AND_BANK, payload: { selection } }
    : { type: ClientMsg.SCORE_AND_ROLL, payload: { selection } };
}

/**
 * Драйвер бота. Слушает изменения состояния комнаты и планирует действия с задержкой.
 *
 * Хук — `room._onStateChanged = () => driver.tick()`.
 */
export class BotDriver {
  constructor(room, { delayMinMs = 600, delayMaxMs = 1400 } = {}) {
    this.room = room;
    this.delayMin = delayMinMs;
    this.delayMax = delayMaxMs;
    this.timer = null;
  }

  tick() {
    if (this.timer) return;
    if (this.room.phase !== 'playing') return;
    const cur = this.room._currentPlayer?.();
    if (!cur?.isBot) return;
    if (this.room.farkleTimer) return;
    if (this.room.turn?.isFarkle) return;

    const range = Math.max(0, this.delayMax - this.delayMin);
    const delay = this.delayMin + Math.floor(Math.random() * (range + 1));
    this.timer = setTimeout(() => {
      this.timer = null;
      this._act(cur);
    }, delay);
  }

  _act(bot) {
    if (this.room.phase !== 'playing') return;
    const cur = this.room._currentPlayer?.();
    if (!cur || cur.id !== bot.id) return;
    if (this.room.farkleTimer || this.room.turn?.isFarkle) return;

    try {
      if (this.room.turn.awaitingFirstRoll) {
        this.room.handleMessage(bot, { type: ClientMsg.ROLL });
        return;
      }
      const decision = decideBotAction(this.room.toSnapshot(), bot);
      if (!decision) return;
      this.room.handleMessage(bot, decision);
    } catch (err) {
      console.error('[bot] action failed:', err);
    }
  }

  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/** Сгенерировать «личность» бота для новой партии. */
export function rollBotPersona(rng = Math.random, excludeNames = []) {
  return {
    mood: randomMood(rng),
    firstName: randomFirstName(rng, excludeNames),
  };
}
