export const MAX_SPECIAL_DICE = 3;
export const MAX_SAME_SPECIAL = 2;

export const DICE_TYPES = [
  {
    id: 'normal',
    name: 'Обычная игральная кость',
    description: 'Обычная игральная кость.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#f4e8c1',
    special: false,
  },
  {
    id: 'antioch',
    name: 'Кость Святого Антиоха',
    description: 'На кости святого Антиоха всегда выпадает тройка. Не двойка, уж точно не четверка.',
    weights: [0, 0, 1, 0, 0, 0],
    color: '#ffc800',
    special: true,
  },
  {
    id: 'painted',
    name: 'Раскрашенная игральная кость',
    description: 'Одна из игральных костей, раскрашенных современными методами, что скрывают попытку ее отбалансировать.',
    weights: [3, 1, 1, 1, 7, 3],
    color: '#a83cc4',
    special: true,
  },
  {
    id: 'lucky',
    name: 'Удачливая игральная кость',
    description: 'Кость, которая приносит удачу даже чаще, чем ты этого ждешь.',
    weights: [6, 0, 1, 1, 6, 4],
    color: '#2ebd4e',
    special: true,
  },
  {
    id: 'sad_trickster',
    name: 'Кость печального ловкача',
    description: 'Синяя игральная кость — печальная, как ее первоначальный владелец.',
    weights: [6, 6, 1, 1, 6, 3],
    color: '#2d7dd2',
    special: true,
  },
  {
    id: 'charioteer',
    name: 'Игральная кость возницы',
    description: 'Легенда гласит, что эта игральная кость принадлежала знаменитому римскому вознице Арнульду, чья тактика заключается в том, что утомить противника и убаюкать, погрузив в сон.',
    weights: [1, 5, 6, 2, 2, 2],
    color: '#c47422',
    special: true,
  },
  {
    id: 'even',
    name: 'Четная кость',
    description: 'Шулерская игральная кость, на которой чаще выпадают четные числа.',
    weights: [1, 4, 1, 4, 1, 4],
    color: '#d63838',
    special: true,
  },
  {
    id: 'odd',
    name: 'Нечетная игральная кость',
    description: 'Шулерская кость, на которой всегда выпадают нечетные значения. Ну, почти всегда.',
    weights: [4, 1, 4, 1, 3, 1],
    color: '#e88520',
    special: true,
  },
  {
    id: 'loaded',
    name: 'Заряженная игральная кость',
    description: 'Загадочная игральная кость. Подозрительно часто выпадает 1.',
    weights: [10, 1, 1, 1, 1, 1],
    color: '#6c7a8a',
    special: true,
  },
  {
    id: 'shrewd_cheat',
    name: 'Кость осмотрительного жулика',
    description: 'Над этой игральной костью поработал настоящий мастер. Она как надо утяжелена, но совершенно незаметно.',
    weights: [5, 3, 2, 3, 5, 3],
    color: '#1a998e',
    special: true,
  },
  {
    id: 'unbalanced',
    name: 'Несбалансированная кость',
    description: 'Игральная кость, в которую кто-то пытался залить свинец, но у него не очень хорошо получилось.',
    weights: [3, 4, 1, 1, 2, 1],
    color: '#b05020',
    special: true,
  },
];

export const DICE_TYPES_MAP = Object.fromEntries(DICE_TYPES.map((d) => [d.id, d]));

export const DEFAULT_LOADOUT = Array(6).fill('normal');

export function validateLoadoutArray(loadout) {
  if (!Array.isArray(loadout) || loadout.length !== 6) return null;
  const specialCount = loadout.filter((id) => {
    const dt = DICE_TYPES_MAP[id];
    return dt && dt.special;
  }).length;
  if (specialCount > MAX_SPECIAL_DICE) return null;
  const counts = {};
  for (const id of loadout) {
    if (!DICE_TYPES_MAP[id]) return null;
    if (id !== 'normal') {
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > MAX_SAME_SPECIAL) return null;
    }
  }
  return loadout;
}

export function rollWeighted(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return 1;
  let r = Math.random() * total;
  for (let face = 0; face < weights.length; face++) {
    r -= weights[face];
    if (r <= 0) return face + 1;
  }
  return weights.length;
}
