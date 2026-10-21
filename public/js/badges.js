import { BADGES, BADGES_MAP, DEFAULT_BADGE, activationBlocker } from './engine/badges.js';
import { toggleInfoCard } from './infocard.js';

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const BADGE_ICONS = {
  doubling: svg('<path d="M4 7l6 10M10 7l-6 10"/><path d="M13 9.5c0-1.7 1.3-2.5 3-2.5s3 .9 3 2.4c0 2.6-6 4.1-6 7.6h6"/>'),
  resurrection: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/><path d="M12 8v4l2.5 2"/>'),
  transmutation: svg('<path d="M12 3 21 19H3z"/><path d="M7.5 13h9"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>'),
  exchange: svg('<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>'),
  headstart: svg('<path d="M6 21V3"/><path d="M6 4h11l-2.5 4L17 12H6"/>'),
  carpenter: svg('<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7 3 15l3 3 8-8"/>'),
  executioner: svg('<path d="M5 21V3h11"/><path d="M5 7l4-4"/><path d="M15 3v4"/><circle cx="15" cy="10" r="2.6"/><path d="M3 21h6"/>'),
  defence: svg('<path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
};

const BADGE_TIPS = {
  doubling: 'Включите перед тем, как отложить крупную комбинацию: три единицы принесут уже 2000.',
  resurrection: 'Кнопка загорается, когда у вас зонк. На решение есть 6 секунд вместо обычных 3,5.',
  transmutation: 'Нажмите «Применить», затем на кость. Лучше всего — на единственную «пустую» кость: все кости станут зачётными, и будет hot dice.',
  exchange: 'Работает как превращение, только кость перебрасывается: это шанс, а не гарантия.',
  headstart: 'Срабатывает сама: 500 очков уже на счету, когда партия начинается.',
  carpenter: 'Отложите тройку вместе с пятёркой — «Разрез» засчитается сам и сочетается с другими комбинациями.',
  executioner: 'Отложите 4, 5 и 6 вместе — получите «Виселицу». Вместе с единицей это уже 600.',
  defence: 'Гасит одну любую активную бляху соперника. Пока щит цел, на панели видно «щит готов».',
};

const UPCOMING = [
  'Бляха фортуны — переброс нескольких костей после хода',
  'Бляха силы — седьмая кость в броске',
  'Бляха военачальника — бонус к очкам за ход',
  'Бляхи императора, свадьбы и Короля птиц — особые, по одной редкости',
];

export function renderBadgeHelp(container) {
  container.innerHTML = '';
  const intro = document.createElement('div');
  intro.innerHTML = `
    <h3 class="help-section-title">Как играть с бляхой</h3>
    <p class="help-text">В режиме «Игра с бляхой» каждый игрок до начала партии выбирает одну бляху. Бляху соперника видно на панели над столом — нажмите на неё, чтобы прочитать, что она делает.</p>
    <p class="help-text"><strong>Активные</strong> бляхи тратят заряд: примените их кнопкой «Применить» или клавишей <strong>B</strong> в свой ход. <strong>Пассивные</strong> действуют всю партию без участия игрока. Шулерские кости в этом режиме тоже разрешены — как в «Карманных костях».</p>`;
  container.appendChild(intro);

  for (const kind of ['active', 'passive']) {
    const h = document.createElement('h3');
    h.className = 'help-section-title';
    h.textContent = kind === 'active' ? 'Активные бляхи' : 'Пассивные бляхи';
    container.appendChild(h);
    for (const badge of BADGES.filter((b) => b.kind === kind)) {
      const row = document.createElement('div');
      row.className = 'help-badge';
      row.appendChild(medallion(badge.id, ['large']));
      const text = document.createElement('div');
      text.className = 'help-badge-text';
      text.innerHTML = '<div class="help-badge-name"></div><div class="help-badge-kind"></div><div class="help-badge-desc"></div><div class="help-badge-tip"></div>';
      text.querySelector('.help-badge-name').textContent = badge.name;
      text.querySelector('.help-badge-kind').textContent = badgeKindLabel(badge);
      text.querySelector('.help-badge-desc').textContent = badge.description;
      text.querySelector('.help-badge-tip').textContent = BADGE_TIPS[badge.id] || '';
      row.appendChild(text);
      container.appendChild(row);
    }
  }

  const soon = document.createElement('div');
  soon.innerHTML = `
    <h3 class="help-section-title">В следующих версиях</h3>
    <p class="help-text">В KCD2 у большинства блях три редкости — жестяная, серебряная и золотая: от редкости зависят число зарядов или сила эффекта. Сейчас у каждой бляхи одна версия; редкости и новые бляхи появятся позже:</p>
    <ul class="help-list"></ul>`;
  const ul = soon.querySelector('ul');
  for (const line of UPCOMING) {
    const li = document.createElement('li');
    li.textContent = line;
    ul.appendChild(li);
  }
  container.appendChild(soon);
}

export function badgeKindLabel(badge) {
  if (badge.kind === 'passive') return 'Пассивная · действует всю партию';
  return `Активная · ${badge.charges} ${badge.charges === 1 ? 'заряд' : 'заряда'}`;
}

export function medallion(badgeId, extra = []) {
  const el = document.createElement('span');
  el.className = ['badge-medallion', ...extra].join(' ');
  el.dataset.badge = badgeId || '';
  el.innerHTML = BADGE_ICONS[badgeId] || '?';
  return el;
}

function charges(badge, left) {
  const wrap = document.createElement('span');
  wrap.className = 'badge-charges';
  if (badge.kind !== 'active') {
    wrap.textContent = 'пассивная';
    return wrap;
  }
  for (let i = 0; i < badge.charges; i++) {
    const dot = document.createElement('span');
    dot.className = 'charge' + (i < left ? ' full' : '');
    wrap.appendChild(dot);
  }
  return wrap;
}

// --- Lobby ---------------------------------------------------------------

export function renderBadgeLobby(store, mode) {
  const box = document.getElementById('badge-select');
  if (!box) return;
  box.hidden = mode !== 'badge';
  if (box.hidden) return;
  const badge = BADGES_MAP[store.myBadge] || BADGES_MAP[DEFAULT_BADGE];
  const slot = document.getElementById('badge-slot');
  slot.innerHTML = '';
  slot.appendChild(medallion(badge.id, ['large']));
  const info = document.createElement('span');
  info.className = 'badge-slot-info';
  info.innerHTML = `<span class="badge-slot-name"></span><span class="badge-slot-kind"></span><span class="badge-slot-desc"></span>`;
  info.querySelector('.badge-slot-name').textContent = badge.name;
  info.querySelector('.badge-slot-kind').textContent = badgeKindLabel(badge);
  info.querySelector('.badge-slot-desc').textContent = badge.description;
  slot.appendChild(info);
}

export function openBadgePicker(store) {
  const modal = document.getElementById('badge-picker-modal');
  const list = document.getElementById('badge-catalog');
  list.innerHTML = '';
  for (const kind of ['active', 'passive']) {
    const h = document.createElement('div');
    h.className = 'catalog-group';
    h.textContent = kind === 'active' ? 'Активные — по кнопке «Применить» (B)' : 'Пассивные — работают сами';
    list.appendChild(h);
    for (const badge of BADGES.filter((b) => b.kind === kind)) {
      const card = document.createElement('div');
      card.className = 'badge-card' + (badge.id === store.myBadge ? ' active' : '');
      card.dataset.badge = badge.id;
      card.appendChild(medallion(badge.id, ['large']));
      const info = document.createElement('div');
      info.className = 'card-info';
      info.innerHTML = '<div class="card-name"></div><div class="badge-card-kind"></div><div class="card-desc"></div>';
      info.querySelector('.card-name').textContent = badge.name;
      info.querySelector('.badge-card-kind').textContent = badgeKindLabel(badge);
      info.querySelector('.card-desc').textContent = badge.description;
      card.appendChild(info);
      card.addEventListener('click', () => {
        store.setBadge(badge.id);
        modal.hidden = true;
      });
      list.appendChild(card);
    }
  }
  modal.hidden = false;
}

// --- In game ---------------------------------------------------------------

// What the activate button can do right now: null if nothing, or { needsDie, rescue }.
export function activationState(state, store) {
  const me = state.players.find((p) => p.id === store.myPlayerId);
  const badge = BADGES_MAP[me?.badge];
  if (!badge || badge.kind !== 'active' || state.phase !== 'playing' || store.rolling) return null;
  const ctx = { charges: me.badgeCharges, turn: state.turn, isMyTurn: store.isMyTurn(), diceIndex: 0 };
  if (activationBlocker(badge.id, ctx)) return null;
  return { needsDie: badge.target === 'die', rescue: badge.target === 'farkle' };
}

function pulsing(store, player) {
  return store.badgePulse?.playerId === player.id && store.badgePulse.until > Date.now();
}

// Compact badge for the score table (phone layout): medallion, charges, tap for details.
export function scoreBadge(state, store, player) {
  const badge = BADGES_MAP[player.badge];
  if (!badge) return null;
  const mine = player.id === store.myPlayerId;
  const el = document.createElement('span');
  el.className = 'score-badge' + (pulsing(store, player) ? ' pulse' : '');
  el.dataset.inspect = 'badge';
  el.title = badge.name;
  const used = badge.kind === 'active' && player.badgeCharges === 0;
  el.appendChild(medallion(badge.id, used ? ['spent'] : []));
  if (badge.kind === 'active') el.appendChild(charges(badge, player.badgeCharges));
  if (badge.id === 'doubling' && state.turn?.doubleArmed && state.currentPlayerId === player.id) {
    const f = document.createElement('span');
    f.className = 'score-badge-flag';
    f.textContent = '×2';
    el.appendChild(f);
  }
  el.addEventListener('click', () => toggleInfoCard(el, badgeInfo(badge, player, mine), `score-badge:${player.id}`));
  return el;
}

// Phone layout: the badge action lives with the other action buttons.
export function renderBadgeAction(state, store) {
  const btn = document.querySelector('#actions-panel [data-action="badge"]');
  if (!btn) return;
  const me = state.players.find((p) => p.id === store.myPlayerId);
  const badge = BADGES_MAP[me?.badge];
  btn.hidden = !badge || badge.kind !== 'active' || state.phase !== 'playing';
  if (btn.hidden) return;
  const act = activationState(state, store);
  btn.disabled = !act && !store.badgeTargeting;
  btn.classList.toggle('urgent', !!act?.rescue);
  const label = btn.querySelector('.label');
  label.innerHTML = '';
  label.appendChild(medallion(badge.id));
  const text = document.createElement('span');
  if (store.badgeTargeting) text.textContent = 'Отмена — не тратить бляху';
  else if (act?.rescue) text.textContent = 'Воскресить!';
  else text.textContent = `${badge.name} (${me.badgeCharges})`;
  label.appendChild(text);
}

function chip(state, store, player, mine) {
  const badge = BADGES_MAP[player.badge];
  const el = document.createElement('div');
  el.className = `badge-chip ${mine ? 'mine' : 'theirs'}`;
  el.dataset.badge = badge.id;
  el.dataset.playerId = player.id;
  el.dataset.inspect = 'badge';
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    toggleInfoCard(el, badgeInfo(badge, player, mine), `badge:${player.id}`);
  });
  if (pulsing(store, player)) el.classList.add('pulse');
  const used = badge.kind === 'active' && player.badgeCharges === 0;
  el.appendChild(medallion(badge.id, used ? ['spent'] : []));
  const text = document.createElement('span');
  text.className = 'badge-chip-text';
  const owner = document.createElement('span');
  owner.className = 'badge-chip-owner';
  owner.textContent = mine ? 'Ваша бляха' : player.name;
  const name = document.createElement('span');
  name.className = 'badge-chip-name';
  name.textContent = badge.name;
  text.append(owner, name, charges(badge, player.badgeCharges));
  if (badge.shield && player.shield > 0) {
    const s = document.createElement('span');
    s.className = 'badge-chip-flag';
    s.textContent = 'щит готов';
    text.appendChild(s);
  }
  if (badge.id === 'doubling' && state.turn?.doubleArmed && state.currentPlayerId === player.id) {
    const s = document.createElement('span');
    s.className = 'badge-chip-flag hot';
    s.textContent = '×2 на следующие кости';
    text.appendChild(s);
  }
  el.appendChild(text);

  if (mine && badge.kind === 'active') {
    const act = activationState(state, store);
    const btn = document.createElement('button');
    btn.className = 'badge-activate';
    btn.dataset.action = 'badge';
    btn.disabled = !act;
    if (store.badgeTargeting) {
      btn.textContent = 'Отмена';
      btn.classList.add('targeting');
    } else {
      btn.innerHTML = `${act?.rescue ? 'Воскресить!' : 'Применить'} <span class="hotkey">B</span>`;
      if (act?.rescue) btn.classList.add('urgent');
    }
    el.appendChild(btn);
  }
  return el;
}

