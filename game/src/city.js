// city.js — Solmarina island: roads, blocks, buildings and every fixed place.
// The island is a 2400x1800 world. Roads form a grid; blocks between them hold
// buildings, parks and palms. All positions are fixed constants so missions,
// shops and the minimap always agree.
import { PAL, mulberry32, pick } from './palette.js';

export const WORLD = { w: 2400, h: 1800 };
export const ISLAND = { x: 120, y: 120, w: 2160, h: 1560 };
export const ROADS_V = [300, 700, 1100, 1500, 1900];
export const ROADS_H = [300, 650, 1000, 1350];

export const PLACES = {
  safehouse: { x: 560, y: 420, name: 'Safehouse', label: 'SAFEHOUSE' },
  gunshop: { x: 1180, y: 340, name: "Rico's Guns", label: 'GUN SHOP' },
  market: { x: 1420, y: 700, name: 'Marina Market', label: 'MARKET' },
  respray: { x: 760, y: 1080, name: 'Spray & Go', label: 'RESPRAY' },
  garage: { x: 500, y: 470, name: 'Garage', label: 'GARAGE' },
  helipad: { x: 300, y: 1500, name: 'Heli Pad', label: 'HELI PAD' },
  harbour: { x: 220, y: 650, name: 'Harbour Docks', label: 'HARBOUR' },
  casino: { x: 1300, y: 480, name: 'Golden Anchor Casino', label: 'CASINO' },
  plaza: { x: 1100, y: 650, name: 'Plaza Sol', label: 'PLAZA' },
  beach: { x: 1200, y: 1560, name: 'Sol Beach', label: 'BEACH' },
};

// Five stash spots: walk up and press E to crack one open (+$150 each, once).
export const STASHES = [
  { x: 420, y: 820, taken: false },
  { x: 980, y: 1240, taken: false },
  { x: 1620, y: 420, taken: false },
  { x: 2050, y: 900, taken: false },
  { x: 900, y: 1560, taken: false },
];

// Buildings generated deterministically per block. Each block is the rectangle
// between two neighbouring roads; a building sits inside it with a roof colour.
export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];
  const parks = [];
  for (let vi = 0; vi < ROADS_V.length - 1; vi++) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi++) {
      const bx0 = ROADS_V[vi] + 40;
      const by0 = ROADS_H[hi] + 40;
      const bx1 = ROADS_V[vi + 1] - 40;
      const by1 = ROADS_H[hi + 1] - 40;
      const cx = (bx0 + bx1) / 2;
      const cy = (by0 + by1) / 2;
      // Skip the plaza block and the beach strip so they stay open.
      if (Math.abs(cx - 1100) < 260 && Math.abs(cy - 650) < 200) {
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        continue;
      }
      if (cy > 1450) continue; // beach stays open sand
      const roof = pick(rng, [PAL.roofA, PAL.roofB, PAL.roofC]);
      const w = 90 + rng() * 90;
      const h = 70 + rng() * 70;
      buildings.push({ x: cx - w / 2, y: cy - h / 2, w, h, roof, solid: true });
      // A palm or two on the block corners.
      for (let p = 0; p < 2; p++) {
        palms.push({ x: bx0 + 14 + rng() * (bx1 - bx0 - 28), y: by0 + 14 + rng() * (by1 - by0 - 28) });
      }
    }
  }
  // Harbour warehouses along the west docks.
  buildings.push({ x: 150, y: 500, w: 110, h: 80, roof: PAL.roofB, solid: true });
  buildings.push({ x: 150, y: 800, w: 110, h: 80, roof: PAL.roofA, solid: true });
  buildings.push({ x: 150, y: 1100, w: 110, h: 80, roof: PAL.roofC, solid: true });
  return { buildings, palms, parks };
}

// True when point (x,y) is inside a solid building (with a small margin).
export function hitsBuilding(buildings, x, y, margin = 2) {
  for (const b of buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

// True when (x,y) is on a road (road half-width 26).
export function onRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < 26) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < 26) return true;
  return false;
}

// Nearest road point to (x,y): used to snap traffic onto the grid.
export function snapToRoad(x, y) {
  let best = null;
  let bd = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y }; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry }; }
  }
  return best;
}

// Is the point on dry land (inside the island, not in the sea)?
export function onLand(x, y) {
  return x > ISLAND.x && x < ISLAND.x + ISLAND.w && y > ISLAND.y && y < ISLAND.y + ISLAND.h;
}
