import { randomInt } from 'node:crypto';
import { scoreSelection } from './engine/scoring.js';
import { scoreWithBadge, activationBlocker, badgeStats, BADGES_MAP } from './engine/badges.js';
import { ClientMsg } from './protocol.js';
import { DICE_TYPES, DICE_SETS, MAX_SPECIAL_DICE, modeAllowsSpecialDice } from './engine/dice-types.js';

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

// Палитра «приятных» цветов кубиков для ботов. Выбирается случайно вместе с
// настроением и именем при добавлении бота / новой партии.
export const BOT_COLORS = [
  '#d9b35a', // золотой
  '#c8553d', // терракота / бордовый
  '#3a7d44', // изумруд
  '#4f6d7a', // сапфир / стальной
  '#a47148', // бронза
  '#7d5ba6', // фиолетовый
  '#e07a5f', // персиковый
  '#4a7c8c', // тёмная бирюза
  '#b8627d', // розово-малиновый
  '#8d6a9f', // лиловый
  '#5d737e', // серо-синий
  '#c9a66b', // песочный
];

export const FIRST_NAMES = [
  // Главные персонажи Kingdom Come: Deliverance 2
  'Индро из Скалицы', 'Индержих', 'Ян Птачек', 'Ян Жижка',
  // Знаменитые гонщики Формулы-1
  'Льюис Хэмилтон', 'Макс Ферстаппен', 'Шарль Леклер', 'Ландо Норрис',
  'Айртон Сенна', 'Михаэль Шумахер', 'Фернандо Алонсо', 'Себастьян Феттель',
  // Знаменитые шахматисты
  'Магнус Карлсен', 'Хикару Накамура', 'Гарри Каспаров', 'Бобби Фишер',
  'Анатолий Карпов',
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

export function randomBotColor(rng = Math.random) {
  return randPick(BOT_COLORS, rng);
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
export function chooseGreedySelection(dice, score = scoreSelection) {
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
    const r = score(vals);
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

  const score = badgeScorer(bot.gameBadge);
  const selection = chooseGreedySelection(turn.diceOnTable, score);
  if (!selection || selection.length === 0) {
    // Зонк — но FSM комнаты не должен сюда нас впустить.
    return null;
  }

  const heldValues = selection.map((i) => turn.diceOnTable[i]);
  const heldScore = score(heldValues).score * (turn.doubleArmed ? 2 : 1);
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

function badgeScorer(badgeId) {
  return BADGES_MAP[badgeId]?.combos ? (vals) => scoreWithBadge(vals, badgeId) : scoreSelection;
}

const BOT_DOUBLING_MIN_HOLD = 300;
const BOT_RESCUE_MIN_ROUND = 250;
const BOT_WARLORD_MIN_ROUND = 500;

/**
 * Решение бота про активную бляху. Возвращает сообщение activate_badge или null.
 * Пассивные бляхи срабатывают сами, их бот не трогает.
 */
export function decideBotBadge(snapshot, bot) {
  const badge = BADGES_MAP[bot.gameBadge];
  if (!badge || badge.kind !== 'active' || !(bot.badgeCharges > 0)) return null;
  const turn = snapshot.turn;
  const tier = bot.gameBadgeTier;
  const ctx = { charges: bot.badgeCharges, turn, isMyTurn: snapshot.currentPlayerId === bot.id, tier };
  const activate = (diceIndex) => (
    activationBlocker(badge.id, { ...ctx, diceIndex }) ? null : { type: ClientMsg.ACTIVATE_BADGE, payload: diceIndex === undefined ? {} : { diceIndex } }
  );
  const activateDice = (diceIndices) => (
    activationBlocker(badge.id, { ...ctx, diceIndices }) ? null : { type: ClientMsg.ACTIVATE_BADGE, payload: { diceIndices } }
  );

  if (badge.id === 'resurrection') {
    if (!turn.isFarkle) return null;
    return turn.roundScore >= BOT_RESCUE_MIN_ROUND || turn.diceOnTable.length >= 3 ? activate() : null;
  }
  // Might / Bird King: take the seventh die at the start of a turn while charges last.
  if (badge.target === 'turnStart') return turn.awaitingFirstRoll ? activate() : null;
  if (turn.isFarkle || turn.awaitingFirstRoll) return null;

  const score = badgeScorer(bot.gameBadge);
  const selection = chooseGreedySelection(turn.diceOnTable, score) || [];
  if (badge.id === 'doubling') {
    const held = score(selection.map((i) => turn.diceOnTable[i])).score;
    return held >= BOT_DOUBLING_MIN_HOLD ? activate() : null;
  }
  const junk = turn.diceOnTable.map((_, i) => i).filter((i) => !selection.includes(i));
  if (badge.id === 'warlord') {
    // Arm it on a turn worth boosting: the round so far plus what the bot is about to hold.
    const held = score(selection.map((i) => turn.diceOnTable[i])).score;
    return turn.roundScore + held >= BOT_WARLORD_MIN_ROUND ? activate() : null;
  }
  if (badge.target === 'dice') {
    // Fortune / Wedding: reroll the dice that do not score, if that is all that stands between the bot and hot dice.
    const max = badgeStats(badge.id, tier).rerollMax;
    if (junk.length >= 1 && junk.length <= max && turn.diceOnTable.length >= 3) return activateDice(junk);
    return null;
  }
  // transmutation / exchange: fix the single die that keeps the bot from hot dice.
  const minTable = badge.id === 'transmutation' ? 2 : 3;
  if (junk.length === 1 && turn.diceOnTable.length >= minTable) return activate(junk[0]);
  return null;
}

/**
 * Драйвер бота. Слушает изменения состояния комнаты и планирует действия с задержкой.
 *
 * Хук — `room._onStateChanged = () => driver.tick()`.
 */
export class BotDriver {
  constructor(room, {
    firstRollDelayMinMs = 600,
    firstRollDelayMaxMs = 1200,
    // После броска бот ждёт, пока на клиенте отыграется звук/анимация
    // (~2 сек) и игрок успеет рассмотреть выпавшие кости, прежде чем решать.
    postRollDelayMinMs = 2500,
    postRollDelayMaxMs = 3500,
    // How long the opponent sees the bot's chosen dice highlighted before it scores them.
    previewMs = 1000,
  } = {}) {
    this.previewMs = previewMs;
    this.room = room;
    this.firstRollDelayMin = firstRollDelayMinMs;
    this.firstRollDelayMax = firstRollDelayMaxMs;
    this.postRollDelayMin = postRollDelayMinMs;
    this.postRollDelayMax = postRollDelayMaxMs;
    this.timer = null;
  }

  tick() {
    if (this.timer) return;
    if (this.room.phase !== 'playing') return;
    const cur = this.room._currentPlayer?.();
    if (!cur?.isBot) return;
    if (this.room.turn?.isFarkle) {
      if (decideBotBadge(this.room.toSnapshot(), cur)) this._schedule(cur, this.firstRollDelayMin);
      return;
    }
    if (this.room.farkleTimer) return;

    const isFirstRoll = !!this.room.turn?.awaitingFirstRoll;
    const lo = isFirstRoll ? this.firstRollDelayMin : this.postRollDelayMin;
    const hi = isFirstRoll ? this.firstRollDelayMax : this.postRollDelayMax;
    const range = Math.max(0, hi - lo);
    this._schedule(cur, lo + Math.floor(Math.random() * (range + 1)));
  }

  _schedule(bot, delay) {
    this.timer = setTimeout(() => {
      this.timer = null;
      this._act(bot);
    }, delay);
  }

  _act(bot) {
    if (this.room.phase !== 'playing') return;
    const cur = this.room._currentPlayer?.();
    if (!cur || cur.id !== bot.id) {
      // The turn moved on while this action waited (e.g. a farkle passed it): drive whoever is up now.
      this.tick();
      return;
    }

    try {
      const badgeMsg = decideBotBadge(this.room.toSnapshot(), bot);
      if (badgeMsg) {
        this.room.handleMessage(bot, badgeMsg);
        return;
      }
      if (this.room.farkleTimer || this.room.turn?.isFarkle) return;
      if (this.room.turn.awaitingFirstRoll) {
        this.room.handleMessage(bot, { type: ClientMsg.ROLL });
        return;
      }
      const decision = decideBotAction(this.room.toSnapshot(), bot);
      if (!decision) {
        this.timer = setTimeout(() => { this.timer = null; this.tick(); }, 1000);
        return;
      }
      // Show the choice first, like a human picking dice, then score it.
      this.room.relaySelectPreview(bot, decision.payload.selection);
      const dice = this.room.turn.diceOnTable.join(',');
      this.timer = setTimeout(() => {
        this.timer = null;
        const now = this.room._currentPlayer?.();
        if (this.room.phase === 'playing' && now && now.id === bot.id && this.room.turn.diceOnTable.join(',') === dice) {
          this.room.handleMessage(bot, decision);
        } else {
          this.tick();
        }
      }, this.previewMs);
    } catch (err) {
      console.error('[bot] action failed:', err);
      this.timer = setTimeout(() => { this.timer = null; this.tick(); }, 1000);
    }
  }

  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Cheating dice a bot may take: those that roll a 1 or a 5 at least as often as a fair die (1/3).
// Dice that only pay off in a set (Lu, Qi, Fer) come as the whole set instead.
export const BOT_DICE_POOL = DICE_TYPES.filter((d) => {
  if (!d.special || d.set) return false;
  const total = d.weights.reduce((s, w) => s + w, 0);
  return (d.weights[0] + d.weights[4]) / total >= 1 / 3;
}).map((d) => d.id);
const BOT_SET_CHANCE = 0.2;

/** Набор костей бота под режим: в classic — только внешний вид, иначе — ровно MAX_SPECIAL_DICE шулерских. */
export function generateBotLoadout(mode = 'pocket', rng = Math.random) {
  const loadout = Array(6).fill('normal');
  if (!modeAllowsSpecialDice(mode)) {
    if (rng() < 0.5) return loadout;
    const cosmetics = DICE_TYPES.filter((d) => !d.special && d.id !== 'normal');
    const look = cosmetics[Math.floor(rng() * cosmetics.length)].id;
    return loadout.map(() => look);
  }
  const slots = [0, 1, 2, 3, 4, 5];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  let picks;
  if (DICE_SETS.demons.members.length === MAX_SPECIAL_DICE && rng() < BOT_SET_CHANCE) {
    picks = [...DICE_SETS.demons.members];
  } else {
    const pool = [...BOT_DICE_POOL];
    picks = [];
    while (picks.length < MAX_SPECIAL_DICE && pool.length > 0) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  picks.forEach((id, k) => { loadout[slots[k]] = id; });
  return loadout;
}

/** Сгенерировать «личность» бота для новой партии. */
export function rollBotPersona(rng = Math.random, excludeNames = []) {
  return {
    mood: randomMood(rng),
    firstName: randomFirstName(rng, excludeNames),
    color: randomBotColor(rng),
  };
}
