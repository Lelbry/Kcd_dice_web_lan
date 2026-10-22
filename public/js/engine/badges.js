import { scoreSelection } from './scoring.js';
import { canHold } from './validate.js';

// Badge catalogue. Base badges have three tiers (tin / silver / gold); the stronger the tier, the more
// charges or the stronger the effect. Special badges exist in one rarity in KCD2: here they can be taken
// at any tier and always have the same strength. Read a badge's numbers only through badgeStats().
// Descriptions may hold {placeholders} filled from the stats by badgeText().
export const BADGES = [
  {
    id: 'doubling',
    name: 'Бляха удвоения',
    description: 'Удваивает очки за кости, которые вы отложите следующими.',
    kind: 'active',
    target: 'none',
    flash: 'Удвоение!',
    tiers: { tin: { charges: 1 }, silver: { charges: 2 }, gold: { charges: 3 } },
  },
  {
    id: 'resurrection',
    name: 'Бляха воскрешения',
    description: 'Спасает от зонка: кости на столе перебрасываются, а очки хода остаются при вас.',
    kind: 'active',
    target: 'farkle',
    flash: 'Воскрешение!',
    tiers: { tin: { charges: 1 }, silver: { charges: 2 }, gold: { charges: 3 } },
  },
  {
    id: 'transmutation',
    name: 'Бляха превращения',
    description: 'Превращает выбранную кость на столе в пятёрку.',
    kind: 'active',
    target: 'die',
    flash: 'Превращение!',
    tiers: { tin: { charges: 1 }, silver: { charges: 2 }, gold: { charges: 3 } },
  },
  {
    id: 'fortune',
    name: 'Бляха фортуны',
    description: 'Перебрасывает {rerollDice} на столе.',
    kind: 'active',
    target: 'dice',
    flash: 'Фортуна!',
    tiers: { tin: { charges: 1, rerollMax: 1 }, silver: { charges: 1, rerollMax: 2 }, gold: { charges: 2, rerollMax: 3 } },
  },
  {
    id: 'might',
    name: 'Бляха силы',
    description: 'В начале хода добавляет седьмую кость: весь ход вы бросаете семь костей.',
    kind: 'active',
    target: 'turnStart',
    flash: 'Сила!',
    tiers: { tin: { charges: 1, extraDice: 1 }, silver: { charges: 2, extraDice: 1 }, gold: { charges: 3, extraDice: 1 } },
  },
  {
    id: 'warlord',
    name: 'Бляха военачальника',
    description: 'Очки хода, которые вы запишете в банк, растут на {bankBonus}%.',
    kind: 'active',
    target: 'none',
    flash: 'Военачальник!',
    tiers: { tin: { charges: 1, bankMultiplier: 1.25 }, silver: { charges: 1, bankMultiplier: 1.5 }, gold: { charges: 1, bankMultiplier: 2 } },
  },
  {
    id: 'exchange',
    name: 'Бляха обмена',
    description: 'Перебрасывает одну выбранную кость на столе.',
    kind: 'active',
    target: 'die',
    flash: 'Обмен!',
    special: true,
    stats: { charges: 1 },
  },
  {
    id: 'bird_king',
    name: 'Бляха Короля птиц',
    description: 'В начале хода добавляет седьмую кость на весь ход.',
    kind: 'active',
    target: 'turnStart',
    flash: 'Король птиц!',
    special: true,
    stats: { charges: 2, extraDice: 1 },
  },
  {
    id: 'wedding',
    name: 'Бляха свадьбы',
    description: 'Перебрасывает {rerollDice} на столе.',
    kind: 'active',
    target: 'dice',
    flash: 'Свадьба!',
    special: true,
    stats: { charges: 1, rerollMax: 3 },
  },
  {
    id: 'headstart',
    name: 'Бляха форы',
    description: 'Вы начинаете партию с {startBonus} очками на счету.',
    kind: 'passive',
    tiers: { tin: { startBonus: 250 }, silver: { startBonus: 500 }, gold: { startBonus: 1000 } },
  },
  {
    id: 'defence',
    name: 'Бляха защиты',
    description: 'Гасит активации бляхи соперника: заряд у него тратится, эффекта нет. Щитов: {shield}.',
    kind: 'passive',
    tiers: { tin: { shield: 1 }, silver: { shield: 2 }, gold: { shield: 3 } },
  },
  {
    id: 'emperor',
    name: 'Бляха императора',
    description: 'Три единицы вместе дают 3000 очков вместо 1000.',
    kind: 'passive',
    special: true,
    stats: {},
    combos: [{ name: 'Императорская тройка', dice: [1, 1, 1], score: 3000 }],
  },
  {
    id: 'carpenter',
    name: 'Бляха отличия плотника',
    description: 'Новая комбинация «Разрез»: тройка и пятёрка вместе дают 150 очков.',
    kind: 'passive',
    special: true,
    stats: {},
    combos: [{ name: 'Разрез', dice: [3, 5], score: 150 }],
  },
  {
    id: 'executioner',
    name: 'Бляха отличия палача',
    description: 'Новая комбинация «Виселица»: четвёрка, пятёрка и шестёрка вместе дают 500 очков.',
    kind: 'passive',
    special: true,
    stats: {},
    combos: [{ name: 'Виселица', dice: [4, 5, 6], score: 500 }],
  },
];

