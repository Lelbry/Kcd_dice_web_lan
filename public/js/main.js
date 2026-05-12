import { Net } from './net.js';
import { Store } from './state.js';
import { render, showOverlay } from './ui.js';

function getClientId() {
  let id = localStorage.getItem('kcd2_client_id');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem('kcd2_client_id', id);
  }
  return id;
}

function getName() {
  let name = localStorage.getItem('kcd2_player_name');
  if (!name) {
    name = prompt('Ваше имя?', 'Player')?.trim() || 'Player';
    localStorage.setItem('kcd2_player_name', name);
  }
  return name;
}

const store = new Store();
const clientId = getClientId();
const name = getName();

const wsScheme = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${wsScheme}://${location.host}`;

const net = new Net(wsUrl, {
  onOpen: () => {
    store.setConnected(true);
    net.send({ type: 'hello', payload: { name, clientId } });
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
      alert('Комната заполнена.');
    }
  },
});

const ROLL_DURATION_MS = 2000;
let rollAnimTimer = null;
let rollSwapInterval = null;
let rollAudio = null;

function triggerRollAnimation() {
  // Звук взбалтывания и броска (~2 сек). Создаём новый Audio каждый раз,
  // чтобы можно было перекрывать броски без ожидания загрузки.
  try {
    if (rollAudio) {
      try { rollAudio.pause(); } catch {}
    }
    rollAudio = new Audio('/sounds/ShakeAndThrow.mp3');
    rollAudio.volume = 0.9;
    rollAudio.play().catch(() => {
      // autoplay может быть заблокирован до первого клика — игнорируем
    });
  } catch {}

  store.setRolling(true);

  // Перерисовки каждые 80 мс — кубики «трясутся» (рандомные грани в renderDice)
  if (rollSwapInterval) clearInterval(rollSwapInterval);
  rollSwapInterval = setInterval(() => {
    // Лёгкий пинок store для re-render
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
    // Сначала кубики долбятся 2с и приземляются на свой провальный расклад,
    // потом всплывает «ЗОНК!» — игрок видит, что выпало.
    setTimeout(() => showOverlay('ЗОНК!', 'farkle', 1400), ROLL_DURATION_MS);
    return;
  }
  if (ev.type === 'hotdice') {
    triggerRollAnimation();
    // HOT DICE! всплывает после settle новых 6 кубиков
    setTimeout(() => showOverlay('HOT DICE!', 'hotdice', 1400), ROLL_DURATION_MS);
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

function bindUI() {
  document.getElementById('start-btn').addEventListener('click', () => {
    const targetSelect = document.getElementById('target-select');
    const target = Number(targetSelect.value) || 2000;
    net.send({ type: 'start_game', payload: { targetScore: target } });
  });

  // Делегирование для кнопок «Добавить бота» / «убрать», которые рендерятся
  // динамически внутри lobby-players.
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
      render(store);
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
        net.send({ type: 'hello', payload: { name: newName, clientId } });
      }
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

bindUI();
net.connect();
render(store);
