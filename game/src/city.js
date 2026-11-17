// city.js — Solmarina, an original sun-soaked coastal city, generated the
// same way on every load. A road grid divides the map into blocks; each
// block holds stucco buildings and palms, downtown holds taller towers.
// The south edge is beach and sea, the east holds the harbour with a
// helipad, and one block is kept clear as Palmera Park. The queries at
// the bottom answer "is this on a road / inside a building?" for driving,
// traffic and spawns.

import { clamp, mulberry32, pick } from './utils.js';

export const WORLD_W = 5200;
export const WORLD_H = 4200;
export const ROAD_W = 96; // asphalt width in world units
export const BLOCK = 420; // centre-to-centre distance between roads
export const BEACH_Y = 3720; // sand begins here; the sea lies further south

// Facade colours, grouped as (roof, wall, trim) triples.
const FACADES = [
  ['#e8b48a', '#d99a68', '#f0c9a0'], // warm stucco
  ['#c9d6e2', '#aebfd0', '#dce8f2'], // pale blue glass
  ['#e6d3a8', '#d3ba7e', '#f2e3bd'], // sandstone
  ['#d9a0a0', '#c07f7f', '#e8b8b8'], // terracotta
  ['#a8c8a0', '#8ab07e', '#c2d8b8'], // green tile
];

// Named places the HUD, the shops and the missions point at (all invented).
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
  helipad: { x: 4620, y: 2280, name: 'Harbour Helipad' },
  market: { x: 1700, y: 1100, name: 'Coastal Market' },
};

// The park block, kept free of buildings by the generator and drawn
// specially by the renderer.
const PARK = { x0: 700, y0: 1300, x1: 1120, y1: 1720 };

function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let x = 300; x <= WORLD_W - 300; x += BLOCK) vertical.push(x);
  for (let y = 300; y <= BEACH_Y - 60; y += BLOCK) horizontal.push(y);
  return { vertical, horizontal };
}

function insideDowntown(cx, cy) {
  return cx > 2400 && cx < 3900 && cy > 500 && cy < 1700;
}

function buildBlocks(rng, roadsV, roadsH) {
  const buildings = [];
  const trees = [];
  const parkingSpots = [];
  for (let col = 0; col < roadsV.length - 1; col++) {
    for (let row = 0; row < roadsH.length - 1; row++) {
      const innerX0 = roadsV[col] + ROAD_W / 2 + 26;
      const innerY0 = roadsH[row] + ROAD_W / 2 + 26;
      const innerX1 = roadsV[col + 1] - ROAD_W / 2 - 26;
      const innerY1 = roadsH[row + 1] - ROAD_W / 2 - 26;
      const centreX = (innerX0 + innerX1) / 2;
      const centreY = (innerY0 + innerY1) / 2;
      const downtown = insideDowntown(centreX, centreY);
      const facade = pick(rng, FACADES);
      const tower = downtown && rng() < 0.55;
      buildings.push({
        x: innerX0 + rng() * 30,
        y: innerY0 + rng() * 30,
        w: (innerX1 - innerX0) * (0.55 + rng() * 0.3),
        h: (innerY1 - innerY0) * (0.55 + rng() * 0.3),
        roof: facade[0],
        wall: facade[1],
        trim: facade[2],
        height: tower ? 46 + rng() * 34 : 14 + rng() * 18,
        downtown,
        kind: downtown ? 'tower' : pick(rng, ['house', 'shop', 'house', 'apartments']),
      });
      for (let t = 0; t < 3; t++) {
        trees.push({
          x: innerX0 + rng() * (innerX1 - innerX0),
          y: innerY0 + rng() * (innerY1 - innerY0),
          s: 0.8 + rng() * 0.5,
        });
      }
      if (rng() < 0.8) {
        parkingSpots.push({
          x: roadsV[col] + ROAD_W / 2 - 14,
          y: centreY + (rng() - 0.5) * 160,
          angle: Math.PI / 2,
          along: 'v',
        });
      }
    }
  }
  return { buildings, trees, parkingSpots };
}

