// palette.js — Solmarina's 16-colour pixel palette + tiny math helpers.
// Every colour in the game comes from PAL so the picture stays chunky and coherent.
export const PAL = {
  sea: '#1d6fb8',
  seaDeep: '#155a94',
  sand: '#e8cf8f',
  grass: '#4da34a',
  grassDark: '#3d8a3c',
  road: '#3a3a44',
  roadLine: '#e8e8d0',
  pave: '#8a8a96',
  roofA: '#c94f4f',
  roofB: '#4f7ec9',
  roofC: '#c9a24f',
  wall: '#d8d0c0',
  ink: '#14141c',
  paper: '#f4ecd8',
  cash: '#58d858',
  blood: '#c92828',
  cop: '#2f5fd0',
  heli: '#d8d832',
};

export const COLOURS = [
  PAL.ink, PAL.paper, PAL.sea, PAL.seaDeep, PAL.sand, PAL.grass,
  PAL.grassDark, PAL.road, PAL.roadLine, PAL.pave, PAL.roofA, PAL.roofB,
  PAL.roofC, PAL.wall, PAL.cash, PAL.blood,
];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const angDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Deterministic RNG (mulberry32) so ?seed=1 always builds the same city.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
