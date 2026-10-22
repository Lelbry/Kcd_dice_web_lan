import { BADGES, BADGES_MAP, DEFAULT_BADGE, BADGE_TIERS, BADGE_TIER_NAMES, badgeStats, badgeText, activationBlocker } from './engine/badges.js';
import { toggleInfoCard } from './infocard.js';

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const BADGE_ICONS = {
  doubling: svg('<path d="M4 7l6 10M10 7l-6 10"/><path d="M13 9.5c0-1.7 1.3-2.5 3-2.5s3 .9 3 2.4c0 2.6-6 4.1-6 7.6h6"/>'),
  resurrection: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/><path d="M12 8v4l2.5 2"/>'),
  transmutation: svg('<path d="M12 3 21 19H3z"/><path d="M7.5 13h9"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>'),
  fortune: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'),
  might: svg('<rect x="3" y="7" width="10" height="10" rx="2"/><circle cx="8" cy="12" r="1.2" fill="currentColor"/><path d="M18 8v8M14 12h8"/>'),
  warlord: svg('<path d="M4 20 18 6"/><path d="M15 4h5v5"/><path d="M6 14l4 4"/><path d="M3 21l3-3"/>'),
  exchange: svg('<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>'),
  bird_king: svg('<path d="M3 13c4 0 6-3 9-7 3 4 5 7 9 7"/><path d="M8 13l4 6 4-6"/><path d="M9 6l3-3 3 3"/>'),
  wedding: svg('<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 6l2-3 2 3"/>'),
  headstart: svg('<path d="M6 21V3"/><path d="M6 4h11l-2.5 4L17 12H6"/>'),
  defence: svg('<path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  emperor: svg('<path d="M4 17 3 7l5 4 4-7 4 7 5-4-1 10z"/><path d="M4 20h16"/>'),
  carpenter: svg('<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7 3 15l3 3 8-8"/>'),
  executioner: svg('<path d="M5 21V3h11"/><path d="M5 7l4-4"/><path d="M15 3v4"/><circle cx="15" cy="10" r="2.6"/><path d="M3 21h6"/>'),
};

// Special badges have one rarity in KCD2; their medallion keeps that metal whatever the game's tier.
const SPECIAL_LOOK = { exchange: 'silver', bird_king: 'silver', wedding: 'gold', emperor: 'gold', carpenter: 'tin', executioner: 'tin' };

const BADGE_TIPS = {
  doubling: 'Включите перед тем, как отложить крупную комбинацию: три единицы принесут уже 2000.',
  resurrection: 'Кнопка загорается, когда у вас зонк. На решение есть 6 секунд вместо обычных 3,5.',
  transmutation: 'Нажмите «Применить», затем на кость. Лучше всего — на единственную «пустую» кость: все кости станут зачётными, и будет hot dice.',
  fortune: 'Нажмите «Применить», отметьте кости, которые не нравятся, и нажмите «Перебросить».',
  might: 'Применяйте в начале хода, до броска: седьмая кость будет и после hot dice.',
  warlord: 'Включите, когда ход обещает много очков: бонус считается при записи в банк. Зонк сжигает его вместе с очками хода.',
  exchange: 'Работает как превращение, только кость перебрасывается: это шанс, а не гарантия.',
  bird_king: 'Как Бляха силы, но с двумя зарядами на любом уровне.',
  wedding: 'Как Бляха фортуны, но сразу до трёх костей на любом уровне.',
  headstart: 'Срабатывает сама: очки уже на счету, когда партия начинается.',
  defence: 'Гасит активные бляхи соперника, пока есть щиты. Пока щит цел, на панели видно «щит готов».',
  emperor: 'Три единицы приносят 2000 — вдвое больше обычного. Четыре единицы — 2100.',
  carpenter: 'Отложите тройку вместе с пятёркой — «Разрез» засчитается сам и сочетается с другими комбинациями.',
  executioner: 'Отложите 4, 5 и 6 вместе — получите «Виселицу». Вместе с единицей это уже 600.',
};

function plural(n, one, few, many) {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

const chargesWord = (n) => `${n} ${plural(n, 'заряд', 'заряда', 'зарядов')}`;

// One tier of a badge in a few words, for the help table.
function tierShort(badge, tier) {
  const st = badgeStats(badge.id, tier);
  if (badge.id === 'headstart') return `${st.startBonus} очков`;
  if (badge.id === 'defence') return `${st.shield} ${plural(st.shield, 'щит', 'щита', 'щитов')}`;
  if (badge.id === 'warlord') return `+${Math.round((st.bankMultiplier - 1) * 100)}%`;
  if (badge.target === 'dice') return `${chargesWord(st.charges)}, до ${st.rerollMax}`;
  return chargesWord(st.charges);
}

export function tierLabel(tier) {
  return BADGE_TIER_NAMES[tier] || BADGE_TIER_NAMES.tin;
}

export function renderBadgeHelp(container) {
  container.innerHTML = '';
  const intro = document.createElement('div');
  intro.innerHTML = `
    <h3 class="help-section-title">Как играть с бляхой</h3>
    <p class="help-text">В режиме «Игра с бляхой» каждый игрок до начала партии выбирает одну бляху. Бляху соперника видно на панели над столом — нажмите на неё, чтобы прочитать, что она делает.</p>
    <p class="help-text"><strong>Активные</strong> бляхи тратят заряд: примените их кнопкой «Применить» или клавишей <strong>B</strong> в свой ход. <strong>Пассивные</strong> действуют всю партию без участия игрока. Шулерские кости в этом режиме тоже разрешены — как в «Карманных костях».</p>
    <p class="help-text"><strong>Уровень</strong> — жестяные, серебряные или золотые — выбирается в лобби, он общий для обоих игроков. Чем выше уровень, тем больше у бляхи зарядов или сильнее эффект. <strong>Особые</strong> бляхи в KCD2 бывают только одной редкости, поэтому у них одна сила на любом уровне.</p>`;
  container.appendChild(intro);

  const groups = [
    ['Активные бляхи', (b) => b.kind === 'active' && !b.special],
    ['Пассивные бляхи', (b) => b.kind === 'passive' && !b.special],
    ['Особые бляхи', (b) => b.special],
  ];
  for (const [title, filter] of groups) {
    const h = document.createElement('h3');
    h.className = 'help-section-title';
    h.textContent = title;
    container.appendChild(h);
    for (const badge of BADGES.filter(filter)) {
      const row = document.createElement('div');
      row.className = 'help-badge';
      row.appendChild(medallion(badge.id, ['large'], 'gold'));
      const text = document.createElement('div');
      text.className = 'help-badge-text';
      text.innerHTML = '<div class="help-badge-name"></div><div class="help-badge-kind"></div><div class="help-badge-desc"></div><div class="help-badge-tiers"></div><div class="help-badge-tip"></div>';
      text.querySelector('.help-badge-name').textContent = badge.name;
      text.querySelector('.help-badge-kind').textContent = badge.kind === 'active' ? 'Активная' : 'Пассивная';
      text.querySelector('.help-badge-desc').textContent = badgeText(badge.id, badge.special ? 'tin' : 'gold').replace(/ (Зарядов|Щитов): \d+\.$/, '');
      text.querySelector('.help-badge-tiers').textContent = badge.special
        ? `Любой уровень: ${tierShort(badge, 'tin')}`
        : BADGE_TIERS.map((t) => `${tierLabel(t)}: ${tierShort(badge, t)}`).join(' · ');
      text.querySelector('.help-badge-tip').textContent = BADGE_TIPS[badge.id] || '';
      row.appendChild(text);
      container.appendChild(row);
    }
  }
}

export function badgeKindLabel(badge, tier) {
  const rarity = badge.special ? 'особая' : tierLabel(tier).toLowerCase();
  if (badge.kind === 'passive') return `Пассивная · ${rarity}`;
  return `Активная · ${rarity} · ${chargesWord(badgeStats(badge.id, tier).charges)}`;
}

export function medallion(badgeId, extra = [], tier = 'tin') {
  const el = document.createElement('span');
  el.className = ['badge-medallion', ...extra].join(' ');
  el.dataset.badge = badgeId || '';
  el.dataset.tier = SPECIAL_LOOK[badgeId] || tier || 'tin';
  el.innerHTML = BADGE_ICONS[badgeId] || '?';
  return el;
}

function charges(badge, tier, left) {
  const wrap = document.createElement('span');
  wrap.className = 'badge-charges';
  if (badge.kind !== 'active') {
    wrap.textContent = 'пассивная';
    return wrap;
  }
  const total = badgeStats(badge.id, tier).charges;
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    dot.className = 'charge' + (i < left ? ' full' : '');
    wrap.appendChild(dot);
  }
  return wrap;
}

// --- Lobby ---------------------------------------------------------------

export function renderBadgeLobby(store, mode, tier) {
  const box = document.getElementById('badge-select');
  if (!box) return;
  box.hidden = mode !== 'badge';
  if (box.hidden) return;
  const badge = BADGES_MAP[store.myBadge] || BADGES_MAP[DEFAULT_BADGE];
  const slot = document.getElementById('badge-slot');
  slot.innerHTML = '';
  slot.appendChild(medallion(badge.id, ['large'], tier));
  const info = document.createElement('span');
  info.className = 'badge-slot-info';
  info.innerHTML = `<span class="badge-slot-name"></span><span class="badge-slot-kind"></span><span class="badge-slot-desc"></span>`;
  info.querySelector('.badge-slot-name').textContent = badge.name;
  info.querySelector('.badge-slot-kind').textContent = badgeKindLabel(badge, tier);
  info.querySelector('.badge-slot-desc').textContent = badgeText(badge.id, tier);
  slot.appendChild(info);
}

export function openBadgePicker(store, tier) {
  const modal = document.getElementById('badge-picker-modal');
  const list = document.getElementById('badge-catalog');
  const title = modal.querySelector('h2');
  if (title) title.textContent = `Выбрать бляху · ${tierLabel(tier).toLowerCase()}`;
  list.innerHTML = '';
  const groups = [
    ['Активные — по кнопке «Применить» (B)', (b) => b.kind === 'active' && !b.special],
    ['Пассивные — работают сами', (b) => b.kind === 'passive' && !b.special],
    ['Особые — одна сила на любом уровне', (b) => b.special],
  ];
  for (const [heading, filter] of groups) {
    const h = document.createElement('div');
    h.className = 'catalog-group';
    h.textContent = heading;
    list.appendChild(h);
    for (const badge of BADGES.filter(filter)) {
      const card = document.createElement('div');
      card.className = 'badge-card' + (badge.id === store.myBadge ? ' active' : '');
      card.dataset.badge = badge.id;
      card.appendChild(medallion(badge.id, ['large'], tier));
      const info = document.createElement('div');
      info.className = 'card-info';
      info.innerHTML = '<div class="card-name"></div><div class="badge-card-kind"></div><div class="card-desc"></div>';
      info.querySelector('.card-name').textContent = badge.name;
      info.querySelector('.badge-card-kind').textContent = badgeKindLabel(badge, tier);
      info.querySelector('.card-desc').textContent = badgeText(badge.id, tier);
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

// What the activate button can do right now: null if nothing, or { needsDie, needsDice, maxDice, rescue }.
export function activationState(state, store) {
  const me = state.players.find((p) => p.id === store.myPlayerId);
  const badge = BADGES_MAP[me && me.badge];
  if (!badge || badge.kind !== 'active' || state.phase !== 'playing' || store.rolling) return null;
  const ctx = { charges: me.badgeCharges, turn: state.turn, isMyTurn: store.isMyTurn(), diceIndex: 0, tier: me.badgeTier };
  if (activationBlocker(badge.id, ctx)) return null;
  return {
    needsDie: badge.target === 'die',
    needsDice: badge.target === 'dice',
    maxDice: badgeStats(badge.id, me.badgeTier).rerollMax,
    rescue: badge.target === 'farkle',
  };
}

function pulsing(store, player) {
  return !!store.badgePulse && store.badgePulse.playerId === player.id && store.badgePulse.until > Date.now();
}

// What an armed badge will do this turn, shown on the chip: ×2, +1 die, bank bonus.
function armedFlag(state, player) {
  const turn = state.turn;
  if (!turn || state.currentPlayerId !== player.id) return null;
  if (player.badge === 'doubling' && turn.doubleArmed) return { short: '×2', long: '×2 на следующие кости' };
  if (turn.extraDice > 0 && (player.badge === 'might' || player.badge === 'bird_king')) return { short: '+1', long: '+1 кость в этом ходу' };
  if (player.badge === 'warlord' && turn.bankMultiplier > 1) {
    const pct = Math.round((turn.bankMultiplier - 1) * 100);
    return { short: `+${pct}%`, long: `+${pct}% к банку хода` };
  }
  return null;
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
  el.appendChild(medallion(badge.id, used ? ['spent'] : [], player.badgeTier));
  if (badge.kind === 'active') el.appendChild(charges(badge, player.badgeTier, player.badgeCharges));
  const flag = armedFlag(state, player);
  if (flag) {
    const f = document.createElement('span');
    f.className = 'score-badge-flag';
    f.textContent = flag.short;
    el.appendChild(f);
  }
  el.addEventListener('click', () => toggleInfoCard(el, badgeInfo(badge, player, mine), `score-badge:${player.id}`));
  return el;
}

// Text of the activate button while the player is choosing dice for the badge.
function targetingLabel(store) {
  if (store.badgePicks && store.badgePicks.size > 0) return `Перебросить (${store.badgePicks.size})`;
  return 'Отмена';
}

// Phone layout: the badge action lives with the other action buttons.
export function renderBadgeAction(state, store) {
  const btn = document.querySelector('#actions-panel [data-action="badge"]');
  if (!btn) return;
  const me = state.players.find((p) => p.id === store.myPlayerId);
  const badge = BADGES_MAP[me && me.badge];
  btn.hidden = !badge || badge.kind !== 'active' || state.phase !== 'playing';
  if (btn.hidden) return;
  const act = activationState(state, store);
  btn.disabled = !act && !store.badgeTargeting;
  btn.classList.toggle('urgent', !!(act && act.rescue));
  const label = btn.querySelector('.label');
  label.innerHTML = '';
  label.appendChild(medallion(badge.id, [], me.badgeTier));
  const text = document.createElement('span');
  if (store.badgeTargeting) {
    const picks = targetingLabel(store);
    text.textContent = picks === 'Отмена' ? 'Отмена — не тратить бляху' : picks;
  } else if (act && act.rescue) text.textContent = 'Воскресить!';
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
  el.appendChild(medallion(badge.id, used ? ['spent'] : [], player.badgeTier));
  const text = document.createElement('span');
  text.className = 'badge-chip-text';
  const owner = document.createElement('span');
  owner.className = 'badge-chip-owner';
  owner.textContent = mine ? 'Ваша бляха' : player.name;
  const name = document.createElement('span');
  name.className = 'badge-chip-name';
  name.textContent = badge.name;
  text.append(owner, name, charges(badge, player.badgeTier, player.badgeCharges));
  if (player.shield > 0) {
    const s = document.createElement('span');
    s.className = 'badge-chip-flag';
    s.textContent = player.shield > 1 ? `щитов: ${player.shield}` : 'щит готов';
    text.appendChild(s);
  }
  const flag = armedFlag(state, player);
  if (flag) {
    const s = document.createElement('span');
    s.className = 'badge-chip-flag hot';
    s.textContent = flag.long;
    text.appendChild(s);
  }
  el.appendChild(text);

  if (mine && badge.kind === 'active') {
    const act = activationState(state, store);
    const btn = document.createElement('button');
    btn.className = 'badge-activate';
    btn.dataset.action = 'badge';
    btn.disabled = !act && !store.badgeTargeting;
    if (store.badgeTargeting) {
      btn.textContent = targetingLabel(store);
      btn.classList.add('targeting');
    } else {
      btn.innerHTML = `${act && act.rescue ? 'Воскресить!' : 'Применить'} <span class="hotkey">B</span>`;
      if (act && act.rescue) btn.classList.add('urgent');
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
  head.appendChild(medallion(badge.id, ['large'], player.badgeTier));
  const titles = document.createElement('div');
  titles.innerHTML = '<div class="info-owner"></div><div class="info-name"></div><div class="info-kind"></div>';
  titles.querySelector('.info-owner').textContent = mine ? 'Ваша бляха' : `Бляха игрока ${player.name}`;
  titles.querySelector('.info-name').textContent = badge.name;
  titles.querySelector('.info-kind').textContent = badge.kind === 'active'
    ? `Активная · осталось зарядов: ${player.badgeCharges} из ${badgeStats(badge.id, player.badgeTier).charges}`
    : badgeKindLabel(badge, player.badgeTier);
  head.appendChild(titles);
  box.appendChild(head);
  const desc = document.createElement('p');
  desc.className = 'info-desc';
  desc.textContent = badgeText(badge.id, player.badgeTier);
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
  if (me && me.badge) bar.appendChild(chip(state, store, me, true));
  if (opp && opp.badge) bar.appendChild(chip(state, store, opp, false));
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
    row.appendChild(medallion(badge.id, [], p.badgeTier));
    const text = document.createElement('span');
    const used = (p.badgeLog || []).filter((e) => e.type === 'badge_activated').length;
    const blocked = (p.badgeLog || []).filter((e) => e.type === 'badge_blocked').length;
    let summary = badge.kind === 'passive' ? 'работала всю партию' : `применена ${used} из ${badgeStats(badge.id, p.badgeTier).charges}`;
    if (blocked) summary += `, сгорело зарядов: ${blocked}`;
    const rarity = badge.special ? '' : ` (${tierLabel(p.badgeTier).toLowerCase()})`;
    text.textContent = `${p.fullName || p.name} — ${badge.name}${rarity}: ${summary}`;
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
      if (badge.target === 'dice') return `${who}: ${badge.name} — переброс [${h.from.join(', ')}] → [${h.to.join(', ')}]`;
      if (badge.target === 'turnStart') return `${who}: ${badge.name} — седьмая кость в этом ходу`;
      if (badge.id === 'warlord') return `${who}: ${badge.name} — банк хода +${Math.round((h.multiplier - 1) * 100)}%`;
      if (badge.id === 'resurrection') return `${who}: ${badge.name} — зонк отменён, бросок [${h.dice.join(', ')}]`;
      return `${who}: ${badge.name} — следующие кости дадут ×2`;
    default:
      return null;
  }
}
