import { scoreSelection } from './scoring.js';
import { canHold } from './validate.js';

// v1 badge catalogue: no tin/silver/gold tiers yet, one fixed charge count per badge.
// See docs/BADGE_REFERENCE.md for the full KCD2 list and the roadmap.
export const BADGES = [
  {
    id: 'doubling',
    name: 'Бляха удвоения',
    description: 'Удваивает очки за кости, которые вы отложите следующими.',
    kind: 'active',
    charges: 1,
    target: 'none',
    flash: 'Удвоение!',
  },
  {
    id: 'resurrection',
    name: 'Бляха воскрешения',
    description: 'Спасает от зонка: кости на столе перебрасываются, а очки хода остаются при вас.',
    kind: 'active',
    charges: 2,
    target: 'farkle',
    flash: 'Воскрешение!',
  },
  {
    id: 'transmutation',
    name: 'Бляха превращения',
    description: 'Превращает одну выбранную кость на столе в пятёрку.',
    kind: 'active',
    charges: 1,
    target: 'die',
    flash: 'Превращение!',
  },
  {
    id: 'exchange',
    name: 'Бляха обмена',
    description: 'Перебрасывает одну выбранную кость на столе.',
    kind: 'active',
    charges: 1,
    target: 'die',
    flash: 'Обмен!',
  },
  {
    id: 'headstart',
    name: 'Бляха форы',
    description: 'Вы начинаете партию с 500 очками на счету.',
    kind: 'passive',
    startBonus: 500,
  },
  {
    id: 'carpenter',
    name: 'Бляха отличия плотника',
    description: 'Новая комбинация «Разрез»: тройка и пятёрка вместе дают 150 очков.',
    kind: 'passive',
    combos: [{ name: 'Разрез', dice: [3, 5], score: 150 }],
  },
  {
    id: 'executioner',
    name: 'Бляха отличия палача',
    description: 'Новая комбинация «Виселица»: четвёрка, пятёрка и шестёрка вместе дают 500 очков.',
    kind: 'passive',
    combos: [{ name: 'Виселица', dice: [4, 5, 6], score: 500 }],
  },
  {
    id: 'defence',
    name: 'Бляха защиты',
    description: 'Первая бляха, которую активирует соперник, сгорает впустую: заряд тратится, эффекта нет.',
    kind: 'passive',
    shield: 1,
  },
];

// Badge rarity. Both players of a badge game play the same tier, chosen in the lobby settings.
export const BADGE_TIERS = ['tin', 'silver', 'gold'];
export const DEFAULT_BADGE_TIER = 'tin';
export const BADGE_TIER_NAMES = { tin: 'Жестяная', silver: 'Серебряная', gold: 'Золотая' };

export const BADGES_MAP = Object.fromEntries(BADGES.map((b) => [b.id, b]));
export const DEFAULT_BADGE = 'doubling';

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
export function activationBlocker(badgeId, { charges, turn, isMyTurn, diceIndex }) {
  const badge = BADGES_MAP[badgeId];
  if (!badge || badge.kind !== 'active') return 'badge_passive';
  if (!(charges > 0)) return 'badge_no_charges';
  if (!isMyTurn) return 'not_your_turn';
  if (badge.target === 'farkle') return turn.isFarkle ? null : 'badge_needs_farkle';
  if (turn.awaitingFirstRoll || turn.isFarkle) return 'badge_needs_roll';
  if (badge.id === 'doubling' && turn.doubleArmed) return 'badge_already_armed';
  if (badge.target === 'die') {
    if (!Number.isInteger(diceIndex) || diceIndex < 0 || diceIndex >= turn.diceOnTable.length) {
      return 'badge_needs_die';
    }
  }
  return null;
}
