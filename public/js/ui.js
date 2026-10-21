import { scoreSelection } from './engine/scoring.js';
import { TRIPLE_BASE, multiplierForCount, GAME_MODES, DEFAULT_GAME_MODE } from './engine/rules.js';
import { computeDieGradient, adjustLightness, hexToHsl } from './color.js';
import { DICE_TYPES, DICE_TYPES_MAP, MAX_SPECIAL_DICE, MAX_SAME_SPECIAL } from './engine/dice-types.js';
import { PIP_GLYPHS, FACE_GLYPHS } from './glyphs.js';

const DEFAULT_DICE_COLOR = '#f4e8c1';

function populateTargets(mode) {
  const targetSelect = document.getElementById('target-select');
  const modeCfg = GAME_MODES[mode] || GAME_MODES.classic;
  const current = Number(targetSelect.value);
  targetSelect.innerHTML = '';
  const canon = modeCfg.canonTargets || [];
  for (const t of modeCfg.targets) {
    const opt = document.createElement('option');
    opt.value = String(t);
    opt.textContent = String(t);
    targetSelect.appendChild(opt);
  }
  if (modeCfg.targets.includes(current)) targetSelect.value = String(current);
  else targetSelect.value = String(modeCfg.defaultTarget);
}

function getBrightness() {
  const v = parseFloat(localStorage.getItem('kcd2_dice_brightness'));
  return Number.isFinite(v) ? v : 50;
}

function applyDieColor(el, baseHex, isSpecial = false) {
  const color = baseHex || DEFAULT_DICE_COLOR;
  const { top, bot } = computeDieGradient(color, getBrightness());
  const edge = adjustLightness(color, -28);
  el.style.setProperty('--die-bg-top', top);
  el.style.setProperty('--die-bg-bot', bot);
  el.style.setProperty('--die-edge', edge);
  const [, , l] = hexToHsl(color);
  if (l < 60) el.classList.add('light-pips');
  if (isSpecial) {
    el.classList.add('special-die');
    el.style.setProperty('--die-glow', color);
  }
}

const PIP_POSITIONS = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
};

function previewFace(dt) {
  const faces = Object.keys(dt.faceGlyphs || {}).map(Number);
  return faces.length ? Math.min(...faces) : 3;
}

export function dieElement(value, classes = [], typeId = null) {
  const el = document.createElement('div');
  el.className = ['die', ...classes].join(' ');
  el.dataset.value = String(value);
  if (typeId) el.dataset.type = typeId;
  const glyph = DICE_TYPES_MAP[typeId]?.faceGlyphs?.[value];
  if (glyph && FACE_GLYPHS[glyph]) {
    const g = document.createElement('span');
    g.className = `die-glyph glyph-${glyph}`;
    g.innerHTML = FACE_GLYPHS[glyph];
    el.appendChild(g);
    return el;
  }
  const pipGlyph = glyph && PIP_GLYPHS[glyph];
  for (const pos of PIP_POSITIONS[value] || []) {
    const pip = document.createElement('span');
    pip.className = pipGlyph ? `pip-glyph glyph-${glyph} pip-${pos}` : `pip pip-${pos}`;
    if (pipGlyph) pip.innerHTML = pipGlyph;
    el.appendChild(pip);
  }
  return el;
}

export function render(store, lobbyCode) {
  const state = store.state;

  const reconnectBanner = document.getElementById('reconnect-banner');
  reconnectBanner.hidden = store.connected;

  const lobbySelect = document.getElementById('lobby-select');
  const lobbyWaiting = document.getElementById('lobby-waiting');
  const game = document.getElementById('game');
  const finishedModal = document.getElementById('finished-modal');

  if (!state) {
    if (!lobbyCode) lobbySelect.hidden = false;
    game.hidden = true;
    finishedModal.hidden = true;
    return;
  }

  if (state.phase === 'lobby') {
    lobbySelect.hidden = true;
    lobbyWaiting.hidden = false;
    game.hidden = true;
    finishedModal.hidden = true;
    renderLobby(state, store);
    return;
  }

  if (state.phase === 'playing' || state.phase === 'finished') {
    lobbySelect.hidden = true;
    lobbyWaiting.hidden = true;
    game.hidden = false;
    renderGame(state, store);
    finishedModal.hidden = state.phase !== 'finished';
    if (state.phase === 'finished') renderFinished(state, store);
  }
}

