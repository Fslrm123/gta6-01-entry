// utils.js — small helpers + the 16-colour Solmarina palette. Freshly authored.
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const fmtCash = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export const fmtClock = (mins) => { const h = Math.floor(mins / 60) % 24; const m = Math.floor(mins % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };

// 16-colour palette (indexable by name)
export const PAL = {
  sky: '#ff7e5f', dusk: '#feb47b', pink: '#ff5da2', neon: '#ff2e88', purple: '#7b2fbe',
  deep: '#1a0b2e', sea: '#0e7c86', seaDark: '#095a63', sand: '#f2c98a', sandDark: '#d9a05b',
  road: '#2b2b3d', roadLine: '#ffd23f', grass: '#3fae5a', concrete: '#8a8fa3',
  white: '#f5f0ff', black: '#0c0616', red: '#e63946', gold: '#ffc300',
};
export const CAR_COLORS = ['#e63946', '#ffc300', '#0e7c86', '#ff5da2', '#f5f0ff', '#7b2fbe', '#3fae5a', '#ff7e5f'];
export const CAR_NAMES = ['Vesper', 'Comet GT', 'Marlin', 'Solstice', 'Bantam', 'Osprey', 'Dune Buggy', 'Crown Vic'];
