// utils.js — small math and random helpers shared by every Solmarina module.
// No game logic lives here, only pure functions.

// Clamp a number into [min, max].
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Linear interpolation.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle difference, in radians, wrapped to [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn angle `a` toward target `b` by at most `step` radians.
export function turnToward(a, b, step) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

// Euclidean distance between two points.
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

// Deterministic PRNG (mulberry32) so the city layout is identical every run.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with a given rng.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// A 2D point rotated around the origin by `angle` radians.
export function rot(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}
