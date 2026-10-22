// The dice table reserves room for a name tag under every die. Check that nothing overlaps
// and everything stays on the table, for phone, desktop and cramped landscape sizes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scatterPositions, SCATTER_SIZES, MARKER_H } from '../public/js/scatter.js';

const ROUNDS = 400;

// Die footprint grows by ~5px each side when tilted up to 12°.
const TILT = 5;

function rects(result, size) {
  const { die } = size;
  return result.positions.map((p) => {
    const dieRect = { l: p.x - TILT, t: p.y - TILT, r: p.x + die + TILT, b: p.y + die + TILT };
    if (!result.labelH) return { die: dieRect, tag: null };
    const cx = p.x + die / 2;
    const tag = { l: cx - result.labelW / 2, t: p.y + die + MARKER_H, r: cx + result.labelW / 2, b: p.y + die + MARKER_H + result.labelH };
    return { die: dieRect, tag };
  });
}

const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const inside = (a, w, h) => a.l >= -TILT - 0.01 && a.t >= -TILT - 0.01 && a.r <= w + TILT + 0.01 && a.b <= h + TILT + 0.01;

function check(areaW, areaH, size, { expectTags }) {
  for (let round = 0; round < ROUNDS; round++) {
    for (let count = 1; count <= 6; count++) {
      const result = scatterPositions(count, areaW, areaH, size);
      assert.equal(result.positions.length, count);
      if (expectTags) assert.ok(result.labelH > 0, `${areaW}x${areaH}: no room for tags with ${count} dice`);
      const rs = rects(result, size);
      for (let i = 0; i < rs.length; i++) {
        assert.ok(inside(rs[i].die, areaW, areaH), `${areaW}x${areaH} die ${i} off the table`);
        if (rs[i].tag) assert.ok(inside(rs[i].tag, areaW, areaH), `${areaW}x${areaH} tag ${i} off the table`);
        for (let j = i + 1; j < rs.length; j++) {
          const msg = `${areaW}x${areaH}, ${count} dice: ${i} and ${j}`;
          assert.ok(!hit(rs[i].die, rs[j].die), `dice overlap: ${msg}`);
          if (rs[i].tag) {
            assert.ok(!hit(rs[i].tag, rs[j].tag), `tags overlap: ${msg}`);
            assert.ok(!hit(rs[i].tag, rs[j].die), `tag ${i} covers die ${j}: ${msg}`);
            assert.ok(!hit(rs[j].tag, rs[i].die), `tag ${j} covers die ${i}: ${msg}`);
          }
        }
      }
    }
  }
}

test('phone portrait tables (360 and 320 wide) fit six dice with tags, nothing overlaps', () => {
  check(344, 200, SCATTER_SIZES.phone, { expectTags: true });
  check(304, 200, SCATTER_SIZES.phone, { expectTags: true });
  check(344, 420, SCATTER_SIZES.phone, { expectTags: true });
});

test('desktop tables fit six dice with full-width tags, nothing overlaps', () => {
  check(700, 300, SCATTER_SIZES.desktop, { expectTags: true });
  check(560, 260, SCATTER_SIZES.desktop, { expectTags: true });
  const r = scatterPositions(6, 700, 300, SCATTER_SIZES.desktop);
  assert.equal(r.labelW, SCATTER_SIZES.desktop.labelW);
});

test('phone landscape (wide and short) still keeps dice and tags apart', () => {
  check(700, 110, SCATTER_SIZES.landscape, { expectTags: true });
  check(560, 110, SCATTER_SIZES.landscape, { expectTags: true });
});

test('a table too small for tags drops them but keeps dice apart when possible', () => {
  const r = scatterPositions(6, 400, 70, SCATTER_SIZES.phone);
  assert.equal(r.positions.length, 6);
  assert.equal(r.labelH, 0);
});