function renderLobby(state, store) {
  const playersEl = document.getElementById('lobby-players');
  playersEl.innerHTML = '';
  for (const p of state.players) {
    const row = document.createElement('div');
    row.className = 'lobby-player' + (p.connected ? ' online' : ' offline') + (p.isBot ? ' is-bot' : '');
    const youBadge = p.id === store.myPlayerId ? ' <span class="you">(вы)</span>' : '';
    const botBadge = p.isBot ? ' <span class="bot-badge" title="бот">🤖</span>' : '';
    row.innerHTML = `<span class="dot"></span><span class="name">${escapeHtml(p.name)}</span>${botBadge}${youBadge}`;
    if (p.isBot) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'ghost small';
      removeBtn.textContent = '× убрать';
      removeBtn.dataset.action = 'remove-bot';
      row.appendChild(removeBtn);
    }
    playersEl.appendChild(row);
  }
  const empty = Math.max(0, 2 - state.players.length);
  for (let i = 0; i < empty; i++) {
    const row = document.createElement('div');
    row.className = 'lobby-player waiting';
    row.innerHTML = '<span class="dot"></span><span class="name">Ожидание игрока…</span>';
    // Кнопка «Добавить бота» — только в свободный слот, и только если есть хоть один человек
    const hasHuman = state.players.some((p) => !p.isBot);
    if (hasHuman) {
      const addBtn = document.createElement('button');
      addBtn.className = 'ghost small';
      addBtn.textContent = '+ Добавить бота';
      addBtn.dataset.action = 'add-bot';
      row.appendChild(addBtn);
    }
    playersEl.appendChild(row);
  }

  const modeSelector = document.getElementById('mode-selector');
  if (modeSelector && !modeSelector.dataset.bound) {
    modeSelector.dataset.bound = '1';
    modeSelector.addEventListener('change', (e) => {
      const radio = e.target.closest('input[name="game-mode"]');
      if (!radio) return;
      store.setSelectedMode(radio.value);
      populateTargets(radio.value);
      const loadoutEl = document.getElementById('dice-loadout');
      if (loadoutEl) loadoutEl.hidden = radio.value !== 'pocket';
    });
  }

  const currentMode = store._selectedMode || DEFAULT_GAME_MODE;
  const modeRadio = modeSelector?.querySelector(`input[value="${currentMode}"]`);
  if (modeRadio && !modeRadio.checked) modeRadio.checked = true;

  const loadoutEl = document.getElementById('dice-loadout');
  if (loadoutEl) loadoutEl.hidden = currentMode !== 'pocket';

  populateTargets(currentMode);

  const startBtn = document.getElementById('start-btn');
  startBtn.disabled = state.players.length < 2 || !state.players.every((p) => p.connected);

  if (currentMode === 'pocket') renderLoadout(store);
}

let _pickerSlotIdx = 0;

function renderLoadout(store) {
  const slotsEl = document.getElementById('loadout-slots');
  if (!slotsEl) return;
  slotsEl.innerHTML = '';
  const loadout = store.getLoadout();
  for (let i = 0; i < 6; i++) {
    const typeId = loadout[i] || 'normal';
    const dt = DICE_TYPES_MAP[typeId];
    const slot = document.createElement('div');
    slot.className = 'loadout-slot' + (dt?.special ? ' special' : '');
    const preview = dieElement(i + 1, ['locked'], typeId);
    applyDieColor(preview, dt?.color || DEFAULT_DICE_COLOR, dt?.special);
    slot.appendChild(preview);
    const nameTag = document.createElement('span');
    nameTag.className = 'slot-name';
    nameTag.textContent = dt?.special ? dt.name : '';
    slot.title = dt?.name || '';
    slot.appendChild(nameTag);
    slot.addEventListener('click', () => openDicePicker(store, i));
    slotsEl.appendChild(slot);
  }
}

