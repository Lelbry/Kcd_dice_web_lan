// Музыкальный плеер для партии. Фоновые треки случайным порядком, по окончании
// одного — следующий из перетасованной очереди. Lacrimosa — «рофл-композиция»,
// заглушает фон в момент, когда оппонент близок к победе.

const BG_TRACKS = [
  '04. Fistcuffs.mp3',
  '06. Semine Theme.mp3',
  '07. Nuptials.mp3',
  '12. Gallop!.mp3',
  '19. Giardini Estivi.mp3',
  '22. The Hole In The Wall.mp3',
  '28. Burgher, Commoner And Lord.mp3',
  '29. Bustling Streets.mp3',
];
const LACRIMOSA_TRACK = '36. Lacrimosa.mp3';
const MUSIC_BASE = '/music/';

function trackUrl(filename) {
  return MUSIC_BASE + encodeURIComponent(filename);
}

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class MusicPlayer {
  constructor({ initialVolume = 0.5, initialMuted = false } = {}) {
    this.bgAudio = new Audio();
    this.lacrAudio = new Audio();
    this.bgAudio.preload = 'auto';
    this.lacrAudio.preload = 'auto';

    this.bgAudio.addEventListener('ended', () => this._onBgEnded());
    this.lacrAudio.addEventListener('ended', () => this._onLacrimosaEnded());

    this.queue = [];
    this.volume = clamp01(initialVolume);
    this.muted = !!initialMuted;
    this.lacrimosaPlaying = false;
    this.lacrimosaUsed = false;
    this.playing = false;
    this._applyVolume();
  }

  /** Начать партию: перетасовать очередь и запустить первый фон-трек. */
  startGame() {
    this.stopGame();
    this.lacrimosaUsed = false;
    this.lacrimosaPlaying = false;
    this.queue = shuffled(BG_TRACKS);
    this.playing = true;
    this._playNextBg();
  }

  /** Остановить всю музыку (конец партии или возврат в лобби). */
  stopGame() {
    this.playing = false;
    this.lacrimosaPlaying = false;
    try { this.bgAudio.pause(); } catch {}
    try { this.lacrAudio.pause(); } catch {}
    try { this.bgAudio.currentTime = 0; } catch {}
    try { this.lacrAudio.currentTime = 0; } catch {}
  }

  /** Триггер Lacrimosa — один раз за партию. Заглушает фоновый трек. */
  triggerLacrimosa() {
    if (this.lacrimosaUsed) return;
    if (!this.playing) return;
    this.lacrimosaUsed = true;
    this.lacrimosaPlaying = true;
    try { this.bgAudio.pause(); } catch {}
    this.lacrAudio.src = trackUrl(LACRIMOSA_TRACK);
    this.lacrAudio.play().catch(() => {
      // Если воспроизведение заблокировано (autoplay policy) — игнорируем,
      // следующая попытка может пройти после клика.
    });
  }

  /** Громкость 0..1 — применяется к обоим аудиоэлементам. */
  setVolume(v) {
    this.volume = clamp01(v);
    this._applyVolume();
  }

  setMuted(m) {
    this.muted = !!m;
    this._applyVolume();
  }

  getVolume() { return this.volume; }
  isMuted() { return this.muted; }

  _applyVolume() {
    const v = this.muted ? 0 : this.volume;
    this.bgAudio.volume = v;
    this.lacrAudio.volume = v;
  }

  _playNextBg() {
    if (!this.playing) return;
    if (this.lacrimosaPlaying) return;
    if (this.queue.length === 0) this.queue = shuffled(BG_TRACKS);
    const next = this.queue.shift();
    this.bgAudio.src = trackUrl(next);
    this.bgAudio.play().catch(() => {
      // autoplay блок — пропускаем; следующий ended-event или ручной trigger восстановит
    });
  }

  _onBgEnded() {
    if (this.playing && !this.lacrimosaPlaying) {
      this._playNextBg();
    }
  }

  _onLacrimosaEnded() {
    this.lacrimosaPlaying = false;
    if (this.playing) {
      this._playNextBg();
    }
  }
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
