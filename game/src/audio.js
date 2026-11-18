// audio.js — tiny WebAudio bleeps + radio ticker (no assets, fully offline). Freshly authored.
import { G } from './state.js';
export const STATIONS = ['SOL FM 88.1 — Sunset Hits', 'NEON 104.5 — Synthwave', 'MARINA 91.7 — Salsa & Soul', 'TIDE 99.9 — Talk & Traffic'];
let ctx = null;
export function ensureAudio() {
  if (ctx || typeof window === 'undefined') return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
}
export function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.05) {
  if (!ctx || G.muted) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* audio is cosmetic */ }
}
export const sfx = {
  shoot: () => beep(180, 0.07, 'square', 0.06),
  punch: () => beep(90, 0.08, 'sawtooth', 0.07),
  pickup: () => { beep(660, 0.06); setTimeout(() => beep(880, 0.09), 60); },
  cash: () => { beep(880, 0.06); setTimeout(() => beep(1320, 0.12), 70); },
  siren: () => beep(720, 0.15, 'sine', 0.02),
  error: () => beep(140, 0.15, 'sawtooth', 0.06),
  mission: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.12), i * 90)); },
};
export function radioTicker() {
  if (!G.radioOn) return 'RADIO OFF — press M';
  const songs = ['“Golden Hour” — The Palms', '“Neon Tide” — Velvet Static', '“Causeway Run” — DJ Marisol', '“Anchor Down” — Los Pelicanos'];
  return STATIONS[G.radio % STATIONS.length] + ' ♪ ' + songs[(G.radio + Math.floor(G.time / 600)) % songs.length];
}
