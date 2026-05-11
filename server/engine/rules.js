export const DICE_COUNT = 6;
export const DICE_FACES = 6;

export const TARGET_OPTIONS = [2000, 3000, 4000];
export const DEFAULT_TARGET = 2000;

export const SINGLE_1 = 100;
export const SINGLE_5 = 50;

export const TRIPLE_BASE = {
  1: 1000,
  2: 200,
  3: 300,
  4: 400,
  5: 500,
  6: 600,
};

export function multiplierForCount(n) {
  if (n === 3) return 1;
  if (n === 4) return 2;
  if (n === 5) return 4;
  if (n === 6) return 8;
  return 0;
}

export const STRAIGHT_1_5 = 500;
export const STRAIGHT_2_6 = 750;
export const STRAIGHT_1_6 = 1500;
