// game.js — Solmarina's simulation: player, traffic, peds, police, heli,
// combat, economy, shops, missions and saving. Rendering lives in render.js.
import { PAL, clamp, dist, angTo, angDiff, mulberry32, pick } from './palette.js';
import { WORLD, ISLAND, ROADS_V, ROADS_H, PLACES, STASHES, buildCity, hitsBuilding, onRoad, snapToRoad, onLand } from './city.js';
import { MISSIONS } from './missions.js';
import { Radio } from './audio.js';

export const SAVE_KEY = 'solmarina-save-v1';
const CAR_COLOURS = ['#c94f4f', '#4f7ec9', '#d8d832', '#58d858', '#e8e8d0', '#c9a24f'];
const PED_SHIRTS = ['#c94f4f', '#4f7ec9', '#58d858', '#d8d832', '#e8e8d0'];

export function createGame(seed = 1, scene = null) {
  const rng = mulberry32(seed * 7919 + 13);
  const city = buildCity(seed);
  const g = {
    seed, scene, rng, city,
    time: 0, clockMin: 540, // 09:00
    cash: 250, health: 100, armour: 0, wanted: 0,
    weapons: [
      { name: 'Pistol', ammo: 24, owned: true, dmg: 20, rate: 0.28 },
      { name: 'SMG', ammo: 0, owned: false, dmg: 12, rate: 0.09 },
      { name: 'Rifle', ammo: 0, owned: false, dmg: 40, rate: 0.5 },
    ],
    weapon: 0, fireCd: 0,
    player: { x: PLACES.safehouse.x, y: PLACES.safehouse.y, angle: -Math.PI / 2, speed: 0, onFoot: true, vehicle: null, inHeli: false, hurtCd: 0 },
    heli: { x: PLACES.helipad.x, y: PLACES.helipad.y, angle: 0, alt: 0, speed: 0, parked: true },
    policeHeli: { x: 0, y: 0, angle: 0, active: false, sweep: 0 },
    cars: [], peds: [], cops: [], bullets: [], pickups: [], rivals: [],
    missionIndex: 0, missionStep: 0, stepCount: 0, missionPassed: 0, storyDone: false,
    dialogue: [], dialogueT: 0,
    shop: null, // 'gun' | 'market' | 'respray' | null
    paused: false, title: true, wasted: 0,
    stats: { earned: 0, carsStolen: 0, kills: 0, missionsDone: 0, shotsFired: 0, playSeconds: 0 },
    stashes: STASHES.map(s => ({ ...s })),
    ticker: [
      'SOLMARINA SUN: Golden Anchor casino reports record night',
      'PD: heat wave warning — drive safe on the bridge',
      'Harbour docks hire: crates moving all week',
      'SOL FM: Rico requests the sunset drive mix',
      'Marina Market: fresh catch, low prices',
    ],
    tickerX: 480,
    radio: new Radio(),
    crimeT: 0, // seconds since last crime (wanted decay)
    msg: '', msgT: 0,
    cam: { x: PLACES.safehouse.x, y: PLACES.safehouse.y },
  };
  spawnTraffic(g);
  spawnPeds(g);
  if (scene) applyScene(g, scene);
  else startMission(g, 0);
  return g;
}

