import { scoreSelection, isFarkle } from './scoring.js';

export function canHold(selection, roll) {
  if (!Array.isArray(selection) || selection.length === 0) {
    return { ok: false, reason: 'empty_selection' };
  }
  if (!Array.isArray(roll)) return { ok: false, reason: 'invalid_roll' };
  if (selection.some((i) => !Number.isInteger(i) || i < 0 || i >= roll.length)) {
    return { ok: false, reason: 'invalid_index' };
  }
  if (new Set(selection).size !== selection.length) {
    return { ok: false, reason: 'duplicate_index' };
  }
  const values = selection.map((i) => roll[i]);
  const r = scoreSelection(values);
  if (!r.valid) return { ok: false, reason: 'not_scoring' };
  return { ok: true, score: r.score, breakdown: r.breakdown };
}

export { isFarkle };
