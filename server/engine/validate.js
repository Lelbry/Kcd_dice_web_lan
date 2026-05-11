import { scoreSelection, isFarkle } from './scoring.js';

export function canHold(selection, roll) {
  if (!Array.isArray(selection) || selection.length === 0) {
    return { ok: false, reason: 'empty_selection' };
  }
  if (!Array.isArray(roll)) {
    return { ok: false, reason: 'invalid_roll' };
  }
  if (selection.some((i) => !Number.isInteger(i) || i < 0 || i >= roll.length)) {
    return { ok: false, reason: 'invalid_index' };
  }
  if (new Set(selection).size !== selection.length) {
    return { ok: false, reason: 'duplicate_index' };
  }

  const values = selection.map((i) => roll[i]);
  const { score, valid, breakdown } = scoreSelection(values);
  if (!valid) return { ok: false, reason: 'not_scoring' };
  return { ok: true, score, breakdown };
}

export function canBank(turnScore) {
  return Number.isFinite(turnScore) && turnScore > 0;
}

export function checkWin(totalScore, targetScore) {
  return Number.isFinite(totalScore) && totalScore >= targetScore;
}

export { isFarkle };
