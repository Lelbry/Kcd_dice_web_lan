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
  return localStorage.getItem('kcd2_player_name') || 'Player';
}

function getDiceBrightness() {
  const v = parseFloat(localStorage.getItem('kcd2_dice_brightness'));
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50;
}

const store = new Store();
const clientId = getClientId();
const name = getName();

let lobbyCode = null;
let lobbyJoined = false;

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

const net = new Net(wsUrl, {
  onOpen: () => {
    store.setConnected(true);
    if (lobbyCode && !lobbyJoined) {
      net.send({ type: 'join_lobby', payload: { code: lobbyCode } });
    }
  },
  onClose: () => {
    store.setConnected(false);
  },
  onState: (snapshot) => {
    store.setSnapshot(snapshot);
  },
  onEvent: (ev) => {
    store.setLastEvent(ev);
    handleEvent(ev);
  },
  onError: (err) => {
    console.warn('server error:', err);
    if (err?.code === 'room_full') {
      showLobbyError('Комната заполнена.');
    } else if (err?.code === 'lobby_not_found') {
      showLobbyError('Лобби не найдено. Проверьте код.');
    } else if (err?.code === 'invalid_lobby_code') {
      showLobbyError('Неверный код лобби.');
    }
  },
  onLobbyInfo: (payload) => {
    lobbyCode = payload.code;
    lobbyJoined = true;
    const url = new URL(location.href);
    url.searchParams.set('lobby', payload.code);
    history.replaceState(null, '', url.toString());
    showLobbyWaiting(payload.code);
    net.send({ type: 'hello', payload: { name, clientId } });
  },
});

function showLobbyError(text) {
  const el = document.getElementById('lobby-select-error');
  if (el) {
    el.textContent = text;
    el.hidden = false;
  }
}

function showLobbySelect() {
  document.getElementById('lobby-select').hidden = false;
  document.getElementById('lobby-waiting').hidden = true;
  document.getElementById('game').hidden = true;
  document.getElementById('finished-modal').hidden = true;
}

function showLobbyWaiting(code) {
  document.getElementById('lobby-select').hidden = true;
  document.getElementById('lobby-waiting').hidden = false;

  document.getElementById('lobby-code-text').textContent = code;
  document.getElementById('lobby-link-input').value = `${location.origin}/?lobby=${code}`;
}

// --- Roll animation ---
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

store.subscribe(() => render(store, lobbyCode));

// --- Music lifecycle ---
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

function bindUI() {
  // --- Lobby select ---
  document.getElementById('create-lobby-btn').addEventListener('click', () => {
    net.send({ type: 'create_lobby' });
  });

  document.getElementById('join-lobby-btn').addEventListener('click', () => {
    const code = document.getElementById('join-code-input').value.trim().toUpperCase();
    if (!code) return;
    document.getElementById('lobby-select-error').hidden = true;
    lobbyCode = code;
    lobbyJoined = false;
    net.send({ type: 'join_lobby', payload: { code } });
  });

  document.getElementById('join-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('join-lobby-btn').click();
  });

  document.getElementById('copy-code-btn').addEventListener('click', () => {
    const code = document.getElementById('lobby-code-text').textContent;
    navigator.clipboard?.writeText(code);
  });

  document.getElementById('copy-link-btn').addEventListener('click', () => {
    const link = document.getElementById('lobby-link-input').value;
    navigator.clipboard?.writeText(link);
  });

  // --- Game lobby ---
  document.getElementById('start-btn').addEventListener('click', () => {
    const targetSelect = document.getElementById('target-select');
    const target = Number(targetSelect.value) || 2000;
    net.send({ type: 'start_game', payload: { targetScore: target } });
  });

  document.getElementById('lobby-players').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'add-bot') {
      net.send({ type: 'add_bot' });
    } else if (btn.dataset.action === 'remove-bot') {
      net.send({ type: 'remove_bot' });
    }
  });

  const actionsPanel = document.getElementById('actions-panel');
  actionsPanel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const a = btn.dataset.action;
    if (a === 'roll') {
      net.send({ type: 'roll' });
    } else if (a === 'score-and-roll') {
      const sel = store.getSelectionArray();
      if (sel.length) net.send({ type: 'score_and_roll', payload: { selection: sel } });
    } else if (a === 'score-and-bank') {
      const sel = store.getSelectionArray();
      if (sel.length) net.send({ type: 'score_and_bank', payload: { selection: sel } });
    } else if (a === 'help') {
      toggleHelp(true);
    } else if (a === 'new-game') {
      net.send({ type: 'new_game' });
    }
  });

  document.getElementById('new-game-btn').addEventListener('click', () => {
    net.send({ type: 'new_game' });
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => toggleHelp(false));
  });

  const logToggle = document.getElementById('log-toggle');
  if (logToggle) {
    logToggle.addEventListener('click', () => {
      document.getElementById('log-panel').classList.toggle('collapsed');
      render(store, lobbyCode);
    });
  }

  // --- Music controls ---
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
      const name = music.getCurrentTrackName();
      skipBtn.title = name ? `Пропустить трек (сейчас: ${name})` : 'Пропустить трек';
    });
  }

  const setNameBtn = document.getElementById('set-name-btn');
  const nameInput = document.getElementById('name-input');
  if (nameInput && setNameBtn) {
    nameInput.value = name;
    setNameBtn.addEventListener('click', () => {
      const newName = (nameInput.value || '').trim().slice(0, 20);
      if (newName) {
        localStorage.setItem('kcd2_player_name', newName);
        net.send({ type: 'set_profile', payload: { name: newName } });
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
        net.send({ type: 'roll' });
      }
    } else if (e.code === 'KeyF') {
      const sel = store.getSelectionArray();
      if (sel.length && store.isMyTurn() && !store.state.turn.awaitingFirstRoll) {
        net.send({ type: 'score_and_roll', payload: { selection: sel } });
      }
    } else if (e.code === 'KeyQ') {
      const sel = store.getSelectionArray();
      if (sel.length && store.isMyTurn() && !store.state.turn.awaitingFirstRoll) {
        net.send({ type: 'score_and_bank', payload: { selection: sel } });
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

// --- Init ---
bindUI();

const urlParams = new URLSearchParams(location.search);
const urlLobby = urlParams.get('lobby')?.trim().toUpperCase();
if (urlLobby) {
  lobbyCode = urlLobby;
  lobbyJoined = false;
  showLobbyWaiting(urlLobby);
} else {
  showLobbySelect();
}

net.connect();
render(store, lobbyCode);
