import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hexToHsl, hslToHex, adjustLightness, computeDieGradient } from '../public/js/color.js';

// hexToHsl

test('hexToHsl: #000000 -> [0,0,0]', () => {
  assert.deepEqual(hexToHsl('#000000'), [0, 0, 0]);
});

test('hexToHsl: #ffffff -> [0,0,100]', () => {
  assert.deepEqual(hexToHsl('#ffffff'), [0, 0, 100]);
});

test('hexToHsl: #ff0000 -> [0,100,50]', () => {
  const [h, s, l] = hexToHsl('#ff0000');
  assert.equal(h, 0);
  assert.equal(s, 100);
  assert.equal(l, 50);
});

test('hexToHsl: #00ff00 -> [120,100,50]', () => {
  const [h, s, l] = hexToHsl('#00ff00');
  assert.equal(h, 120);
  assert.equal(s, 100);
  assert.equal(l, 50);
});

test('hexToHsl: невалидный hex -> fallback [0,0,50]', () => {
  assert.deepEqual(hexToHsl('not-a-color'), [0, 0, 50]);
  assert.deepEqual(hexToHsl(''), [0, 0, 50]);
  assert.deepEqual(hexToHsl(null), [0, 0, 50]);
});

// hslToHex

test('hslToHex: [0,0,0] -> #000000', () => {
  assert.equal(hslToHex(0, 0, 0), '#000000');
});

test('hslToHex: [0,0,100] -> #ffffff', () => {
  assert.equal(hslToHex(0, 0, 100), '#ffffff');
});

test('hslToHex: [0,100,50] ~ #ff0000', () => {
  assert.equal(hslToHex(0, 100, 50), '#ff0000');
});

// Round-trip

test('round-trip: hexToHsl + hslToHex сохраняет цвет (с погрешностью)', () => {
  const samples = ['#f4e8c1', '#d9b35a', '#3a7d44', '#4f6d7a', '#c8553d'];
  for (const hex of samples) {
    const [h, s, l] = hexToHsl(hex);
    const back = hslToHex(h, s, l);
    // Допускаем ±2 по каждому каналу из-за округления HSL ↔ RGB
    const orig = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const got = [parseInt(back.slice(1, 3), 16), parseInt(back.slice(3, 5), 16), parseInt(back.slice(5, 7), 16)];
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(orig[i] - got[i]) <= 2, `${hex} -> ${back} расходится на канале ${i}`);
    }
  }
});

// adjustLightness

test('adjustLightness: clamp снизу', () => {
  // Если цвет уже тёмный, lightness не уйдёт ниже 0
  const r = adjustLightness('#000000', -50);
  assert.equal(r, '#000000');
});

test('adjustLightness: clamp сверху', () => {
  // Уже белый — не может стать ещё светлее
  const r = adjustLightness('#ffffff', +50);
  assert.equal(r, '#ffffff');
});

test('adjustLightness: средний цвет +10 светлее, -10 темнее', () => {
  const mid = '#808080'; // l ~50
  const lighter = adjustLightness(mid, 10);
  const darker = adjustLightness(mid, -10);
  const ll = hexToHsl(lighter)[2];
  const ld = hexToHsl(darker)[2];
  assert.ok(ll > 50, `lighter ${lighter} l=${ll} должно быть >50`);
  assert.ok(ld < 50, `darker ${darker} l=${ld} должно быть <50`);
});

// computeDieGradient

test('computeDieGradient: brightness=50 (центр) даёт top чуть светлее bot', () => {
  const { top, bot } = computeDieGradient('#f4e8c1', 50);
  const lTop = hexToHsl(top)[2];
  const lBot = hexToHsl(bot)[2];
  assert.ok(lTop > lBot);
});

test('computeDieGradient: brightness=100 даёт более светлые стопы чем brightness=50', () => {
  const a = computeDieGradient('#888888', 50);
  const b = computeDieGradient('#888888', 100);
  assert.ok(hexToHsl(b.top)[2] > hexToHsl(a.top)[2]);
  assert.ok(hexToHsl(b.bot)[2] > hexToHsl(a.bot)[2]);
});

test('computeDieGradient: brightness=0 даёт более тёмные стопы', () => {
  const a = computeDieGradient('#888888', 50);
  const b = computeDieGradient('#888888', 0);
  assert.ok(hexToHsl(b.top)[2] < hexToHsl(a.top)[2]);
});
