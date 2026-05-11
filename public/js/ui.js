import { scoreSelection } from './engine/scoring.js';
import { TRIPLE_BASE, multiplierForCount, TARGET_OPTIONS } from './engine/rules.js';

const PIP_POSITIONS = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
};

export function dieElement(value, classes = []) {
  const el = document.createElement('div');
  el.className = ['die', ...classes].join(' ');
  el.dataset.value = String(value);
  for (const pos of PIP_POSITIONS[value] || []) {
    const pip = document.createElement('span');
    pip.className = `pip pip-${pos}`;
    el.appendChild(pip);
  }
  return el;
}

export function render(store) {
  const root = document.getElementById('app');
  const state = store.state;

  const reconnectBanner = document.getElementById('reconnect-banner');
  reconnectBanner.hidden = store.connected;

  if (!state) {
    showOnly('lobby-loading');
    return;
  }

  const lobby = document.getElementById('lobby');
  const game = document.getElementById('game');
  const finishedModal = document.getElementById('finished-modal');

  if (state.phase === 'lobby') {
    lobby.hidden = false;
    game.hidden = true;
    finishedModal.hidden = true;
    renderLobby(state, store);
    return;
  }

  if (state.phase === 'playing' || state.phase === 'finished') {
    lobby.hidden = true;
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
    row.className = 'lobby-player' + (p.connected ? ' online' : ' offline');
    row.innerHTML = `<span class="dot"></span><span class="name">${escapeHtml(p.name)}</span>` +
      (p.id === store.myPlayerId ? ' <span class="you">(вы)</span>' : '');
    playersEl.appendChild(row);
  }
  const empty = Math.max(0, 2 - state.players.length);
  for (let i = 0; i < empty; i++) {
    const row = document.createElement('div');
    row.className = 'lobby-player waiting';
    row.innerHTML = '<span class="dot"></span><span class="name">Ожидание игрока…</span>';
    playersEl.appendChild(row);
  }

  const targetSelect = document.getElementById('target-select');
  if (!targetSelect.dataset.bound) {
    for (const t of TARGET_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = String(t);
      opt.textContent = String(t);
      targetSelect.appendChild(opt);
    }
    targetSelect.value = String(state.targetScore);
    targetSelect.dataset.bound = '1';
  }

  const startBtn = document.getElementById('start-btn');
  startBtn.disabled = state.players.length < 2 || !state.players.every((p) => p.connected);
}

function renderGame(state, store) {
  renderScorePanel(state, store);
  renderDice(state, store);
  renderLockedTray(state);
  renderActions(state, store);
  renderLog(state);
}

function renderScorePanel(state, store) {
  const panel = document.getElementById('score-panel');
  panel.innerHTML = '';

  const [p1, p2] = state.players;
  if (!p1 || !p2) return;

  const turn = state.turn || {};
  const selectionScore = computeSelectionScore(state, store);

  const isP1Turn = state.currentPlayerId === p1.id;
  const isP2Turn = state.currentPlayerId === p2.id;

  const table = document.createElement('table');
  table.className = 'score-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th class="p1 ${isP1Turn ? 'current' : ''}">${escapeHtml(p1.name)}${p1.id === store.myPlayerId ? ' (вы)' : ''}</th>
        <th class="mid">Цель</th>
        <th class="p2 ${isP2Turn ? 'current' : ''}">${escapeHtml(p2.name)}${p2.id === store.myPlayerId ? ' (вы)' : ''}</th>
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
        <td class="p1">${isP1Turn ? selectionScore : 0}</td>
        <td class="mid label">отобрано</td>
        <td class="p2">${isP2Turn ? selectionScore : 0}</td>
      </tr>
    </tbody>
  `;
  panel.appendChild(table);
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

  for (let i = 0; i < dice.length; i++) {
    const v = dice[i];
    const selected = store.selection.has(i);
    const classes = [];
    if (selected) classes.push('selected');
    if (!isMine || blocked || store.rolling) classes.push('disabled');
    if (store.rolling) classes.push('rolling');
    const el = dieElement(v, classes);
    el.dataset.idx = String(i);
    if (store.rolling) {
      el.style.animationDelay = `${i * 40}ms`;
    }
    if (isMine && !blocked && !store.rolling) {
      el.addEventListener('click', () => store.toggleSelection(i));
    }
    area.appendChild(el);
  }
}

function renderLockedTray(state) {
  const tray = document.getElementById('locked-tray');
  tray.innerHTML = '';
  const locked = state.turn?.lockedDice || [];
  if (locked.length === 0) {
    tray.classList.add('empty');
    return;
  }
  tray.classList.remove('empty');
  const label = document.createElement('span');
  label.className = 'tray-label';
  label.textContent = 'Отложено:';
  tray.appendChild(label);
  for (const v of locked) {
    tray.appendChild(dieElement(v, ['locked']));
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

  const blocked = turn.isFarkle;

  rollBtn.disabled = !(isMine && turn.awaitingFirstRoll && !blocked);
  sndRoll.disabled = !(isMine && !turn.awaitingFirstRoll && hasValidSelection && !blocked);
  sndBank.disabled = !(isMine && !turn.awaitingFirstRoll && hasValidSelection && !blocked && (turn.roundScore + selScore) > 0);

  rollBtn.hidden = !turn.awaitingFirstRoll;
  sndRoll.hidden = turn.awaitingFirstRoll;
  sndBank.hidden = turn.awaitingFirstRoll;
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
  if (winner) text.textContent = `${winner.name} победил${winner.id === store.myPlayerId ? 'и (вы!)' : ''}!`;
  else text.textContent = 'Игра завершена';
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
    case 'game_started': return `[${ts}] Игра началась (цель ${h.targetScore})`;
    case 'rolled': return `[${ts}] ${who}: бросок [${h.dice.join(', ')}]`;
    case 'held': return `[${ts}] ${who}: отложил [${h.dice.join(', ')}] = ${h.score} (раунд: ${h.roundScore})`;
    case 'farkle': return `[${ts}] ${who}: ЗОНК! −${h.lostScore}`;
    case 'hot_dice': return `[${ts}] ${who}: HOT DICE! Все 6 заново`;
    case 'banked': return `[${ts}] ${who}: банк +${h.score} → ${h.total}`;
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
