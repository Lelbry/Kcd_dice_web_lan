export const DICE_COUNT = 6;
export const DICE_FACES = 6;

export const GAME_MODES = {
  classic: {
    id: 'classic',
    name: 'Классический',
    targets: [2000, 3000, 4000, 7000, 10000],
    canonTargets: [2000, 3000, 4000],
    defaultTarget: 2000,
    allowSpecialDice: false,
  },
  pocket: {
    id: 'pocket',
    name: 'Карманные кости',
    targets: [4000, 6000, 8000, 10000, 15000],
    canonTargets: [4000, 6000, 8000],
    defaultTarget: 4000,
    allowSpecialDice: true,
  },
  badge: {
    id: 'badge',
    name: 'Игра с бляхой',
    targets: [4000, 6000, 8000, 10000, 15000],
    canonTargets: [4000, 6000, 8000],
    defaultTarget: 4000,
    allowSpecialDice: true,
    badges: true,
  },
};

export const GAME_MODE_IDS = Object.keys(GAME_MODES);
export const DEFAULT_GAME_MODE = 'classic';

export const TARGET_OPTIONS = [...new Set(
  Object.values(GAME_MODES).flatMap((m) => m.targets),
)];
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
