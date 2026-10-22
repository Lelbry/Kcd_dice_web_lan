import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeAudio {
  constructor() { this.volume = 1; this.muted = false; this.paused = true; this.src = ''; }
  addEventListener() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
globalThis.Audio = FakeAudio;
globalThis.document = { addEventListener() {}, removeEventListener() {} };
const { MusicPlayer } = await import('../public/js/music.js');

test('volume 0 mutes the audio elements (iOS ignores .volume)', () => {
  const m = new MusicPlayer({ initialVolume: 0.5 });
  m.setVolume(0);
  assert.equal(m.bgAudio.muted, true);
  assert.equal(m.lacrAudio.muted, true);
  m.setVolume(0.3);
  assert.equal(m.bgAudio.muted, false);
  assert.equal(m.bgAudio.volume, 0.3);
  m.setMuted(true);
  assert.equal(m.bgAudio.muted, true);
  assert.equal(m.lacrAudio.muted, true);
  m.setMuted(false);
  assert.equal(m.lacrAudio.muted, false);
});

test('starting at volume 0 is already muted', () => {
  const m = new MusicPlayer({ initialVolume: 0 });
  assert.equal(m.bgAudio.muted, true);
});
