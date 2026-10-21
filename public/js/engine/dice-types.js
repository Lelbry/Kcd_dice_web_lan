import { GAME_MODES } from './rules.js';

export const MAX_SPECIAL_DICE = 3;
export const MAX_SAME_SPECIAL = 1;

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
    weights: [3, 1, 6, 1, 1, 3],
    color: '#ffc800',
    special: true,
    faceGlyphs: { 3: 'cross' },
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
  {
    id: 'diminishing',
    name: 'Уменьшающая кость',
    description: 'Кость со слегка смещенным центром тяжести. На вид ее едва ли можно отличить от обычной.',
    weights: [2, 1, 1, 1, 1, 3],
    color: '#8b7355',
    special: true,
  },
  {
    id: 'unlucky',
    name: 'Невезучая игральная кость',
    description: 'Говорят, неудачи бьют наотмашь. После игры этой костью тебе захочется самого себя по щекам отхлестать.',
    weights: [1, 6, 6, 6, 6, 1],
    color: '#4a3c5a',
    special: true,
  },
  {
    id: 'stripping',
    name: 'Раздевальная игральная кость',
    description: 'Легенда гласит, что эта игральная кость многих девок раздеть поможет.',
    weights: [4, 2, 2, 2, 3, 3],
    color: '#d4568c',
    special: true,
  },
  {
    id: 'holy_trinity',
    name: 'Игральная кость Святой Троицы',
    description: 'Освященная игральная кость, которая славит Святую Троицу. Тройки особенно часто выпадают.',
    weights: [4, 5, 7, 1, 1, 1],
    color: '#f8f0d8',
    special: true,
    faceGlyphs: { 3: 'trinity' },
  },
  {
    id: 'lu',
    name: 'Игральная кость Лю',
    description: 'Первая из трех демонических костей.',
    weights: [1, 1, 1, 1, 1, 2],
    color: '#8b0000',
    special: true,
    faceGlyphs: { 6: 'sigil' },
  },
  {
    id: 'qi',
    name: 'Игральная кость Ци',
    description: 'Вторая из демонических костей. Теряться любит, но когда она вместе со своими сестрами, то ой как сильна.',
    weights: [1, 1, 1, 1, 1, 2],
    color: '#5a0f3a',
    special: true,
    faceGlyphs: { 6: 'sigil' },
  },
  {
    id: 'fer',
    name: 'Игральная кость Фер',
    description: 'Третья, и последняя, из демонических игральных костей.',
    weights: [1, 1, 1, 1, 1, 2],
    color: '#1a0033',
    special: true,
    faceGlyphs: { 6: 'sigil' },
  },
  {
    id: 'royal',
    name: 'Королевская игральная кость',
    description: 'Королю шулерская кость ни к чему — он и так всегда прав и проиграть никак не может.',
    weights: [4, 6, 7, 8, 4, 3],
    color: '#6b1fb3',
    special: true,
    faceGlyphs: { 1: 'crown' },
  },
  {
    id: 'mathematician',
    name: 'Кость математика',
    description: 'Кость, утяжеленная на основе трудов забытого математика. Может быть она больше подходит для решения уравнений.',
    weights: [4, 5, 6, 7, 1, 1],
    color: '#1e4d8c',
    special: true,
  },
  {
    id: 'triple',
    name: 'Игральная кость с тройкой',
    description: 'Отчего-то на этой кости вечно выпадает тройка. К чему бы это?',
    weights: [2, 1, 9, 1, 2, 1],
    color: '#2f7a2f',
    special: true,
  },
  {
    id: 'aranki',
    name: 'Игральная кость Аранки',
    description: 'Аранка вручила мне эту кость, чтобы проще было играть против ейного мужа.',
    weights: [6, 1, 6, 1, 6, 1],
    color: '#b85c38',
    special: true,
  },
  {
    id: 'greasy',
    name: 'Засаленная игральная кость',
    description: 'Игральная кость, надежнее, чем обычная, но не стоит полагаться на нее во всем.',
    weights: [3, 2, 3, 2, 3, 4],
    color: '#5d4a2a',
    special: true,
  },
  {
    id: 'dirty',
    name: 'Грязная игральная кость',
    description: 'С этой игральной костью запросто в лужу сядешь. А то еще и мордой в грязь макнут.',
    weights: [1, 5, 1, 1, 7, 1],
    color: '#4a5a20',
    special: true,
  },
  {
    id: 'grozav_lucky',
    name: 'Счастливая игральная кость Грозава',
    description: 'Не так много она удачи приносит, но никому не говорите!',
    weights: [1, 10, 1, 1, 1, 1],
    color: '#2a9d8f',
    special: true,
  },
  {
    id: 'swindler',
    name: 'Игральная кость мошенников',
    description: 'Скверно сделанная шулерская кость. Сразу видно, какая она кривая.',
    weights: [2, 3, 2, 3, 7, 3],
    color: '#808060',
    special: true,
  },
  {
    id: 'lucky_alt',
    name: 'Счастливая игральная кость',
    description: 'Если тебе улыбнулась удача, улыбнись ей в ответ. Иначе все это будет выглядеть подозрительно.',
    weights: [6, 1, 2, 3, 4, 6],
    color: '#f4a261',
    special: true,
  },
  {
    id: 'pie',
    name: 'Пирог в виде игральной кости',
    description: 'Выглядит не очень аппетитно, зато заранее знаешь, что на ней чаще выпадают маленькие значения.',
    weights: [6, 1, 3, 3, 0, 0],
    color: '#a0522d',
    special: true,
    faceGlyphs: { 1: 'pie', 2: 'pie', 3: 'pie', 4: 'pie', 5: 'pie', 6: 'pie' },
  },
  {
    id: 'unlucky_alt',
    name: 'Несчастливая кость',
    description: 'Случается, что удача на твоей стороне, а случается что нет. С этой костью у тебя будет все больше «Нет».',
    weights: [1, 3, 2, 2, 2, 1],
    color: '#787878',
    special: true,
  },
  {
    id: 'pearl',
    name: 'Перламутровая кость',
    description: 'Перламутровая кость, переливающаяся на свету.',
    weights: [3, 1, 1, 1, 3, 3],
    color: '#e8e0f0',
    special: true,
    faceGlyphs: { 1: 'pearl' },
  },
  {
    id: 'devil_head',
    name: 'Игральная кость с головой дьявола',
    description: 'Кость, которая на ощупь кажется горячей. На месте единице у нее дьявольская голова.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#2a0a0a',
    special: false,
    faceGlyphs: { 1: 'devil' },
  },
  {
    id: 'hugo',
    name: 'Кость Гуго',
    description: 'Игральная кость самого преданного завсегдатая «Дыры». На ней изображен его портрет.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#4a2c1a',
    special: false,
    faceGlyphs: { 1: 'portrait' },
  },
  {
    id: 'molar',
    name: 'Игральная кость из коренного зуба',
    description: 'Лучше не выяснять откуда она взялась.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#f5ead4',
    special: false,
    faceGlyphs: { 1: 'molar' },
  },
  {
    id: 'wisdom_tooth',
    name: 'Кость из зуба мудрости',
    description: 'Игральная кость сделанная из зуба мудрости.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#e8dcbf',
    special: false,
    faceGlyphs: { 1: 'tooth' },
  },
  {
    id: 'tooth',
    name: 'Кость из зуба',
    description: 'Игральная кость, сделанная из коренного зуба.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#fff6e0',
    special: false,
    faceGlyphs: { 1: 'tooth' },
  },
  {
    id: 'st_stefan',
    name: 'Кость Святого Стефана',
    description: 'Благословлена самим Святым Стефаном. Гарантирует, что тебе будут выпадать выигрышные числа.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#d4af37',
    special: false,
    faceGlyphs: { 6: 'cross-halo' },
  },
  {
    id: 'kingdom_heaven',
    name: 'Игральная кость Царства небесного',
    description: 'Освящённая кость, что сулит путь в Царство небесное. Единица на ней выпадает чаще прочих граней.',
    weights: [7, 2, 2, 2, 2, 4],
    color: '#dce8ff',
    special: true,
    faceGlyphs: { 1: 'sun' },
  },
  {
    id: 'artist_g',
    name: 'Кость художника (зеленая)',
    description: 'Кость, раскрашенная художником в зеленый цвет.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#2fa84a',
    special: false,
  },
  {
    id: 'artist_r',
    name: 'Кость художника (красная)',
    description: 'Кость, раскрашенная художником в красный цвет.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#d93535',
    special: false,
  },
  {
    id: 'artist_b',
    name: 'Кость художника (синяя)',
    description: 'Кость, раскрашенная художником в синий цвет.',
    weights: [1, 1, 1, 1, 1, 1],
    color: '#2a5fd4',
    special: false,
  },
];