function spawnTraffic(g) {
  g.cars = [];
  for (let i = 0; i < 10; i++) {
    const vertical = g.rng() < 0.5;
    const road = vertical ? pick(g.rng, ROADS_V) : pick(g.rng, ROADS_H);
    const along = 200 + g.rng() * 1400;
    g.cars.push({
      x: vertical ? road + (g.rng() < 0.5 ? -10 : 10) : along,
      y: vertical ? along : road + (g.rng() < 0.5 ? -10 : 10),
      angle: vertical ? (g.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (g.rng() < 0.5 ? 0 : Math.PI),
      speed: 55 + g.rng() * 35, axis: vertical ? 'v' : 'h', dir: g.rng() < 0.5 ? 1 : -1,
      colour: pick(g.rng, CAR_COLOURS), driver: 'traffic', hp: 100, turnCd: 0,
    });
  }
}

function spawnPeds(g) {
  g.peds = [];
  for (let i = 0; i < 14; i++) {
    const x = 200 + g.rng() * 2000;
    const y = 200 + g.rng() * 1400;
    if (onRoad(x, y)) continue;
    g.peds.push({
      x, y, angle: g.rng() * Math.PI * 2, speed: 18 + g.rng() * 14,
      shirt: pick(g.rng, PED_SHIRTS), skin: pick(g.rng, ['#e8b88a', '#c98a5a', '#f0c8a0', '#8a5a3a']),
      alive: true, hostile: false, hurtCd: 0, wanderT: 0,
    });
  }
}

export function say(g, speaker, text) {
  g.dialogue.push({ speaker, text });
  if (g.dialogue.length > 3) g.dialogue.shift();
  g.dialogueT = 5;
}

export function startMission(g, idx) {
  if (idx >= MISSIONS.length) { g.storyDone = true; return; }
  const m = MISSIONS[idx];
  g.missionIndex = idx;
  g.missionStep = 0;
  g.stepCount = 0;
  g.pickups = [];
  g.rivals = [];
  for (const line of m.brief) {
    const [sp, ...rest] = line.split(': ');
    say(g, sp, rest.join(': '));
  }
  setupStep(g);
}

function setupStep(g) {
  const m = MISSIONS[g.missionIndex];
  if (!m) return;
  const step = m.steps[g.missionStep];
  if (!step) return;
  g.stepCount = 0;
  g.pickups = [];
  g.rivals = [];
  if (step.type === 'collect') {
    for (let i = 0; i < step.count; i++) {
      const a = (i / step.count) * Math.PI * 2;
      g.pickups.push({ x: step.x + Math.cos(a) * 34, y: step.y + Math.sin(a) * 34, kind: 'crate', taken: false });
    }
  }
  if (step.type === 'heli' && g.heli.parked) {
    // The Seahawk must be findable: a parked heli is flown back to the pad
    // when a flying step starts, or the mission could soft-lock.
    g.heli.x = PLACES.helipad.x;
    g.heli.y = PLACES.helipad.y;
    g.heli.alt = 0;
    say(g, 'RICO', 'Seahawk is back on the pad. Let us fly.');
  }
  if (step.type === 'kill') {
    for (let i = 0; i < step.count; i++) {
      const a = (i / Math.max(1, step.count)) * Math.PI * 2 + 0.5;
      g.rivals.push({
        x: g.player.x + Math.cos(a) * 130, y: g.player.y + Math.sin(a) * 130,
        angle: 0, speed: 42, shirt: '#c92828', skin: '#e8b88a',
        alive: true, hostile: true, hurtCd: 0, wanderT: 0,
      });
    }
    say(g, 'ADA', 'Vipers marked in red. Take them down.');
  }
}

function currentStep(g) {
  const m = MISSIONS[g.missionIndex];
  return m ? m.steps[g.missionStep] : null;
}

function advanceStep(g) {
  const m = MISSIONS[g.missionIndex];
  g.missionStep++;
  if (g.missionStep >= m.steps.length) {
    g.cash += m.payout;
    g.stats.earned += m.payout;
    g.stats.missionsDone++;
    g.missionPassed = 2.6;
    say(g, 'ADA', `${m.name} done. +$${m.payout.toLocaleString()}.`);
    g.missionIndex++;
    g.missionStep = 0;
    if (g.missionIndex >= MISSIONS.length) { g.storyDone = true; g.pickups = []; g.rivals = []; return; }
    startMission(g, g.missionIndex);
  } else {
    setupStep(g);
  }
}

export function addWanted(g, n) {
  g.wanted = clamp(g.wanted + n, 0, 5);
  g.crimeT = 0;
}

function damagePlayer(g, dmg) {
  if (g.player.hurtCd > 0 || g.wasted > 0) return;
  g.player.hurtCd = 0.6;
  let left = dmg;
  if (g.armour > 0) { const absorbed = Math.min(g.armour, left); g.armour -= absorbed; left -= absorbed; }
  g.health -= left;
  if (g.health <= 0) {
    g.health = 0;
    g.wasted = 3;
    g.cash = Math.floor(g.cash * 0.9);
    g.wanted = 0;
  }
}

// ---- actions ---------------------------------------------------------------

export function nearestCar(g, x, y, maxD) {
  let best = null; let bd = maxD;
  for (const c of g.cars) {
    if (c.driver === 'player') continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function tryEnterVehicle(g) {
  const p = g.player;
  if (p.inHeli) return false;
  if (p.vehicle) { // exit car
    p.vehicle.driver = 'traffic';
    p.vehicle.speed = 0;
    p.x = p.vehicle.x + 26; p.y = p.vehicle.y;
    p.vehicle = null; p.onFoot = true;
    return true;
  }
  // Heli first if close
  if (dist(p.x, p.y, g.heli.x, g.heli.y) < 34 && g.heli.alt < 10) {
    p.inHeli = true; p.onFoot = false; g.heli.parked = false;
    return true;
  }
  const car = nearestCar(g, p.x, p.y, 40);
  if (car) {
    if (car.driver === 'traffic') { addWanted(g, 1); g.stats.carsStolen++; say(g, 'RICO', 'Nice ride. It is ours now.'); }
    car.driver = 'player';
    p.vehicle = car; p.onFoot = false;
    return true;
  }
  return false;
}

export function exitHeli(g) {
  const p = g.player;
  if (!p.inHeli || g.heli.alt > 12) return false;
  p.inHeli = false; p.onFoot = true;
  p.x = g.heli.x + 24; p.y = g.heli.y;
  g.heli.parked = true;
  return true;
}

export function shoot(g, wx, wy) {
  const p = g.player;
  const w = g.weapons[g.weapon];
  if (!w.owned || w.ammo <= 0 || g.fireCd > 0 || g.title || g.paused || g.wasted > 0) return false;
  g.fireCd = w.rate;
  w.ammo--;
  g.stats.shotsFired++;
  const a = angTo(p.x, p.y, wx, wy);
  const spread = (g.rng() - 0.5) * 0.06;
  g.bullets.push({ x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14, vx: Math.cos(a + spread) * 620, vy: Math.sin(a + spread) * 620, life: 0.7, dmg: w.dmg });
  return true;
}

export const SHOP_ITEMS = {
  gun: [
    { name: 'SMG', price: 800, apply: g => { g.weapons[1].owned = true; g.weapons[1].ammo += 60; } },
    { name: 'Rifle', price: 1500, apply: g => { g.weapons[2].owned = true; g.weapons[2].ammo += 30; } },
    { name: 'Pistol ammo +24', price: 100, apply: g => { g.weapons[0].ammo += 24; } },
    { name: 'SMG ammo +60', price: 150, apply: g => { g.weapons[1].owned = true; g.weapons[1].ammo += 60; } },
  ],
  market: [
    { name: 'Health +50', price: 80, apply: g => { g.health = clamp(g.health + 50, 0, 100); } },
    { name: 'Armour +50', price: 120, apply: g => { g.armour = clamp(g.armour + 50, 0, 100); } },
    { name: 'Snack +10 HP', price: 20, apply: g => { g.health = clamp(g.health + 10, 0, 100); } },
  ],
};

export function shopBuy(g, idx) {
  if (!g.shop || !SHOP_ITEMS[g.shop]) return false;
  const item = SHOP_ITEMS[g.shop][idx];
  if (!item || g.cash < item.price) return false;
  g.cash -= item.price;
  item.apply(g);
  g.msg = `Bought ${item.name} for $${item.price}`;
  g.msgT = 2;
  return true;
}

export function doRespray(g) {
  // Works on foot beside a parked car OR while driving: clears all heat.
  if (g.wanted === 0) { g.msg = 'No heat to clear.'; g.msgT = 2; return false; }
  if (g.cash < 50) { g.msg = 'Respray costs $50.'; g.msgT = 2; return false; }
  g.cash -= 50;
  g.wanted = 0;
  g.cops = [];
  g.policeHeli.active = false;
  g.msg = 'Respray done. Heat cleared.';
  g.msgT = 2.5;
  return true;
}

export function saveGame(g) {
  try {
    const data = {
      cash: g.cash, health: g.health, armour: g.armour,
      x: g.player.x, y: g.player.y, missionIndex: g.missionIndex,
      weapons: g.weapons.map(w => ({ ammo: w.ammo, owned: w.owned })),
      stats: g.stats, stashes: g.stashes.map(s => s.taken),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    g.msg = 'Game saved.'; g.msgT = 2;
    return true;
  } catch (e) { return false; }
}

export function loadGame(g) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    g.cash = d.cash; g.health = d.health; g.armour = d.armour;
    g.player.x = d.x; g.player.y = d.y;
    g.player.vehicle = null; g.player.inHeli = false; g.player.onFoot = true;
    d.weapons.forEach((w, i) => { g.weapons[i].ammo = w.ammo; g.weapons[i].owned = w.owned; });
    g.stats = { ...g.stats, ...d.stats };
    d.stashes.forEach((t, i) => { if (g.stashes[i]) g.stashes[i].taken = t; });
    g.msg = 'Save loaded.'; g.msgT = 2;
    startMission(g, Math.min(d.missionIndex, MISSIONS.length - 1));
    return true;
  } catch (e) { return false; }
}

// ---- scenes (deterministic screenshot setups) -------------------------------
function applyScene(g, scene) {
  g.title = false;
  if (scene === 'title') { g.title = true; return; }
  if (scene === 'map') { g.paused = true; startMission(g, 0); return; }
  if (scene === 'heli') {
    startMission(g, 6); // Air Lift: a flying mission, so the banner fits the chase
    g.player.inHeli = true; g.player.onFoot = false;
    g.heli.x = 1200; g.heli.y = 1620; g.heli.alt = 60; g.heli.parked = false;
    g.player.x = g.heli.x; g.player.y = g.heli.y;
    g.cam.x = g.heli.x; g.cam.y = g.heli.y;
    g.wanted = 4;
    g.policeHeli.active = true;
    g.policeHeli.x = 1050; g.policeHeli.y = 1540;
    g.cash = 5230;
    say(g, 'ADA', 'PD heli on us! Lose them over the beach!');
    return;
  }
  if (scene === 'heist') {
    startMission(g, 1);
    g.player.x = PLACES.harbour.x + 120; g.player.y = PLACES.harbour.y + 40;
    g.cash = 3120; g.wanted = 2;
    say(g, 'ADA', 'Three crates on the docks. Grab them all.');
    return;
  }
}

// ---- update -----------------------------------------------------------------
export function update(g, input, dt) {
  g.time += dt;
  g.stats.playSeconds += dt;
  g.clockMin = (540 + Math.floor(g.time * 2)) % 1440;
  g.tickerX -= dt * 26;
  if (g.tickerX < -520) g.tickerX = 480;
  if (g.dialogueT > 0) g.dialogueT -= dt;
  if (g.msgT > 0) g.msgT -= dt;
  if (g.missionPassed > 0) g.missionPassed -= dt;
  if (g.player.hurtCd > 0) g.player.hurtCd -= dt;
  if (g.fireCd > 0) g.fireCd -= dt;
  if (g.wasted > 0) {
    g.wasted -= dt;
    if (g.wasted <= 0) {
      g.health = 100;
      g.player.x = PLACES.safehouse.x; g.player.y = PLACES.safehouse.y;
      g.player.vehicle = null; g.player.inHeli = false; g.player.onFoot = true;
    }
    return;
  }
  if (g.title || g.paused || g.shop) return;

  // Wanted decay: -1 per 25s without a fresh crime.
  g.crimeT += dt;
  if (g.wanted > 0 && g.crimeT > 25) { g.wanted--; g.crimeT = 0; }

  const p = g.player;
  updatePlayer(g, input, dt);
  updateTraffic(g, dt);
  updatePeds(g, dt);
  updateRivals(g, dt);
  updateCops(g, dt);
  updateBullets(g, dt);
  updatePickups(g);
  updateMission(g);
  updatePoliceHeli(g, dt);
  // Camera follows the player (or the heli).
  const cx = p.inHeli ? g.heli.x : p.x;
  const cy = p.inHeli ? g.heli.y : p.y;
  g.cam.x += (cx - g.cam.x) * Math.min(1, dt * 5);
  g.cam.y += (cy - g.cam.y) * Math.min(1, dt * 5);
}

function moveBlocked(g, x, y) {
  if (!onLand(x, y)) return true;
  return hitsBuilding(g.city.buildings, x, y, 4) !== null;
}

function updatePlayer(g, input, dt) {
  const p = g.player;
  const sprint = input.shift ? 1.5 : 1;
  if (p.inHeli) {
    const h = g.heli;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      h.angle = Math.atan2(my / len, mx / len);
      h.speed = Math.min(240, h.speed + 320 * dt);
    } else {
      h.speed = Math.max(0, h.speed - 200 * dt);
    }
    h.x += Math.cos(h.angle) * h.speed * dt;
    h.y += Math.sin(h.angle) * h.speed * dt;
    h.x = clamp(h.x, ISLAND.x + 20, ISLAND.x + ISLAND.w - 20);
    h.y = clamp(h.y, ISLAND.y + 20, ISLAND.y + ISLAND.h - 20);
    if (input.climb) h.alt = clamp(h.alt + 55 * dt, 0, 120);
    if (input.descend) h.alt = clamp(h.alt - 55 * dt, 0, 120);
    p.x = h.x; p.y = h.y;
    return;
  }
  if (p.vehicle) {
    const c = p.vehicle;
    if (input.up) c.speed = Math.min(260, c.speed + 300 * dt);
    else if (input.down) c.speed = Math.max(-70, c.speed - 300 * dt);
    else c.speed *= Math.max(0, 1 - 1.6 * dt);
    const steer = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * (c.speed >= 0 ? 1 : -1);
    c.angle += steer * 2.4 * dt * clamp(Math.abs(c.speed) / 90, 0.15, 1);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!moveBlocked(g, nx, ny)) { c.x = nx; c.y = ny; }
    else { c.speed *= 0.4; }
    p.x = c.x; p.y = c.y; p.angle = c.angle;
    return;
  }
  // On foot.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my);
    const sp = 92 * sprint;
    const nx = p.x + (mx / len) * sp * dt;
    const ny = p.y + (my / len) * sp * dt;
    if (!moveBlocked(g, nx, p.y)) p.x = nx;
    if (!moveBlocked(g, p.x, ny)) p.y = ny;
    p.angle = Math.atan2(my / len, mx / len);
    p.speed = sp;
  } else {
    p.speed = 0;
  }
  // Stashes: walk over one to crack it open.
  for (const s of g.stashes) {
    if (!s.taken && dist(p.x, p.y, s.x, s.y) < 20) {
      s.taken = true;
      g.cash += 150; g.stats.earned += 150;
      g.msg = 'Stash cracked: +$150'; g.msgT = 2;
    }
  }
}