function clearPark(buildings, trees, rng) {
  const kept = buildings.filter((b) => !(
    b.x > PARK.x0 - 40 && b.x < PARK.x1 && b.y > PARK.y0 - 40 && b.y < PARK.y1
  ));
  for (let t = 0; t < 26; t++) {
    trees.push({
      x: PARK.x0 + 30 + rng() * 360,
      y: PARK.y0 + 30 + rng() * 360,
      s: 1 + rng() * 0.6,
    });
  }
  return kept;
}

function scatterProps(rng, roadsV, roadsH) {
  const props = [];
  // Beach umbrellas and chairs along the sand.
  for (let x = 300; x < WORLD_W - 300; x += 260) {
    props.push({ kind: 'umbrella', x: x + rng() * 120, y: BEACH_Y + 90 + rng() * 160 });
    if (rng() < 0.5) props.push({ kind: 'chair', x: x + rng() * 120, y: BEACH_Y + 130 + rng() * 140 });
  }
  // Crates around the harbour docks.
  for (let i = 0; i < 22; i++) {
    props.push({
      kind: 'crate',
      x: 4400 + rng() * 560,
      y: 2300 + rng() * 600,
      s: 0.8 + rng() * 0.7,
    });
  }
  // Boats moored off the pier and the harbour.
  for (let i = 0; i < 5; i++) {
    props.push({ kind: 'boat', x: 2200 + i * 260 + rng() * 80, y: 4080 + rng() * 30, angle: (rng() - 0.5) * 0.5 });
  }
  for (let i = 0; i < 3; i++) {
    props.push({ kind: 'boat', x: 4960 + rng() * 60, y: 2400 + i * 220, angle: Math.PI / 2 + (rng() - 0.5) * 0.4 });
  }
  for (const rx of roadsV) {
    for (const ry of roadsH) {
      props.push({ kind: 'lamp', x: rx + ROAD_W / 2 + 8, y: ry - ROAD_W / 2 - 8 });
      if (rng() < 0.3) props.push({ kind: 'hydrant', x: rx - ROAD_W / 2 - 10, y: ry + ROAD_W / 2 + 10 });
    }
  }
  return props;
}

function buildCity(seed) {
  const rng = mulberry32(seed);
  const { vertical: roadsV, horizontal: roadsH } = roadLines();
  const { buildings, trees, parkingSpots } = buildBlocks(rng, roadsV, roadsH);
  const openBuildings = clearPark(buildings, trees, rng);
  const props = scatterProps(rng, roadsV, roadsH);
  return { roadsV, roadsH, buildings: openBuildings, trees, props, parkingSpots, seed };
}

export const CITY = buildCity(20261117);

// --- Queries used by movement, traffic and spawning -----------------------

export function isOnRoad(x, y) {
  if (y > BEACH_Y - 40) return false;
  if (CITY.roadsV.some((rx) => Math.abs(x - rx) < ROAD_W / 2)) return true;
  return CITY.roadsH.some((ry) => Math.abs(y - ry) < ROAD_W / 2);
}

// The closest point on the road grid, snapped to a centre line. The axis
// the point is already closest to wins, so cars settle onto their own road.
export function nearestRoadPoint(x, y) {
  const nearestV = CITY.roadsV.reduce((best, rx) => (Math.abs(x - rx) < Math.abs(x - best) ? rx : best), CITY.roadsV[0]);
  const nearestH = CITY.roadsH.reduce((best, ry) => (Math.abs(y - ry) < Math.abs(y - best) ? ry : best), CITY.roadsH[0]);
  if (Math.abs(x - nearestV) < Math.abs(y - nearestH)) {
    return { x: nearestV, y: clamp(y, 200, BEACH_Y - 120), vertical: true };
  }
  return { x: clamp(x, 200, WORLD_W - 200), y: nearestH, vertical: false };
}

export function buildingAt(x, y) {
  return CITY.buildings.find((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) || null;
}

// True when a circle of radius r at (x, y) touches any building.
export function hitsBuilding(x, y, r) {
  return CITY.buildings.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h);
}

// A point on a road at least minDist away from a given spot (for spawns).
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
