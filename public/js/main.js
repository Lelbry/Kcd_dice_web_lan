import { Net } from './net.js';
import { Store } from './state.js';
import { render, showOverlay } from './ui.js';
import { MusicPlayer } from './music.js';

function getClientId() {
  let id = localStorage.getItem('kcd2_client_id');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem('kcd2_client_id', id);
  }
  return id;
}

function getName() {
  return localStorage.getItem('kcd2_player_name') || '';
}

function saveName(name) {
  localStorage.setItem('kcd2_player_name', name);
}

function getDiceBrightness() {
  const v = parseFloat(localStorage.getItem('kcd2_dice_brightness'));
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50;
}

// --- last-room: чтобы при перезагрузке вкладки вернуться в свою комнату ---
const LAST_ROOM_KEY = 'kcd2_last_room';
function getLastRoom() {
  try {
    const raw = localStorage.getItem(LAST_ROOM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setLastRoom(roomAction, roomCode) {
  localStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ roomAction, roomCode, ts: Date.now() }));
}
function clearLastRoom() {
  localStorage.removeItem(LAST_ROOM_KEY);
}

const store = new Store();
const clientId = getClientId();

// --- Музыкальный плеер с сохранением громкости/мьюта в localStorage ---
function loadVolume() {
  const v = parseFloat(localStorage.getItem('kcd2_music_volume'));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
}
function loadMuted() {
  return localStorage.getItem('kcd2_music_muted') === '1';
}
const music = new MusicPlayer({ initialVolume: loadVolume(), initialMuted: loadMuted() });

const wsScheme = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${wsScheme}://${location.host}`;

// roomChoice заполняется до connect(): { roomAction: 'create'|'join', roomCode?: string, name: string }
let roomChoice = null;
let net = null;

function startConnection() {
  if (!roomChoice) return;
  net = new Net(wsUrl, {
    onOpen: () => {
      store.setConnected(true);
      net.send({
        type: 'hello',
        payload: {
          name: roomChoice.name,
          clientId,
          roomAction: roomChoice.roomAction,
          ...(roomChoice.roomCode ? { roomCode: roomChoice.roomCode } : {}),
        },
      });
    },
    onClose: () => {
      store.setConnected(false);
    },
    onState: (snapshot) => {
      if (snapshot?.code && snapshot.code !== store.roomCode) {
        store.setRoomCode(snapshot.code);
      }
      store.setSnapshot(snapshot);
    },
    onEvent: (ev) => {
      store.setLastEvent(ev);
      handleEvent(ev);
    },
    onError: (err) => {
      console.warn('server error:', err);
      handleServerError(err);
    },
  });
  net.connect();
}

function handleServerError(err) {
  if (!err?.code) return;
  if (err.code === 'room_not_found') {
    clearLastRoom();
    showRoomSelect('Комната не найдена. Проверь код или создай новую игру.');
    return;
  }
  if (err.code === 'room_full') {
    clearLastRoom();
    showRoomSelect('В комнате уже два игрока.');
    return;
  }
  if (err.code === 'too_many_rooms') {
    showRoomSelect('Сейчас слишком много активных игр. Попробуй чуть позже.');
    return;
  }
  if (err.code === 'origin_not_allowed') {
    showRoomSelect('Подключение отклонено сервером (Origin).');
    return;
  }
  if (err.code === 'rate_limited') {
    showRoomSelect('Слишком много попыток подключения. Подожди минуту.');
    return;
  }
  if (err.code === 'bad_hello') {
    showRoomSelect('Сервер не принял подключение. Попробуй ещё раз.');
    return;
  }
}

function showRoomSelect(errorMsg) {
  // Закрыть текущий сокет, если был.
  if (net) {
    try { net.close(); } catch {}
    net = null;
  }
  roomChoice = null;
  store.setRoomCode(null);
  store.setSnapshot(null);

  const rs = document.getElementById('room-select');
  rs.hidden = false;
  document.getElementById('lobby').hidden = true;
  document.getElementById('game').hidden = true;
  document.getElementById('finished-modal').hidden = true;
  document.getElementById('room-badge').hidden = true;

  const errEl = document.getElementById('rs-error');
  if (errorMsg) {
    errEl.hidden = false;
    errEl.textContent = errorMsg;
  } else {
    errEl.hidden = true;
  }

  // Префилл имени.
  const nameInput = document.getElementById('rs-name-input');
  if (nameInput && !nameInput.value) {
    nameInput.value = getName() || '';
  }
}

function hideRoomSelect() {
  document.getElementById('room-select').hidden = true;
}

function startCreate(name) {
  saveName(name);
  setLastRoom('create', null);
  roomChoice = { roomAction: 'create', name };
  hideRoomSelect();
  startConnection();
}