function updateTraffic(g, dt) {
  for (const c of g.cars) {
    if (c.driver === 'player') continue;
    c.turnCd -= dt;
    const speed = c.speed * c.dir;
    let nx = c.x, ny = c.y;
    if (c.axis === 'v') ny += speed * dt; else nx += speed * dt;
    // At an intersection, sometimes turn onto the cross road.
    const nearCross = c.axis === 'v'
      ? ROADS_H.some(ry => Math.abs(c.y - ry) < 4)
      : ROADS_V.some(rx => Math.abs(c.x - rx) < 4);
    if (nearCross && c.turnCd <= 0 && g.rng() < 0.25) {
      c.axis = c.axis === 'v' ? 'h' : 'v';
      c.dir = g.rng() < 0.5 ? 1 : -1;
      c.angle = c.axis === 'v' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      c.turnCd = 4;
      if (c.axis === 'v') { const s = snapToRoad(c.x, c.y); c.x = s.x; } else { const s = snapToRoad(c.x, c.y); c.y = s.y; }
    } else {
      c.angle = c.axis === 'v' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
    }
    // Keep inside the island; reverse at the edge.
    if (nx < ISLAND.x + 30 || nx > ISLAND.x + ISLAND.w - 30 || ny < ISLAND.y + 30 || ny > ISLAND.y + ISLAND.h - 30) {
      c.dir *= -1;
    } else {
      c.x = nx; c.y = ny;
    }
    // Don't drive through the player's car.
    const p = g.player;
    if (!p.onFoot && p.vehicle !== c && dist(c.x, c.y, p.x, p.y) < 30) {
      c.x -= Math.cos(c.angle) * c.speed * dt;
      c.y -= Math.sin(c.angle) * c.speed * dt;
    }
  }
}

