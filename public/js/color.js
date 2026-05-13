// Hex / HSL утилиты для динамического цвета кубиков.
// hex формат — '#RRGGBB'. HSL формат — [h:0..360, s:0..100, l:0..100].

export function hexToHsl(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return [0, 0, 50];
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToHex(h, s, l) {
  h = ((Number(h) % 360) + 360) % 360;
  s = clamp(Number(s), 0, 100) / 100;
  l = clamp(Number(l), 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const toHex = (v) => {
    const n = Math.round((v + m) * 255);
    return clamp(n, 0, 255).toString(16).padStart(2, '0');
  };
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

/**
 * Сдвинуть lightness на delta (в процентных пунктах HSL, может быть отрицательным).
 * Возвращает новый hex.
 */
export function adjustLightness(hex, delta) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, clamp(l + delta, 0, 100));
}

/**
 * Применить локальный «ползунок яркости» (0..100, центр = 50) к hex-цвету.
 * Возвращает {top, bot} — для двух стопов градиента кубика.
 *
 *   brightness 50  → без смещения
 *   brightness 0   → темнее на ~30 п.п.
 *   brightness 100 → светлее на ~30 п.п.
 *
 * Дополнительно вычисляются два стопа градиента — top чуть светлее базы, bot чуть темнее.
 */
export function computeDieGradient(hex, brightness = 50) {
  const offset = ((clamp(Number(brightness), 0, 100) - 50) / 50) * 30; // ±30 п.п.
  const [h, s, l] = hexToHsl(hex);
  const base = clamp(l + offset, 0, 100);
  return {
    top: hslToHex(h, s, clamp(base + 6, 0, 100)),
    bot: hslToHex(h, s, clamp(base - 6, 0, 100)),
  };
}

function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