function startJoin(name, code) {
  saveName(name);
  setLastRoom('join', code);
  roomChoice = { roomAction: 'join', roomCode: code, name };
  hideRoomSelect();
  startConnection();
}

// --- Анимация броска (как было) ---
const ROLL_DURATION_MS = 2000;
let rollAnimTimer = null;
let rollSwapInterval = null;
let rollAudio = null;

function triggerRollAnimation() {
  try {
    if (rollAudio) {
      try { rollAudio.pause(); } catch {}
    }
    rollAudio = new Audio('/sounds/ShakeAndThrow.mp3');
    rollAudio.volume = 0.9;
    rollAudio.play().catch(() => {});
  } catch {}

  store.setRolling(true);

  if (rollSwapInterval) clearInterval(rollSwapInterval);
  rollSwapInterval = setInterval(() => {
    store._notify();
  }, 80);

  if (rollAnimTimer) clearTimeout(rollAnimTimer);
  rollAnimTimer = setTimeout(() => {
    if (rollSwapInterval) {
      clearInterval(rollSwapInterval);
      rollSwapInterval = null;
    }
    store.setRolling(false);
  }, ROLL_DURATION_MS);
}

function handleEvent(ev) {
  if (!ev?.type) return;
  if (ev.type === 'joined') {
    store.setMyPlayerId(ev.playerId);
    if (ev.roomCode) {
      store.setRoomCode(ev.roomCode);
      // Конвертируем create → join с реальным кодом: при перезагрузке вкладки
      // вернёмся в ту же комнату (по clientId) вместо создания новой.
      setLastRoom('join', ev.roomCode);
    }
    return;
  }
  if (ev.type === 'rolled') {
    triggerRollAnimation();
    return;
  }
  if (ev.type === 'farkle') {
    setTimeout(() => showOverlay('ЗОНК!', 'farkle', 1400), ROLL_DURATION_MS);
    return;
  }
  if (ev.type === 'hotdice') {
    triggerRollAnimation();
    return;
  }
  if (ev.type === 'won') {
    const winner = store.state?.players.find((p) => p.id === ev.playerId);
    const txt = winner ? `${winner.name} победил!` : 'Победа!';
    showOverlay(txt, 'won', 2500);
    return;
  }
  if (ev.type === 'banked') {
    return;
  }
  if (ev.type === 'reconnected') {
    showOverlay('Переподключено', 'info', 1000);
  }
}

store.subscribe(() => render(store));

// --- Реакция музыки на жизненный цикл партии и Lacrimosa-триггер ---
const LACRIMOSA_THRESHOLD_FRAC = 0.9;
let _prevPhase = null;
store.subscribe(() => {
  const state = store.state;
  if (!state) return;

  if (state.phase === 'playing' && _prevPhase !== 'playing') {
    music.startGame();
  } else if (_prevPhase === 'playing' && state.phase !== 'playing') {
    music.stopGame();
  }
  _prevPhase = state.phase;

  if (state.phase === 'playing' && store.myPlayerId) {
    const me = state.players.find((p) => p.id === store.myPlayerId);
    const opp = state.players.find((p) => p.id !== store.myPlayerId);
    if (me && opp && opp.totalScore >= state.targetScore * LACRIMOSA_THRESHOLD_FRAC) {
      music.triggerLacrimosa();
    }
  }
});

function bindRoomSelect() {
  const nameInput = document.getElementById('rs-name-input');
  const codeInput = document.getElementById('rs-code-input');
  const createBtn = document.getElementById('rs-create-btn');
  const joinBtn = document.getElementById('rs-join-btn');

  if (nameInput) nameInput.value = getName() || '';

  function readName() {
    const n = (nameInput?.value || '').trim().slice(0, 20);
    return n || 'Player';
  }

  createBtn.addEventListener('click', () => startCreate(readName()));

  function tryJoin() {
    const code = (codeInput?.value || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{5}$/.test(code)) {
      const errEl = document.getElementById('rs-error');
      errEl.hidden = false;
      errEl.textContent = 'Код — ровно 5 символов (буквы и цифры).';
      return;
    }
    startJoin(readName(), code);
  }
  joinBtn.addEventListener('click', tryJoin);
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryJoin();
  });
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().slice(0, 5);
  });

  // Кнопка «скопировать код» в шапке
  const copyBtn = document.getElementById('copy-code-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = store.roomCode;
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '⧉'; }, 1200);
      } catch {
        // fallback — выделить текст
        const span = document.getElementById('room-code-display');
        const range = document.createRange();
        range.selectNodeContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }
}