function updatePeds(g, dt) {
  for (const ped of g.peds) {
    if (!ped.alive) continue;
    ped.wanderT -= dt;
    if (ped.wanderT <= 0) {
      ped.angle = g.rng() * Math.PI * 2;
      ped.wanderT = 2 + g.rng() * 3;
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (onLand(nx, ny) && !hitsBuilding(g.city.buildings, nx, ny, 4) && !onRoad(nx, ny)) {
      ped.x = nx; ped.y = ny;
    } else {
      ped.angle += Math.PI / 2;
    }
  }
}

function updateRivals(g, dt) {
  for (const r of g.rivals) {
    if (!r.alive) continue;
    r.hurtCd -= dt;
    const p = g.player;
    const d = dist(r.x, r.y, p.x, p.y);
    r.angle = angTo(r.x, r.y, p.x, p.y);
    if (d > 26) {
      r.x += Math.cos(r.angle) * r.speed * dt;
      r.y += Math.sin(r.angle) * r.speed * dt;
    } else if (r.hurtCd <= 0) {
      r.hurtCd = 0.9;
      damagePlayer(g, 5);
    }
  }
}

function updateCops(g, dt) {
  const want = Math.min(8, g.wanted * 2);
  while (g.cops.length < want) {
    const a = g.rng() * Math.PI * 2;
    const p = g.player;
    const s = snapToRoad(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320) || { x: p.x + 300, y: p.y };
    g.cops.push({ x: clamp(s.x, ISLAND.x + 40, ISLAND.x + ISLAND.w - 40), y: clamp(s.y, ISLAND.y + 40, ISLAND.y + ISLAND.h - 40), angle: 0, speed: 0, ramCd: 0, hp: 60 });
  }
  if (g.wanted === 0) g.cops = g.cops.slice(0, 0);
  for (const cop of g.cops) {
    cop.ramCd -= dt;
    const p = g.player;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const target = angTo(cop.x, cop.y, p.x, p.y);
    cop.angle += clamp(angDiff(cop.angle, target), -2.6 * dt, 2.6 * dt);
    cop.speed = d > 40 ? Math.min(235, cop.speed + 260 * dt) : Math.max(0, cop.speed - 200 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!hitsBuilding(g.city.buildings, nx, ny, 4) && onLand(nx, ny)) { cop.x = nx; cop.y = ny; }
    // Ram: damage with a cooldown so one touch is never a multi-hit death.
    if (d < 30 && cop.ramCd <= 0) {
      cop.ramCd = 1.0;
      damagePlayer(g, 8);
      addWanted(g, 0); // no extra wanted for being rammed
    }
  }
}

function updateBullets(g, dt) {
  const p = g.player;
  for (const b of g.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitsBuilding(g.city.buildings, b.x, b.y, 0)) b.life = 0;
  }
  g.bullets = g.bullets.filter(b => b.life > 0 && onLand(b.x, b.y));
  for (const b of g.bullets) {
    if (b.life <= 0) continue;
    for (const ped of [...g.peds, ...g.rivals]) {
      if (ped.alive && dist(b.x, b.y, ped.x, ped.y) < 13) {
        ped.alive = false;
        b.life = 0;
        g.stats.kills++;
        if (ped.hostile) { g.stepCount++; }
        else addWanted(g, 1);
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const cop of g.cops) {
      if (dist(b.x, b.y, cop.x, cop.y) < 16) {
        cop.hp -= b.dmg;
        b.life = 0;
        if (cop.hp <= 0) {
          g.cops.splice(g.cops.indexOf(cop), 1);
          g.stats.kills++;
          addWanted(g, 1);
        }
        break;
      }
    }
  }
  // Player touch damage from a live rival is handled in updateRivals.
  void p;
}

function updatePickups(g) {
  const p = g.player;
  for (const pk of g.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 24) {
      pk.taken = true;
      g.stepCount++;
    }
  }
}