function badgeInfo(badge, player, mine) {
  const box = document.createElement('div');
  box.className = 'info-badge';
  const head = document.createElement('div');
  head.className = 'info-head';
  head.appendChild(medallion(badge.id, ['large']));
  const titles = document.createElement('div');
  titles.innerHTML = '<div class="info-owner"></div><div class="info-name"></div><div class="info-kind"></div>';
  titles.querySelector('.info-owner').textContent = mine ? 'Ваша бляха' : `Бляха игрока ${player.name}`;
  titles.querySelector('.info-name').textContent = badge.name;
  titles.querySelector('.info-kind').textContent = badge.kind === 'active'
    ? `Активная · осталось зарядов: ${player.badgeCharges} из ${badge.charges}`
    : badgeKindLabel(badge);
  head.appendChild(titles);
  box.appendChild(head);
  const desc = document.createElement('p');
  desc.className = 'info-desc';
  desc.textContent = badge.description;
  box.appendChild(desc);
  if (BADGE_TIPS[badge.id]) {
    const tip = document.createElement('p');
    tip.className = 'info-tip';
    tip.textContent = BADGE_TIPS[badge.id];
    box.appendChild(tip);
  }
  return box;
}

export function renderBadgeBar(state, store) {
  const bar = document.getElementById('badge-bar');
  if (!bar) return;
  const on = state.players.some((p) => p.badge && p.badgeCharges !== undefined);
  bar.hidden = !on;
  if (!on) return;
  bar.innerHTML = '';
  const me = state.players.find((p) => p.id === store.myPlayerId);
  const opp = state.players.find((p) => p.id !== store.myPlayerId);
  if (me?.badge) bar.appendChild(chip(state, store, me, true));
  if (opp?.badge) bar.appendChild(chip(state, store, opp, false));
}

