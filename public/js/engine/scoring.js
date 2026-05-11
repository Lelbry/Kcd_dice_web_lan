import {
  TRIPLE_BASE,
  multiplierForCount,
  SINGLE_1,
  SINGLE_5,
  STRAIGHT_1_5,
  STRAIGHT_2_6,
  STRAIGHT_1_6,
} from './rules.js';

function emptyResult() {
  return { score: 0, valid: false, breakdown: [] };
}

function countFaces(dice) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const v of dice) counts[v]++;
  return counts;
}

export function scoreSelection(dice) {
  if (!Array.isArray(dice) || dice.length === 0) return emptyResult();
  if (dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) return emptyResult();

  const counts = countFaces(dice);

  if (dice.length === 6 && counts.slice(1, 7).every((c) => c === 1)) {
    return {
      score: STRAIGHT_1_6,
      valid: true,
      breakdown: [{ dice: [1, 2, 3, 4, 5, 6], combo: 'straight_1_6', score: STRAIGHT_1_6 }],
    };
  }
  if (dice.length === 5 && [1, 2, 3, 4, 5].every((f) => counts[f] === 1) && counts[6] === 0) {
    return {
      score: STRAIGHT_1_5,
      valid: true,
      breakdown: [{ dice: [1, 2, 3, 4, 5], combo: 'straight_1_5', score: STRAIGHT_1_5 }],
    };
  }
  if (dice.length === 5 && [2, 3, 4, 5, 6].every((f) => counts[f] === 1) && counts[1] === 0) {
    return {
      score: STRAIGHT_2_6,
      valid: true,
      breakdown: [{ dice: [2, 3, 4, 5, 6], combo: 'straight_2_6', score: STRAIGHT_2_6 }],
    };
  }

  let score = 0;
  let usedDice = 0;
  const breakdown = [];

  for (let face = 1; face <= 6; face++) {
    if (counts[face] >= 3) {
      const groupScore = TRIPLE_BASE[face] * multiplierForCount(counts[face]);
      score += groupScore;
      breakdown.push({
        dice: Array(counts[face]).fill(face),
        combo: `${counts[face]}_of_${face}`,
        score: groupScore,
      });
      usedDice += counts[face];
      counts[face] = 0;
    }
  }

  if (counts[1] > 0) {
    const points = counts[1] * SINGLE_1;
    score += points;
    breakdown.push({
      dice: Array(counts[1]).fill(1),
      combo: counts[1] === 1 ? 'single_1' : `singles_${counts[1]}x1`,
      score: points,
    });
    usedDice += counts[1];
    counts[1] = 0;
  }
  if (counts[5] > 0) {
    const points = counts[5] * SINGLE_5;
    score += points;
    breakdown.push({
      dice: Array(counts[5]).fill(5),
      combo: counts[5] === 1 ? 'single_5' : `singles_${counts[5]}x5`,
      score: points,
    });
    usedDice += counts[5];
    counts[5] = 0;
  }

  const valid = usedDice === dice.length && score > 0;
  return valid ? { score, valid: true, breakdown } : emptyResult();
}

export function isFarkle(roll) {
  if (!Array.isArray(roll) || roll.length === 0) return false;
  const counts = countFaces(roll);

  if (counts[1] > 0 || counts[5] > 0) return false;
  for (let f = 1; f <= 6; f++) {
    if (counts[f] >= 3) return false;
  }
  if (roll.length === 6 && counts.slice(1, 7).every((c) => c === 1)) return false;
  if (roll.length === 5) {
    if ([1, 2, 3, 4, 5].every((f) => counts[f] === 1)) return false;
    if ([2, 3, 4, 5, 6].every((f) => counts[f] === 1)) return false;
  }
  return true;
}