function updateMission(g) {
  if (g.storyDone || g.missionPassed > 0) return;
  const step = currentStep(g);
  if (!step) return;
  const p = g.player;
  // Hot Pursuit step 1: arriving at the plaza stirs up 2 stars. Check this
  // BEFORE the generic goto branch, or the step would advance heat-free.
  if (g.missionIndex === 5 && g.missionStep === 0 && step.type === 'goto') {
    if (dist(p.x, p.y, step.x, step.y) < step.r) {
      g.wanted = Math.max(g.wanted, 2);
      g.crimeT = 0;
      say(g, 'MARISOL', 'Two stars and climbing. Now vanish!');
      advanceStep(g);
    }
    return;
  }
  if (step.type === 'goto' || step.type === 'escape') {
    if (dist(p.x, p.y, step.x, step.y) < step.r) {
      if (step.type === 'escape' && g.missionIndex === 5 && g.missionStep === 1) {
        // Hot Pursuit: the respray itself must clear the heat first.
        if (g.wanted === 0) advanceStep(g);
      } else {
        advanceStep(g);
      }
    }
  } else if (step.type === 'collect') {
    if (g.stepCount >= step.count) advanceStep(g);
  } else if (step.type === 'kill') {
    if (g.stepCount >= step.count) advanceStep(g);
  } else if (step.type === 'carjack') {
    if (p.vehicle && g.stats.carsStolen > 0) advanceStep(g);
  } else if (step.type === 'heli') {
    if (p.inHeli && dist(p.x, p.y, step.x, step.y) < step.r) advanceStep(g);
  }
}

function updatePoliceHeli(g, dt) {
  const h = g.policeHeli;
  h.active = g.wanted >= 4;
  if (!h.active) return;
  const p = g.player;
  h.sweep += dt;
  const ta = Math.atan2(p.y - h.y, p.x - h.x);
  h.angle += clamp(angDiff(h.angle, ta), -1.8 * dt, 1.8 * dt);
  const d = dist(h.x, h.y, p.x, p.y);
  const wantD = 130;
  if (d > wantD + 20) {
    h.x += Math.cos(h.angle) * 150 * dt;
    h.y += Math.sin(h.angle) * 150 * dt;
  } else if (d < wantD - 20) {
    h.x -= Math.cos(h.angle) * 60 * dt;
    h.y -= Math.sin(h.angle) * 60 * dt;
  }
}
