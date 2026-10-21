// A small popover that explains a die or a badge the player cannot otherwise interact with.
let card = null;
let anchorKey = null;

function ensureCard() {
  if (card) return card;
  card = document.createElement('div');
  card.className = 'info-card';
  card.id = 'info-card';
  card.setAttribute('role', 'dialog');
  card.hidden = true;
  document.body.appendChild(card);
  document.addEventListener('click', (e) => {
    if (card.hidden) return;
    if (e.target.closest('.info-card, [data-inspect]')) return;
    hideInfoCard();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') hideInfoCard();
  });
  window.addEventListener('resize', hideInfoCard);
  return card;
}

export function hideInfoCard() {
  if (!card || card.hidden) return;
  card.hidden = true;
  anchorKey = null;
}

// key identifies what was clicked so a second click on the same thing closes the card.
export function toggleInfoCard(anchor, content, key) {
  const el = ensureCard();
  if (!el.hidden && anchorKey === key) {
    hideInfoCard();
    return;
  }
  anchorKey = key;
  el.innerHTML = '';
  el.appendChild(content);
  el.hidden = false;

  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const gap = 10;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  const above = r.top - h - gap;
  const top = above >= 8 ? above : Math.min(r.bottom + gap, window.innerHeight - h - 8);
  el.style.left = `${left}px`;
  el.style.top = `${Math.max(8, top)}px`;
  el.classList.toggle('below', above < 8);
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}