function openDicePicker(store, slotIdx) {
  _pickerSlotIdx = slotIdx;
  const modal = document.getElementById('dice-picker-modal');
  const catalog = document.getElementById('dice-catalog');
  modal.hidden = false;
  catalog.innerHTML = '';

  const loadout = store.getLoadout();
  const currentSpecials = loadout.filter((id) => DICE_TYPES_MAP[id]?.special).length;
  const currentSlotIsSpecial = DICE_TYPES_MAP[loadout[slotIdx]]?.special;

  for (const dt of DICE_TYPES) {
    const card = document.createElement('div');
    const isActive = loadout[slotIdx] === dt.id;
    const atSpecialLimit = dt.special && !currentSlotIsSpecial && currentSpecials >= MAX_SPECIAL_DICE;
    const sameCount = loadout.filter((id) => id === dt.id).length;
    const atDupeLimit = dt.special && !isActive && sameCount >= MAX_SAME_SPECIAL;
    const atLimit = atSpecialLimit || atDupeLimit;
    card.className = 'dice-type-card' + (isActive ? ' active' : '') + (atLimit ? ' disabled' : '');

    const preview = dieElement(previewFace(dt), ['locked'], dt.id);
    applyDieColor(preview, dt.color, dt.special);
    card.appendChild(preview);

    const info = document.createElement('div');
    info.className = 'card-info';
    const stockLabel = dt.special ? ` <span class="card-stock">в наличии: ${MAX_SAME_SPECIAL - sameCount + (isActive ? 1 : 0)}</span>` : '';
    info.innerHTML = `<div class="card-name">${escapeHtml(dt.name)}${stockLabel}</div><div class="card-desc">${escapeHtml(dt.description)}</div>`;
    card.appendChild(info);

    const bars = document.createElement('div');
    bars.className = 'prob-bars';
    const total = dt.weights.reduce((s, w) => s + w, 0);
    for (let f = 0; f < 6; f++) {
      const pct = total > 0 ? Math.round((dt.weights[f] / total) * 100) : 0;
      const bar = document.createElement('div');
      bar.className = 'prob-bar';
      bar.innerHTML = `<span class="bar-face">${f + 1}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-pct">${pct}%</span>`;
      bars.appendChild(bar);
    }
    card.appendChild(bars);

    if (!atLimit) {
      card.addEventListener('click', () => {
        if (store.setLoadoutSlot(_pickerSlotIdx, dt.id)) {
          modal.hidden = true;
          store._notify();
        }
      });
    }
    catalog.appendChild(card);
  }
}

function renderGame(state, store) {
  renderTurnIndicator(state, store);
  renderScorePanel(state, store);
  renderDice(state, store);
  renderLockedTray(state, store);
  renderActions(state, store);
  renderLog(state);
}

function renderTurnIndicator(state, store) {
  const el = document.getElementById('turn-indicator');
  if (!el) return;
  const textEl = document.getElementById('turn-indicator-text');
  if (state.phase !== 'playing') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const isMine = store.isMyTurn();
  el.classList.toggle('mine', isMine);
  el.classList.toggle('theirs', !isMine);
  const modeCfg = GAME_MODES[state.gameMode] || GAME_MODES[DEFAULT_GAME_MODE];
  const modeTag = ` · ${modeCfg.name}`;
  if (isMine) {
    const hint = state.turn?.awaitingFirstRoll ? '  (Space = бросить)' : '';
    textEl.textContent = `Ваш ход${modeTag}${hint}`;
  } else {
    const oppName = nameOf(state, state.currentPlayerId);
    textEl.textContent = `Ход: ${oppName}${modeTag}`;
  }
}

