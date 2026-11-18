// audio.js — procedural chiptune radio. No audio files: every station is a
// little step-sequencer played through WebAudio oscillators. The context is
// created lazily on the first user gesture; every call is guarded so a
// headless browser without audio never throws.
export const STATIONS = ['SOL FM', 'WAVE 98', 'BASSLINE', 'TALK SOL'];

const MELODIES = [
  // SOL FM — sunny major-key loop
  [523, 659, 784, 659, 587, 659, 784, 1047],
  // WAVE 98 — lazy minor drift
  [440, 523, 440, 392, 330, 392, 440, 523],
  // BASSLINE — low pulse
  [110, 110, 131, 110, 98, 110, 147, 131],
  // TALK SOL — sparse blips
  [660, 0, 660, 0, 0, 660, 0, 0],
];

export class Radio {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.muted = false;
    this.step = 0;
    this.nextTime = 0;
    this.gain = null;
    this.timer = null;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.05;
      this.gain.connect(this.ctx.destination);
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 120);
      return true;
    } catch (e) {
      return false;
    }
  }
  tick() {
    if (!this.ctx || this.muted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const mel = MELODIES[this.station % MELODIES.length];
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        const f = mel[this.step % mel.length];
        if (f) this.blip(f, this.nextTime, this.station === 2 ? 'sawtooth' : 'square');
        this.nextTime += this.station === 2 ? 0.16 : 0.22;
        this.step++;
      }
    } catch (e) { /* audio is cosmetic; never break the game */ }
  }
  blip(freq, when, type) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(this.gain);
    o.start(when);
    o.stop(when + 0.18);
  }
  cycle() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
  name() { return STATIONS[this.station]; }
}

// Short UI blip (pickup / click). Safe to call before any gesture.
export function uiBlip(freq = 880) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.04;
    o.type = 'square';
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
    o.onended = () => ctx.close().catch(() => {});
  } catch (e) { /* ignore */ }
}