// Badge rarity. Both players of a badge game play the same tier, chosen in the lobby settings.
export const BADGE_TIERS = ['tin', 'silver', 'gold'];
export const DEFAULT_BADGE_TIER = 'tin';
export const BADGE_TIER_NAMES = { tin: 'Жестяная', silver: 'Серебряная', gold: 'Золотая' };

export const BADGES_MAP = Object.fromEntries(BADGES.map((b) => [b.id, b]));
export const DEFAULT_BADGE = 'doubling';

const NO_STATS = { charges: 0, startBonus: 0, shield: 0, rerollMax: 0, extraDice: 0, bankMultiplier: 1, toValue: 5 };

export function isValidTier(tier) {
  return BADGE_TIERS.indexOf(tier) !== -1;
}

/** The numbers of a badge at a tier: charges, startBonus, shield, rerollMax, extraDice, bankMultiplier, toValue. */
export function badgeStats(badgeId, tier) {
  const badge = BADGES_MAP[badgeId];
  if (!badge) return Object.assign({}, NO_STATS);
  const own = badge.stats || badge.tiers[isValidTier(tier) ? tier : DEFAULT_BADGE_TIER];
  return Object.assign({}, NO_STATS, own);
}

/** Description with this tier's numbers filled in. */
export function badgeText(badgeId, tier) {
  const badge = BADGES_MAP[badgeId];
  if (!badge) return '';
  const st = badgeStats(badgeId, tier);
  const values = Object.assign({}, st, {
    bankBonus: Math.round((st.bankMultiplier - 1) * 100),
    rerollDice: st.rerollMax === 1 ? 'одну выбранную кость' : `до ${st.rerollMax} выбранных костей`,
  });
  return badge.description.replace(/\{(\w+)\}/g, (m, key) => (values[key] !== undefined ? String(values[key]) : m));
}

export function isValidBadge(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(BADGES_MAP, id);
}

function removeAll(values, dice) {
  const rest = [...values];
  for (const d of dice) {
    const i = rest.indexOf(d);
    if (i < 0) return null;
    rest.splice(i, 1);
  }
  return rest;
}

// Best score for a held set when the badge adds extra combinations; -1 if the set does not score.
function bestScore(values, combos) {
  const base = scoreSelection(values);
  let best = base.valid ? base.score : -1;
  for (const combo of combos) {
    const rest = removeAll(values, combo.dice);
    if (!rest) continue;
    const sub = rest.length === 0 ? 0 : bestScore(rest, combos);
    if (sub >= 0) best = Math.max(best, combo.score + sub);
  }
  return best;
}

export function scoreWithBadge(values, badgeId) {
  const combos = BADGES_MAP[badgeId] && BADGES_MAP[badgeId].combos;
  if (!combos) return scoreSelection(values);
  if (!Array.isArray(values) || values.length === 0) return { score: 0, valid: false, breakdown: [] };
  const score = bestScore(values, combos);
  return score < 0 ? { score: 0, valid: false, breakdown: [] } : { score, valid: true, breakdown: [] };
}

export function canHoldWithBadge(selection, roll, badgeId) {
  const base = canHold(selection, roll);
  if (!BADGES_MAP[badgeId] || !BADGES_MAP[badgeId].combos) return base;
  if (!base.ok && base.reason !== 'not_scoring') return base;
  const r = scoreWithBadge(selection.map((i) => roll[i]), badgeId);
  if (!r.valid) return { ok: false, reason: 'not_scoring' };
  return { ok: true, score: r.score, breakdown: r.breakdown };
}

// Why an active badge cannot be used right now, or null if it can.
// diceIndices (fortune, wedding) is checked only when given: the client asks "could I start picking dice?" without it.
export function activationBlocker(badgeId, { charges, turn, isMyTurn, diceIndex, diceIndices, tier }) {
  const badge = BADGES_MAP[badgeId];
  if (!badge || badge.kind !== 'active') return 'badge_passive';
  if (!(charges > 0)) return 'badge_no_charges';
  if (!isMyTurn) return 'not_your_turn';
  if (badge.target === 'farkle') return turn.isFarkle ? null : 'badge_needs_farkle';
  if (badge.target === 'turnStart') {
    if (!turn.awaitingFirstRoll) return 'badge_needs_turn_start';
    return turn.extraDice > 0 ? 'badge_already_armed' : null;
  }
  if (turn.awaitingFirstRoll || turn.isFarkle) return 'badge_needs_roll';
  if (badge.id === 'doubling' && turn.doubleArmed) return 'badge_already_armed';
  if (badge.id === 'warlord' && turn.bankMultiplier > 1) return 'badge_already_armed';
  const onTable = (i) => Number.isInteger(i) && i >= 0 && i < turn.diceOnTable.length;
  if (badge.target === 'die' && !onTable(diceIndex)) return 'badge_needs_die';
  if (badge.target === 'dice' && diceIndices !== undefined && diceIndices !== null) {
    const max = badgeStats(badgeId, tier).rerollMax;
    const ok = Array.isArray(diceIndices) && diceIndices.length >= 1 && diceIndices.length <= max
      && diceIndices.every(onTable) && new Set(diceIndices).size === diceIndices.length;
    if (!ok) return 'badge_needs_dice';
  }
  return null;
}