export function renderBadgesReveal(state) {
  const box = document.getElementById('badges-reveal');
  if (!box) return;
  const withBadges = state.players.filter((p) => p.badge);
  box.hidden = withBadges.length === 0;
  if (box.hidden) return;
  const list = box.querySelector('.badges-reveal-list');
  list.innerHTML = '';
  for (const p of withBadges) {
    const badge = BADGES_MAP[p.badge];
    const row = document.createElement('div');
    row.className = 'badges-reveal-row';
    row.appendChild(medallion(badge.id));
    const text = document.createElement('span');
    const used = (p.badgeLog || []).filter((e) => e.type === 'badge_activated').length;
    const blocked = (p.badgeLog || []).filter((e) => e.type === 'badge_blocked').length;
    let summary = badge.kind === 'passive' ? 'работала всю партию' : `применена ${used} из ${badge.charges}`;
    if (blocked) summary += `, сгорело зарядов: ${blocked}`;
    text.textContent = `${p.fullName || p.name} — ${badge.name}: ${summary}`;
    row.appendChild(text);
    list.appendChild(row);
  }
}

export function badgeHistoryText(h, nameOf) {
  const badge = BADGES_MAP[h.badgeId];
  if (!badge) return null;
  const who = nameOf(h.playerId);
  switch (h.type) {
    case 'badge_chosen':
      return `${who} играет с бляхой: ${badge.name}`;
    case 'badge_blocked':
      return `${who}: ${badge.name} сгорела — её погасила Бляха защиты (${nameOf(h.byPlayerId)})`;
    case 'badge_activated':
      if (badge.id === 'transmutation' || badge.id === 'exchange') {
        return `${who}: ${badge.name} — кость ${h.from} → ${h.to}`;
      }
      if (badge.id === 'resurrection') return `${who}: ${badge.name} — зонк отменён, бросок [${h.dice.join(', ')}]`;
      return `${who}: ${badge.name} — следующие кости дадут ×2`;
    default:
      return null;
  }
}