export const DICE_TYPES_MAP = Object.fromEntries(DICE_TYPES.map((d) => [d.id, d]));

export const DEFAULT_LOADOUT = Array(6).fill('normal');

export function modeAllowsSpecialDice(mode) {
  return GAME_MODES[mode]?.allowSpecialDice !== false;
}

// Cosmetic dice (special: false) are unlimited; cheating dice are capped per mode.
export function validateLoadoutArray(loadout, mode = 'pocket') {
  if (!Array.isArray(loadout) || loadout.length !== 6) return null;
  const allowSpecial = modeAllowsSpecialDice(mode);
  const counts = {};
  let specials = 0;
  for (const id of loadout) {
    const dt = DICE_TYPES_MAP[id];
    if (!dt) return null;
    if (!dt.special) continue;
    if (!allowSpecial) return null;
    specials++;
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > MAX_SAME_SPECIAL) return null;
  }
  if (specials > MAX_SPECIAL_DICE) return null;
  return loadout;
}

// Replace every die the mode does not allow with a normal one, keeping the rest in place.
export function sanitizeLoadout(loadout, mode) {
  if (!Array.isArray(loadout) || loadout.length !== 6) return [...DEFAULT_LOADOUT];
  const allowSpecial = modeAllowsSpecialDice(mode);
  const counts = {};
  let specials = 0;
  return loadout.map((id) => {
    const dt = DICE_TYPES_MAP[id];
    if (!dt) return 'normal';
    if (!dt.special) return id;
    if (!allowSpecial || specials >= MAX_SPECIAL_DICE || (counts[id] || 0) >= MAX_SAME_SPECIAL) return 'normal';
    specials++;
    counts[id] = (counts[id] || 0) + 1;
    return id;
  });
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