function bindUI() {
  document.getElementById('start-btn').addEventListener('click', () => {
    const targetSelect = document.getElementById('target-select');
    const target = Number(targetSelect.value) || 2000;
    net?.send({ type: 'start_game', payload: { targetScore: target } });
  });

  document.getElementById('lobby-players').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'add-bot') {
      net?.send({ type: 'add_bot' });
    } else if (btn.dataset.action === 'remove-bot') {
      net?.send({ type: 'remove_bot' });
    }
  });

  const actionsPanel = document.getElementById('actions-panel');
  actionsPanel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const a = btn.dataset.action;
    if (a === 'roll') {
      net?.send({ type: 'roll' });
    } else if (a === 'score-and-roll') {
      const sel = store.getSelectionArray();
      if (sel.length) net?.send({ type: 'score_and_roll', payload: { selection: sel } });
    } else if (a === 'score-and-bank') {
      const sel = store.getSelectionArray();
      if (sel.length) net?.send({ type: 'score_and_bank', payload: { selection: sel } });
    } else if (a === 'help') {
      toggleHelp(true);
    } else if (a === 'new-game') {
      net?.send({ type: 'new_game' });
    }
  });

  document.getElementById('new-game-btn').addEventListener('click', () => {
    net?.send({ type: 'new_game' });
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => toggleHelp(false));
  });

  const logToggle = document.getElementById('log-toggle');
  if (logToggle) {
    logToggle.addEventListener('click', () => {
      document.getElementById('log-panel').classList.toggle('collapsed');
      render(store);
    });
  }

  // --- Контролы музыки ---
  const muteBtn = document.getElementById('mute-btn');
  const volumeSlider = document.getElementById('volume-slider');

  function updateMuteIcon() {
    if (!muteBtn) return;
    muteBtn.textContent = music.isMuted() || music.getVolume() === 0 ? '🔇' : '🔊';
  }
  if (volumeSlider) {
    volumeSlider.value = String(Math.round(music.getVolume() * 100));
    volumeSlider.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      music.setVolume(v);
      localStorage.setItem('kcd2_music_volume', String(v));
      if (v > 0 && music.isMuted()) {
        music.setMuted(false);
        localStorage.setItem('kcd2_music_muted', '0');
      }
      updateMuteIcon();
    });
  }
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const next = !music.isMuted();
      music.setMuted(next);
      localStorage.setItem('kcd2_music_muted', next ? '1' : '0');
      updateMuteIcon();
    });
  }
  updateMuteIcon();

  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      music.skipTrack();
      const trackName = music.getCurrentTrackName();
      skipBtn.title = trackName ? `Пропустить трек (сейчас: ${trackName})` : 'Пропустить трек';
    });
  }

  const setNameBtn = document.getElementById('set-name-btn');
  const nameInput = document.getElementById('name-input');
  if (nameInput && setNameBtn) {
    setNameBtn.addEventListener('click', () => {
      const newName = (nameInput.value || '').trim().slice(0, 20);
      if (newName) {
        saveName(newName);
        net?.send({ type: 'set_profile', payload: { name: newName } });
      }
    });
  }

  const brightnessSlider = document.getElementById('brightness-slider');
  if (brightnessSlider) {
    brightnessSlider.value = String(getDiceBrightness());
    brightnessSlider.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      localStorage.setItem('kcd2_dice_brightness', String(v));
      store._notify();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (store.state?.turn?.awaitingFirstRoll && store.isMyTurn()) {
        net?.send({ type: 'roll' });
      }
    } else if (e.code === 'KeyF') {
      const sel = store.getSelectionArray();
      if (sel.length && store.isMyTurn() && !store.state.turn.awaitingFirstRoll) {
        net?.send({ type: 'score_and_roll', payload: { selection: sel } });
      }
    } else if (e.code === 'KeyQ') {
      const sel = store.getSelectionArray();
      if (sel.length && store.isMyTurn() && !store.state.turn.awaitingFirstRoll) {
        net?.send({ type: 'score_and_bank', payload: { selection: sel } });
      }
    } else if (e.code === 'KeyT') {
      toggleHelp();
    } else if (e.code === 'Escape') {
      toggleHelp(false);
    }
  });
}

function toggleHelp(force) {
  const modal = document.getElementById('help-modal');
  if (typeof force === 'boolean') modal.hidden = !force;
  else modal.hidden = !modal.hidden;
}

bindRoomSelect();
bindUI();

// Bootstrap: если есть сохранённая комната — пробуем переподключиться,
// иначе показываем экран выбора.
const last = getLastRoom();
const savedName = getName();
if (last && savedName && (last.roomAction === 'join' || last.roomAction === 'create')) {
  // При reconnect: только join (с тем же clientId возвращаемся как тот же игрок).
  // create переоткрывать смысла нет — старая комната уже мертва.
  if (last.roomAction === 'join' && last.roomCode) {
    roomChoice = { roomAction: 'join', roomCode: last.roomCode, name: savedName };
    document.getElementById('room-select').hidden = true;
    startConnection();
  } else {
    showRoomSelect();
  }
} else {
  showRoomSelect();
}

render(store);