function renderScorePanel(state, store) {
  const panel = document.getElementById('score-panel');
  panel.innerHTML = '';

  const [p1, p2] = state.players;
  if (!p1 || !p2) return;

  const turn = state.turn || {};
  const selectionScore = computeSelectionScore(state, store);
  const oppSelScore = computeOpponentSelectionScore(state, store);

  const isP1Turn = state.currentPlayerId === p1.id;
  const isP2Turn = state.currentPlayerId === p2.id;

  const p1IsMe = p1.id === store.myPlayerId;
  const p1SelScore = p1IsMe ? selectionScore : oppSelScore;
  const p2SelScore = p1IsMe ? oppSelScore : selectionScore;

  const offlineMark = (p) => p.connected ? '' : ' <span class="offline-dot" title="нет связи">●</span>';
  const youMark = (p) => p.id === store.myPlayerId ? ' (вы)' : '';

  const table = document.createElement('table');
  table.className = 'score-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th class="p1 ${isP1Turn ? 'current' : ''}">${escapeHtml(p1.name)}${youMark(p1)}${offlineMark(p1)}</th>
        <th class="mid">Цель</th>
        <th class="p2 ${isP2Turn ? 'current' : ''}">${escapeHtml(p2.name)}${youMark(p2)}${offlineMark(p2)}</th>
      </tr>
    </thead>
    <tbody>
      <tr class="total-row">
        <td class="p1">${p1.totalScore}</td>
        <td class="mid">${state.targetScore}</td>
        <td class="p2">${p2.totalScore}</td>
      </tr>
      <tr>
        <td class="p1">${isP1Turn ? turn.roundScore || 0 : 0}</td>
        <td class="mid label">раунд</td>
        <td class="p2">${isP2Turn ? turn.roundScore || 0 : 0}</td>
      </tr>
      <tr>
        <td class="p1">${isP1Turn ? p1SelScore : 0}</td>
        <td class="mid label">отобрано</td>
        <td class="p2">${isP2Turn ? p2SelScore : 0}</td>
      </tr>
    </tbody>
  `;
  panel.appendChild(table);
}

function scatterPositions(count, areaW, areaH, dieSize) {
  const pad = dieSize * 0.15;
  const half = dieSize / 2;
  const minDist = dieSize * 1.4;
  const positions = [];
  const maxX = areaW - dieSize - pad;
  const maxY = areaH - dieSize - pad;
  for (let i = 0; i < count; i++) {
    let x, y, ok;
    for (let attempt = 0; attempt < 200; attempt++) {
      x = pad + Math.random() * (maxX - pad);
      y = pad + Math.random() * (maxY - pad);
      ok = true;
      for (const p of positions) {
        const dx = (x + half) - (p.x + half), dy = (y + half) - (p.y + half);
        if (Math.sqrt(dx * dx + dy * dy) < minDist) { ok = false; break; }
      }
      if (ok) break;
    }
    positions.push({ x, y, rot: (Math.random() - 0.5) * 24 });
  }
  for (let iter = 0; iter < 50; iter++) {
    let moved = false;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j];
        const dx = (b.x + half) - (a.x + half), dy = (b.y + half) - (a.y + half);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2 + 1;
          const angle = dist > 0.1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
          const mx = Math.cos(angle) * overlap, my = Math.sin(angle) * overlap;
          a.x -= mx; a.y -= my;
          b.x += mx; b.y += my;
          moved = true;
        }
      }
    }
    for (const p of positions) {
      p.x = Math.max(pad, Math.min(maxX, p.x));
      p.y = Math.max(pad, Math.min(maxY, p.y));
    }
    if (!moved) break;
  }
  return positions;
}

function renderDice(state, store) {
  const area = document.getElementById('dice-area');
  area.innerHTML = '';
  const turn = state.turn || {};
  const dice = turn.diceOnTable || [];
  const isMine = store.isMyTurn();
  const blocked = turn.isFarkle || turn.awaitingFirstRoll;

  if (turn.awaitingFirstRoll) {
    const hint = document.createElement('div');
    hint.className = 'turn-hint';
    if (isMine) hint.textContent = 'Ваш ход. Нажмите «Бросить» или Space.';
    else hint.textContent = `Ход игрока ${nameOf(state, state.currentPlayerId)}…`;
    area.appendChild(hint);
    return;
  }

  const diceTypeIds = turn.diceTypeIds || [];

  const areaRect = area.getBoundingClientRect();
  const isMobile = window.innerWidth <= 600;
  const dieSize = isMobile ? 52 : 72;
  const areaW = areaRect.width || 300;
  const areaH = areaRect.height || 200;

  const diceKey = dice.join(',');
  if (!area._scatterSeeds || area._scatterKey !== diceKey) {
    area._scatterKey = diceKey;
    area._scatterSeeds = scatterPositions(dice.length, areaW, areaH, dieSize);
  }

  for (let i = 0; i < dice.length; i++) {
    const realV = dice[i];
    const displayV = store.rolling ? (1 + Math.floor(Math.random() * 6)) : realV;
    const selected = store.selection.has(i);
    const opponentSelected = !isMine && store.opponentSelection.has(i);
    const classes = [];
    if (selected) classes.push('selected');
    if (opponentSelected) classes.push('opponent-selected');
    if (!isMine || blocked || store.rolling) classes.push('disabled');
    if (store.rolling) classes.push('rolling');
    const typeId = diceTypeIds[i] || 'normal';
    const el = dieElement(displayV, classes, typeId);
    const diceType = DICE_TYPES_MAP[typeId];
    applyDieColor(el, diceType?.color || DEFAULT_DICE_COLOR, diceType?.special);
    if (diceType?.special) el.title = diceType.name;
    el.dataset.idx = String(i);

    const s = area._scatterSeeds[i];
    if (store.rolling) {
      el.style.left = `${areaW / 2 - dieSize / 2}px`;
      el.style.top = `${areaH / 2 - dieSize / 2}px`;
      el.style.animationDelay = `${i * 35}ms`;
    } else {
      el.style.left = `${s.x}px`;
      el.style.top = `${s.y}px`;
      el.style.transform = `rotate(${s.rot}deg)`;
    }

    if (isMine && !blocked && !store.rolling) {
      el.addEventListener('click', () => store.toggleSelection(i));
    }
    area.appendChild(el);
  }
}

function renderLockedTray(state, store) {
  const tray = document.getElementById('locked-tray');
  tray.innerHTML = '';
  const locked = state.turn?.lockedDice || [];
  const dice = state.turn?.diceOnTable || [];
  const isMine = store.isMyTurn();
  const oppIndices = !isMine ? [...store.opponentSelection] : [];
  const oppValues = oppIndices
    .map((i) => dice[i])
    .filter((v) => v !== undefined);

  if (locked.length === 0 && oppValues.length === 0) {
    tray.classList.add('empty');
    return;
  }
  tray.classList.remove('empty');
  const lockedTypeIds = state.turn?.lockedDiceTypeIds || [];
  const diceTypeIds = state.turn?.diceTypeIds || [];

  if (locked.length > 0) {
    const label = document.createElement('span');
    label.className = 'tray-label';
    label.textContent = 'Отложено:';
    tray.appendChild(label);
    for (let i = 0; i < locked.length; i++) {
      const typeId = lockedTypeIds[i] || 'normal';
      const el = dieElement(locked[i], ['locked'], typeId);
      const dt = DICE_TYPES_MAP[typeId];
      applyDieColor(el, dt?.color || DEFAULT_DICE_COLOR, dt?.special);
      tray.appendChild(el);
    }
  }

  if (oppValues.length > 0) {
    const sep = document.createElement('span');
    sep.className = 'tray-label tentative-label';
    sep.textContent = 'Выбирает:';
    tray.appendChild(sep);
    for (let j = 0; j < oppIndices.length; j++) {
      const v = dice[oppIndices[j]];
      if (v === undefined) continue;
      const typeId = diceTypeIds[oppIndices[j]] || 'normal';
      const el = dieElement(v, ['locked', 'tentative'], typeId);
      const dt2 = DICE_TYPES_MAP[typeId];
      applyDieColor(el, dt2?.color || DEFAULT_DICE_COLOR, dt2?.special);
      tray.appendChild(el);
    }
  }
}

function renderActions(state, store) {
  const panel = document.getElementById('actions-panel');
  const turn = state.turn || {};
  const isMine = store.isMyTurn();
  const selection = store.getSelectionArray();
  const selScore = computeSelectionScore(state, store);
  const hasValidSelection = selScore > 0;

  const rollBtn = panel.querySelector('[data-action="roll"]');
  const sndRoll = panel.querySelector('[data-action="score-and-roll"]');
  const sndBank = panel.querySelector('[data-action="score-and-bank"]');

  // Во время тряски (2с) и farkle-показа кнопки нельзя жать
  const blocked = turn.isFarkle || store.rolling;

  rollBtn.disabled = !(isMine && turn.awaitingFirstRoll && !blocked);
  sndRoll.disabled = !(isMine && !turn.awaitingFirstRoll && hasValidSelection && !blocked);
  sndBank.disabled = !(isMine && !turn.awaitingFirstRoll && hasValidSelection && !blocked && (turn.roundScore + selScore) > 0);

  rollBtn.hidden = !turn.awaitingFirstRoll;
  sndRoll.hidden = turn.awaitingFirstRoll;
  sndBank.hidden = turn.awaitingFirstRoll;

  const surrenderBtn = panel.querySelector('[data-action="surrender"]');
  if (surrenderBtn) surrenderBtn.hidden = false;
}

function renderLog(state) {
  const log = document.getElementById('log-panel');
  if (log.classList.contains('collapsed')) return;
  const list = log.querySelector('.log-list') || (() => {
    const el = document.createElement('div');
    el.className = 'log-list';
    log.appendChild(el);
    return el;
  })();
  list.innerHTML = '';
  const history = (state.history || []).slice(-20).reverse();
  for (const h of history) {
    const row = document.createElement('div');
    row.className = 'log-row';
    row.textContent = formatHistory(h, state);
    list.appendChild(row);
  }
}

function renderFinished(state, store) {
  const text = document.getElementById('winner-text');
  const winner = state.players.find((p) => p.id === state.winnerId);
  if (winner) {
    const display = winner.fullName || winner.name;
    text.textContent = `${display} победил${winner.id === store.myPlayerId ? 'и (вы!)' : '!'}`;
  } else {
    text.textContent = 'Игра завершена';
  }

  const reveal = document.getElementById('bot-reveal');
  const bot = state.players.find((p) => p.isBot);
  if (reveal) {
    if (bot && bot.fullName) {
      reveal.hidden = false;
      document.getElementById('bot-reveal-name').textContent = bot.fullName;
      document.getElementById('bot-reveal-desc').textContent = describeMood(bot.mood);
    } else {
      reveal.hidden = true;
    }
  }
}

const MOOD_DESCRIPTIONS = {
  cautious: 'играл осторожно, банковал рано',
  calculated: 'действовал сбалансированно',
  bold: 'шёл на лишние броски, охотился за hot dice',
  reckless: 'катил кости почти до конца хода каждый раз',
  'cold-blooded': 'играл хладнокровно, без эмоций',
  wild: 'был непредсказуем — порой банковал гроши, порой шёл ва-банк',
};
function describeMood(mood) {
  return MOOD_DESCRIPTIONS[mood] || '';
}

function computeSelectionScore(state, store) {
  if (!store.isMyTurn()) return 0;
  const dice = state.turn?.diceOnTable || [];
  const sel = store.getSelectionArray();
  if (sel.length === 0) return 0;
  const values = sel.map((i) => dice[i]).filter((v) => v !== undefined);
  if (values.length !== sel.length) return 0;
  const r = scoreSelection(values);
  return r.valid ? r.score : 0;
}

function computeOpponentSelectionScore(state, store) {
  if (store.isMyTurn()) return 0;
  const dice = state.turn?.diceOnTable || [];
  const indices = [...store.opponentSelection];
  if (indices.length === 0) return 0;
  const values = indices.map((i) => dice[i]).filter((v) => v !== undefined);
  if (values.length !== indices.length) return 0;
  const r = scoreSelection(values);
  return r.valid ? r.score : 0;
}

export function showOverlay(text, kind = 'info', durationMs = 1800) {
  const overlay = document.getElementById('overlay');
  overlay.hidden = false;
  overlay.className = `overlay overlay-${kind}`;
  overlay.textContent = text;
  clearTimeout(showOverlay._t);
  showOverlay._t = setTimeout(() => {
    overlay.hidden = true;
  }, durationMs);
}

function nameOf(state, playerId) {
  return state.players.find((p) => p.id === playerId)?.name || '?';
}

function formatHistory(h, state) {
  const ts = new Date(h.ts).toLocaleTimeString();
  const who = h.playerId ? nameOf(state, h.playerId) : '';
  switch (h.type) {
    case 'game_started': {
      const firstName = h.firstPlayerId ? nameOf(state, h.firstPlayerId) : null;
      return firstName
        ? `[${ts}] Игра началась (цель ${h.targetScore}), первым ходит ${firstName}`
        : `[${ts}] Игра началась (цель ${h.targetScore})`;
    }
    case 'rolled': return `[${ts}] ${who}: бросок [${h.dice.join(', ')}]`;
    case 'held': return `[${ts}] ${who}: отложил [${h.dice.join(', ')}] = ${h.score} (раунд: ${h.roundScore})`;
    case 'farkle': return `[${ts}] ${who}: ЗОНК! −${h.lostScore}`;
    case 'hot_dice': return `[${ts}] ${who}: HOT DICE! Все 6 заново`;
    case 'banked': return `[${ts}] ${who}: банк +${h.score} → ${h.total}`;
    case 'surrendered': return `[${ts}] ${who}: сдался`;
    case 'won': return `[${ts}] ${who}: ПОБЕДА!`;
    case 'turn_passed': return `[${ts}] Ход переходит к ${nameOf(state, h.toPlayerId)}`;
    case 'aborted': return `[${ts}] Партия прервана (${h.reason})`;
    default: return `[${ts}] ${h.type}`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function showOnly(id) {
  // placeholder for early-load state
}
