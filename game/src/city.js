// city.js — Solmarina, the game's original sun-soaked coastal city.
// Generates the whole map deterministically: a road grid, city blocks full of
// buildings, a beach and boardwalk along the south coast, a park, a harbour
// in the east and a downtown of taller towers. Also answers "is this point on
// a road / inside a building?" for movement, traffic and spawning.

import { clamp, mulberry32, pick } from './utils.js';

export const WORLD_W = 5200;
export const WORLD_H = 4200;
export const ROAD_W = 96; // road width in world units
export const BLOCK = 420; // block pitch (road centre to road centre)
export const BEACH_Y = 3720; // the sand starts here; the sea is below it

const BUILDING_PALETTES = [
  ['#e8b48a', '#d99a68', '#f0c9a0'], // warm stucco
  ['#c9d6e2', '#aebfd0', '#dce8f2'], // pale blue glass
  ['#e6d3a8', '#d3ba7e', '#f2e3bd'], // sandstone
  ['#d9a0a0', '#c07f7f', '#e8b8b8'], // terracotta
  ['#a8c8a0', '#8ab07e', '#c2d8b8'], // green tile
];

// Landmark names shown on the HUD and in mission text (all invented).
export const LANDMARKS = {
  pier: { x: 2600, y: 3980, name: 'Solmarina Pier' },
  park: { x: 900, y: 1500, name: 'Palmera Park' },
  harbour: { x: 4780, y: 2600, name: 'East Harbour' },
  casino: { x: 3100, y: 900, name: 'Casino Lumen' },
  garage: { x: 1500, y: 2900, name: "Rosa's Garage" },
  diner: { x: 2100, y: 1900, name: "Mama Rosa's Diner" },
  safehouse: { x: 700, y: 3300, name: 'Safehouse' },
  spray: { x: 3900, y: 1700, name: 'Sunset Spray Shop' },
  gunshop: { x: 3500, y: 2900, name: 'Ironworks Gun Shop' },
  hospital: { x: 1300, y: 900, name: 'Solmarina General' },
};

function buildCity(seed) {
  const rng = mulberry32(seed);
  const roadsV = []; // vertical road centre x positions
  const roadsH = []; // horizontal road centre y positions
  for (let x = 300; x <= WORLD_W - 300; x += BLOCK) roadsV.push(x);
  for (let y = 300; y <= BEACH_Y - 60; y += BLOCK) roadsH.push(y);

  const buildings = [];
  const trees = [];
  const props = []; // hydrants, benches, lamps, crates
  const parkingSpots = [];

  // One building per block, sometimes two, with a small courtyard gap.
  for (let bx = 0; bx < roadsV.length - 1; bx++) {
    for (let by = 0; by < roadsH.length - 1; by++) {
      const x0 = roadsV[bx] + ROAD_W / 2 + 26;
      const y0 = roadsH[by] + ROAD_W / 2 + 26;
      const x1 = roadsV[bx + 1] - ROAD_W / 2 - 26;
      const y1 = roadsH[by + 1] - ROAD_W / 2 - 26;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const downtown = cx > 2400 && cx < 3900 && cy > 500 && cy < 1700;
      const pal = pick(rng, BUILDING_PALETTES);
      const tall = downtown && rng() < 0.55;
      const h = tall ? 46 + rng() * 34 : 14 + rng() * 18;
      buildings.push({
        x: x0 + rng() * 30, y: y0 + rng() * 30,
        w: (x1 - x0) * (0.55 + rng() * 0.3), h: (y1 - y0) * (0.55 + rng() * 0.3),
        roof: pal[0], wall: pal[1], trim: pal[2], height: h,
        downtown, kind: downtown ? 'tower' : pick(rng, ['house', 'shop', 'house', 'apartments']),
      });
      // A couple of palm trees per block corner.
      for (let t = 0; t < 3; t++) {
        trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), s: 0.8 + rng() * 0.5 });
      }
      // Parked cars along the block edge (spawn points for stealable cars).
      if (rng() < 0.8) {
        parkingSpots.push({
          x: roadsV[bx] + ROAD_W / 2 - 14, y: cy + (rng() - 0.5) * 160,
          angle: Math.PI / 2, along: 'v',
        });
      }
    }
  }

  // Palmera Park: replace the buildings of one block with lawn + pond.
  const parkBlock = { x0: 700, y0: 1300, x1: 1120, y1: 1720 };
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (b.x > parkBlock.x0 - 40 && b.x < parkBlock.x1 && b.y > parkBlock.y0 - 40 && b.y < parkBlock.y1) {
      buildings.splice(i, 1);
    }
  }
  for (let t = 0; t < 26; t++) {
    trees.push({ x: parkBlock.x0 + 30 + rng() * 360, y: parkBlock.y0 + 30 + rng() * 360, s: 1 + rng() * 0.6 });
  }

  // Beach props: umbrellas and deck chairs along the sand.
  for (let x = 300; x < WORLD_W - 300; x += 260) {
    props.push({ kind: 'umbrella', x: x + rng() * 120, y: BEACH_Y + 90 + rng() * 160 });
  }
  // Harbour crates and containers in the east.
  for (let i = 0; i < 22; i++) {
    props.push({ kind: 'crate', x: 4400 + rng() * 560, y: 2300 + rng() * 600, s: 0.8 + rng() * 0.7 });
  }
  // Street lamps along every road, hydrants here and there.
  for (const rx of roadsV) {
    for (const ry of roadsH) {
      props.push({ kind: 'lamp', x: rx + ROAD_W / 2 + 8, y: ry - ROAD_W / 2 - 8 });
      if (rng() < 0.3) props.push({ kind: 'hydrant', x: rx - ROAD_W / 2 - 10, y: ry + ROAD_W / 2 + 10 });
    }
  }

  return { roadsV, roadsH, buildings, trees, props, parkingSpots, seed };
}

export const CITY = buildCity(20261117);

// --- Queries used by movement, traffic and spawning -----------------------

export function isOnRoad(x, y) {
  if (y > BEACH_Y - 40) return false;
  for (const rx of CITY.roadsV) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of CITY.roadsH) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

// Nearest road centre point to (x, y), snapped to the grid.
export function nearestRoadPoint(x, y) {
  let bx = CITY.roadsV[0];
  let bd = Infinity;
  for (const rx of CITY.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; bx = rx; }
  }
  let by = CITY.roadsH[0];
  bd = Infinity;
  for (const ry of CITY.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; by = ry; }
  }
  // Prefer the closer axis so cars snap onto the road they are nearest.
  return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y: clamp(y, 200, BEACH_Y - 120), vertical: true }
    : { x: clamp(x, 200, WORLD_W - 200), y: by, vertical: false };
}

export function buildingAt(x, y) {
  for (const b of CITY.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}

// True when a circle of radius r at (x, y) overlaps a building.
export function hitsBuilding(x, y, r) {
  for (const b of CITY.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// A random point on a road, away from the given point.
export function randomRoadPoint(rng, awayFrom, minDist) {
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng() < 0.5;
    const rx = CITY.roadsV[Math.floor(rng() * CITY.roadsV.length)];
    const ry = CITY.roadsH[Math.floor(rng() * CITY.roadsH.length)];
    const x = vertical ? rx : 300 + rng() * (WORLD_W - 600);
    const y = vertical ? 300 + rng() * (BEACH_Y - 500) : ry;
    if (!awayFrom || Math.hypot(x - awayFrom.x, y - awayFrom.y) > minDist) return { x, y, vertical };
  }
  return { x: CITY.roadsV[3], y: CITY.roadsH[3], vertical: true };
}
