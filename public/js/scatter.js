// Where the dice land on the table. Pure geometry, no DOM, so it can be unit-tested.
//
// Every die owns a box: the die, the selection marker under it and a name tag under that. The box is
// reserved for every die, selected or not, so selecting one never makes its tag cover a neighbour.
// Boxes never overlap. If the table is too small, the tags get narrower, then lose their row.

// Die sizes match dice.css: 72px by default, 52px on phones, 44px on phones held sideways.
export const SCATTER_SIZES = {
  phone: { die: 52, labelW: 92, labelH: 16 },
  landscape: { die: 44, labelW: 84, labelH: 15 },
  desktop: { die: 72, labelW: 120, labelH: 18 },
};

export const MARKER_H = 10; // the selection marker under a selected die
const GAP = 10; // between boxes; also covers the up-to-12° tilt of a die
const ATTEMPTS = 200;

// Box geometry for one die: die top-left (x, y) maps to box left = x + offsetX, top = y.
export function boxFor(die, labelW, labelH) {
  const w = Math.max(die, labelW);
  return { w, h: die + MARKER_H + labelH, offsetX: (die - w) / 2 };
}

function overlaps(a, b, box) {
  return Math.abs(a.x - b.x) < box.w + GAP && Math.abs(a.y - b.y) < box.h + GAP;
}

function tryRandom(count, areaW, areaH, die, box, pad) {
  const minX = pad - box.offsetX;
  const maxX = areaW - pad - box.w - box.offsetX;
  const minY = pad;
  const maxY = areaH - pad - box.h;
  if (maxX < minX || maxY < minY) return null;
  const out = [];
  for (let i = 0; i < count; i++) {
    let placed = null;
    for (let attempt = 0; attempt < ATTEMPTS && !placed; attempt++) {
      const p = { x: minX + Math.random() * (maxX - minX), y: minY + Math.random() * (maxY - minY) };
      if (out.every((q) => !overlaps(p, q, box))) placed = p;
    }
    if (!placed) return null;
    out.push(placed);
  }
  return out;
}

// Random cells of a grid, jittered inside their cell: always succeeds when the grid has room.
function tryGrid(count, areaW, areaH, box, pad) {
  const cellW = box.w + GAP;
  const cellH = box.h + GAP;
  const cols = Math.floor((areaW - 2 * pad + GAP) / cellW);
  const rows = Math.floor((areaH - 2 * pad + GAP) / cellH);
  if (cols < 1 || rows < 1 || cols * rows < count) return null;
  const usedCols = Math.min(cols, count);
  const usedRows = Math.ceil(count / usedCols);
  const slackX = (areaW - 2 * pad - usedCols * cellW + GAP) / usedCols;
  const slackY = (areaH - 2 * pad - usedRows * cellH + GAP) / usedRows;
  const cells = [];
  for (let r = 0; r < usedRows; r++) for (let c = 0; c < usedCols; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = cells[i]; cells[i] = cells[j]; cells[j] = t;
  }
  return cells.slice(0, count).map(({ r, c }) => ({
    x: pad + c * (cellW + slackX) + Math.random() * slackX - box.offsetX,
    y: pad + r * (cellH + slackY) + Math.random() * slackY,
  }));
}

/**
 * Returns { positions: [{x, y, rot}], labelW, labelH }: die top-left corners and the tag size that fits.
 * labelH 0 means there is no room for tags under the dice.
 */
export function scatterPositions(count, areaW, areaH, size) {
  const die = size.die;
  const pad = Math.round(die * 0.15);
  const tries = [
    [size.labelW, size.labelH],
    [Math.max(die, Math.round(size.labelW * 0.75)), size.labelH],
    [die, size.labelH],
    [die, 0],
  ];
  for (const [labelW, labelH] of tries) {
    const box = boxFor(die, labelW, labelH);
    const pos = tryRandom(count, areaW, areaH, die, box, pad) || tryGrid(count, areaW, areaH, box, pad);
    if (pos) return { positions: pos.map((p) => ({ x: p.x, y: p.y, rot: (Math.random() - 0.5) * 24 })), labelW, labelH };
  }
  // A table this small cannot hold the dice apart: line them up and let them touch.
  const step = Math.max(0, (areaW - die) / Math.max(1, count - 1));
  const positions = [];
  for (let i = 0; i < count; i++) positions.push({ x: Math.min(i * step, areaW - die), y: Math.max(0, (areaH - die) / 2), rot: 0 });
  return { positions, labelW: die, labelH: 0 };
}
