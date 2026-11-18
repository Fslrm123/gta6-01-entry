// city.js — Solmarina: districts, roads, buildings, landmarks, collision. Freshly authored.
import { WORLD_W, WORLD_H } from './state.js';
import { clamp, mulberry32 } from './utils.js';

export const DISTRICTS = [
  { name: 'Coral Strand', x: 260, y: 0, w: 560, h: 640, color: '#f2c98a', tag: 'BEACH' },
  { name: 'Neon Mile', x: 820, y: 0, w: 640, h: 640, color: '#ff2e88', tag: 'NIGHTLIFE' },
  { name: 'Miramar Strip', x: 1460, y: 0, w: 1100, h: 640, color: '#7b2fbe', tag: 'HOTELS' },
  { name: 'Pelican Marina', x: 260, y: 640, w: 560, h: 640, color: '#0e7c86', tag: 'DOCKS' },
  { name: 'Casino Row', x: 820, y: 640, w: 640, h: 640, color: '#ffc300', tag: 'CASINO' },
  { name: 'Downtown', x: 1460, y: 640, w: 1100, h: 640, color: '#8a8fa3', tag: 'CITY' },
  { name: 'Beachfront', x: 260, y: 1280, w: 560, h: 640, color: '#ff7e5f', tag: 'PIER' },
  { name: 'East Harbour', x: 820, y: 1280, w: 640, h: 640, color: '#095a63', tag: 'PORT' },
  { name: 'Solmarina Hills', x: 1460, y: 1280, w: 1100, h: 640, color: '#3fae5a', tag: 'HOMES' },
];

export const ROADS_X = [320, 640, 960, 1280, 1600, 1920, 2240];
export const ROADS_Y = [320, 640, 960, 1280, 1600];

export const LANDMARKS = {
  safehouse: { x: 420, y: 1420, name: 'SAFEHOUSE', label: 'Safehouse' },
  gunshop: { x: 1010, y: 700, name: 'IRONWORKS GUN SHOP', label: 'Gun Shop' },
  market: { x: 1330, y: 1020, name: 'COASTAL MARKET', label: 'Market' },
  respray: { x: 1700, y: 1350, name: 'SUNSET SPRAY SHOP', label: 'Respray' },
  garage: { x: 2050, y: 1450, name: "ROSA'S GARAGE", label: 'Garage' },
  helipad: { x: 980, y: 1420, name: 'HARBOUR HELIPAD', label: 'Heli' },
  hospital: { x: 2100, y: 800, name: 'SOLMARINA GENERAL', label: 'Hospital' },
  casino: { x: 1130, y: 820, name: 'CASINO LUMEN', label: 'Casino' },
  pier: { x: 300, y: 1560, name: 'SOLMARINA PIER', label: 'Pier' },
  ferris: { x: 560, y: 240, name: 'FERRIS WHEEL', label: 'Ferris' },
  marina: { x: 480, y: 900, name: 'PELICAN MARINA', label: 'Marina' },
  diner: { x: 1500, y: 1180, name: "MAMA ROSA'S DINER", label: 'Diner' },
};

// Buildings generated once (deterministic): blocks between roads, skipping landmark plots.
export const BUILDINGS = [];
{
  const rng = mulberry32(20261118);
  const plots = [];
  for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 5; gy++) {
    const bx = 320 + gx * 320, by = 320 + gy * 320;
    plots.push({ x: bx + 24, y: by + 24, w: 120 + rng() * 90, h: 90 + rng() * 80 });
  }
  // keep clear of landmarks & roads
  for (const p of plots) {
    let clear = true;
    for (const lm of Object.values(LANDMARKS)) {
      if (Math.abs(p.x + p.w / 2 - lm.x) < 150 && Math.abs(p.y + p.h / 2 - lm.y) < 150) { clear = false; break; }
    }
    if (clear) BUILDINGS.push({ ...p, c: ['#5a4a7a', '#7a5a3a', '#3a5a7a', '#6a3a5a', '#4a6a4a'][Math.floor(rng() * 5)], h: 10 + rng() * 22 });
  }
  // palms along the beach
  BUILDINGS.palms = [];
  for (let i = 0; i < 26; i++) BUILDINGS.palms.push({ x: 270 + rng() * 60, y: 60 + i * 68 + rng() * 30 });
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return { name: 'Open Sea', color: '#0e7c86', tag: 'SEA' };
}
export function isWater(x, y) {
  if (x < 260) {
    // causeway bridge crosses the water at y 880..960
    if (y >= 880 && y <= 960) return false;
    return true;
  }
  return false;
}
export function isRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < 26) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < 26) return true;
  return false;
}
export function collideBuildings(x, y, r) {
  for (const b of BUILDINGS) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function clampWorld(x, y) {
  return { x: clamp(x, 8, WORLD_W - 8), y: clamp(y, 8, WORLD_H - 8) };
}
