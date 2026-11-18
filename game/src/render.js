// render.js — everything drawn: the pixel world, HUD, minimap, title screen,
// pause/map screen, dialogue and crew portraits. All drawing happens on the
// 480x270 buffer; main.js upscales it with nearest neighbour.
// Every text block is wrapped in save/restore so textAlign never leaks.
import { PAL, clamp, dist } from './palette.js';
import { WORLD, ISLAND, ROADS_V, ROADS_H, PLACES } from './city.js';
import { MISSIONS, CREW } from './missions.js';

export const VW = 480;
export const VH = 270;

function text(ctx, s, x, y, opts = {}) {
  ctx.save();
  ctx.font = (opts.bold ? 'bold ' : '') + (opts.size || 8) + 'px monospace';
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.base || 'top';
  ctx.fillStyle = opts.colour || PAL.paper;
  if (opts.shadow) { ctx.fillStyle = PAL.ink; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = opts.colour || PAL.paper; }
  ctx.fillText(s, x, y);
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, colour, bg = '#00000088') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, Math.max(0, Math.min(w, w * clamp(frac, 0, 1))), h);
  ctx.strokeStyle = PAL.ink;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

// ---- world -----------------------------------------------------------------
export function renderWorld(ctx, g) {
  const camX = clamp(g.cam.x - VW / 2, 0, WORLD.w - VW);
  const camY = clamp(g.cam.y - VH / 2, 0, WORLD.h - VH);
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(0, 0, VW, VH);
  // Sea waves (deterministic dashes).
  ctx.fillStyle = PAL.seaDeep;
  for (let i = 0; i < 24; i++) {
    const wx = ((i * 173) % WORLD.w) - camX;
    const wy = ((i * 97) % WORLD.h) - camY;
    if (wx > -20 && wx < VW && wy > -10 && wy < VH) ctx.fillRect(wx, wy, 14, 2);
  }
  const ix = ISLAND.x - camX, iy = ISLAND.y - camY;
  // Island base: grass, with a sand beach rim on the south + east edges.
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(ix, iy, ISLAND.w, ISLAND.h);
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(ix, iy + ISLAND.h - 90, ISLAND.w, 90);
  ctx.fillRect(ix + ISLAND.w - 60, iy, 60, ISLAND.h);
  // Parks.
  ctx.fillStyle = PAL.grassDark;
  for (const pk of g.city.parks) ctx.fillRect(pk.x - camX, pk.y - camY, pk.w, pk.h);
  // Roads.
  ctx.fillStyle = PAL.road;
  for (const rx of ROADS_V) ctx.fillRect(rx - 26 - camX, ISLAND.y - camY, 52, ISLAND.h);
  for (const ry of ROADS_H) ctx.fillRect(ISLAND.x - camX, ry - 26 - camY, ISLAND.w, 52);
  // Lane dashes.
  ctx.fillStyle = PAL.roadLine;
  for (const rx of ROADS_V) {
    for (let y = ISLAND.y; y < ISLAND.y + ISLAND.h; y += 36) ctx.fillRect(rx - 1 - camX, y - camY, 2, 16);
  }
  for (const ry of ROADS_H) {
    for (let x = ISLAND.x; x < ISLAND.x + ISLAND.w; x += 36) ctx.fillRect(x - camX, ry - 1 - camY, 16, 2);
  }
  // Harbour docks (west edge planks).
  ctx.fillStyle = '#8a6a3a';
  ctx.fillRect(150 - camX, 480 - camY, 70, 700);
  ctx.fillStyle = '#6a4a2a';
  for (let y = 490; y < 1170; y += 40) ctx.fillRect(150 - camX, y - camY, 70, 3);
  // Heli pad.
  ctx.fillStyle = PAL.pave;
  ctx.beginPath();
  ctx.arc(PLACES.helipad.x - camX, PLACES.helipad.y - camY, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.cash;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, 'H', PLACES.helipad.x - camX, PLACES.helipad.y - camY, { size: 16, align: 'center', base: 'middle', colour: PAL.cash });
  // Buildings.
  for (const b of g.city.buildings) {
    ctx.fillStyle = PAL.wall;
    ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - camX + 3, b.y - camY + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(b.x - camX + b.w / 2 - 4, b.y - camY + b.h - 8, 8, 8);
  }
  // Palms.
  for (const pm of g.city.palms) {
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(pm.x - camX - 1, pm.y - camY - 1, 2, 6);
    ctx.fillStyle = PAL.grassDark;
    ctx.fillRect(pm.x - camX - 5, pm.y - camY - 5, 10, 5);
  }
  // Place labels (world space, small; kept above the crates/markers).
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    text(ctx, pl.label, pl.x - camX, pl.y - camY - 42, { size: 7, align: 'center', colour: PAL.paper, shadow: true });
  }
  // Stashes (unopened sparkle).
  for (const s of g.stashes) {
    if (s.taken) continue;
    ctx.fillStyle = PAL.cash;
    ctx.fillRect(s.x - camX - 3, s.y - camY - 3, 6, 6);
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(s.x - camX - 1, s.y - camY - 1, 2, 2);
  }
  // Pickups (mission crates).
  for (const pk of g.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(g.time * 4 + pk.x) * 2;
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(pk.x - camX - 6, pk.y - camY - 6 + bob, 12, 12);
    ctx.strokeStyle = PAL.cash;
    ctx.strokeRect(pk.x - camX - 6.5, pk.y - camY - 6.5 + bob, 13, 13);
    text(ctx, '$', pk.x - camX, pk.y - camY - 4 + bob, { size: 8, align: 'center', colour: PAL.cash });
  }
  // Mission marker: pulsing diamond + ring at the current objective.
  const step = currentStepOf(g);
  if (step && step.x !== undefined) {
    const mx = step.x - camX, my = step.y - camY;
    const pulse = 6 + Math.sin(g.time * 5) * 2;
    ctx.fillStyle = PAL.heli;
    ctx.beginPath();
    ctx.moveTo(mx, my - 12 - pulse); ctx.lineTo(mx + 8, my - pulse); ctx.lineTo(mx, my + 4 - pulse); ctx.lineTo(mx - 8, my - pulse);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PAL.heli;
    ctx.beginPath(); ctx.arc(mx, my, 12 + pulse, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic cars, cops, peds, rivals.
  for (const c of g.cars) drawCar(ctx, c.x - camX, c.y - camY, c.angle, c.colour);
  for (const cop of g.cops) drawCar(ctx, cop.x - camX, cop.y - camY, cop.angle, PAL.cop, true);
  for (const ped of g.peds) if (ped.alive) drawPed(ctx, ped.x - camX, ped.y - camY, ped.angle, ped.shirt, ped.skin);
  for (const r of g.rivals) if (r.alive) drawPed(ctx, r.x - camX, r.y - camY, r.angle, r.shirt, r.skin, true);
  // Bullets.
  ctx.fillStyle = '#ffe94f';
  for (const b of g.bullets) ctx.fillRect(b.x - camX - 1, b.y - camY - 1, 3, 3);
  // Player heli shadow + heli (or car / on foot).
  const p = g.player;
  if (p.inHeli) {
    const h = g.heli;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(h.x - camX, h.y - camY, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    drawHeli(ctx, h.x - camX, h.y - camY - h.alt * 0.45, h.angle, PAL.heli, g.time);
  } else if (p.vehicle) {
    drawCar(ctx, p.vehicle.x - camX, p.vehicle.y - camY, p.vehicle.angle, p.vehicle.colour);
  } else {
    drawPed(ctx, p.x - camX, p.y - camY, p.angle, '#e8e8d0', '#e8b88a', false, true);
  }
  // Parked Seahawk on the pad.
  if (g.heli.parked) drawHeli(ctx, g.heli.x - camX, g.heli.y - camY, g.heli.angle, PAL.heli, g.time);
  // Police heli + searchlight cone.
  if (g.policeHeli.active) {
    const ph = g.policeHeli;
    const px = ph.x - camX, py = ph.y - camY;
    const tx = p.x - camX, ty = p.y - camY;
    ctx.fillStyle = 'rgba(255, 240, 120, 0.18)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx - 14, ty + 10);
    ctx.lineTo(tx + 14, ty + 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 120, 0.5)';
    ctx.beginPath(); ctx.ellipse(tx, ty, 16, 10, 0, 0, Math.PI * 2); ctx.stroke();
    drawHeli(ctx, px, py - 18, ph.angle, '#2f5fd0', g.time);
  }
  // Off-screen objective arrow.
  if (step && step.x !== undefined) {
    const mx = step.x - camX, my = step.y - camY;
    if (mx < 0 || mx > VW || my < 0 || my > VH) {
      const ax = clamp(mx, 20, VW - 20), ay = clamp(my, 20, VH - 20);
      const a = Math.atan2(my - VH / 2, mx - VW / 2);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = PAL.heli;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

function currentStepOf(g) {
  if (g.storyDone) return null;
  const m = MISSIONS[g.missionIndex];
  return m ? m.steps[g.missionStep] : null;
}

function drawCar(ctx, x, y, angle, colour, cop = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#14141c';
  ctx.fillRect(-13, -8, 26, 16);
  ctx.fillStyle = colour;
  ctx.fillRect(-11, -6, 22, 12);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(2, -5, 5, 10);
  ctx.fillStyle = '#ffe94f';
  ctx.fillRect(11, -5, 2, 3);
  ctx.fillRect(11, 3, 2, 3);
  if (cop) {
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(-4, -6, 4, 3);
    ctx.fillStyle = '#4040ff';
    ctx.fillRect(0, -6, 4, 3);
  }
  ctx.restore();
}

function drawPed(ctx, x, y, angle, shirt, skin, hostile = false, isPlayer = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, -3, 5, 5); // head
  ctx.fillStyle = shirt;
  ctx.fillRect(-3, 2, 7, 7); // body
  ctx.fillStyle = '#14141c';
  ctx.fillRect(-3, 9, 3, 3);
  ctx.fillRect(1, 9, 3, 3);
  if (hostile) {
    ctx.strokeStyle = PAL.blood;
    ctx.strokeRect(-6.5, -6.5, 14, 20);
  }
  if (isPlayer) {
    ctx.fillStyle = PAL.cash;
    ctx.fillRect(-1, -9, 3, 3);
  }
  ctx.restore();
}

function drawHeli(ctx, x, y, angle, colour, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fd8ff';
  ctx.beginPath(); ctx.ellipse(7, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#14141c';
  ctx.fillRect(-16, -1, 32, 2); // rotor (spins visually via slight wobble)
  ctx.fillRect(-1, -11 + Math.sin(t * 9) * 1, 2, 22);
  ctx.fillStyle = colour;
  ctx.fillRect(-16, 0, 5, 4); // tail
  ctx.restore();
}

// ---- HUD --------------------------------------------------------------------
export function renderHUD(ctx, g) {
  // Top-left: cash, health, armour, wanted stars.
  text(ctx, '$' + g.cash.toLocaleString(), 6, 6, { size: 10, bold: true, colour: PAL.cash, shadow: true });
  bar(ctx, 6, 20, 64, 5, g.health / 100, '#58d858');
  bar(ctx, 6, 27, 64, 5, g.armour / 100, '#9fd8ff');
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < g.wanted ? '*' : '-';
  text(ctx, stars, 6, 34, { size: 10, bold: true, colour: g.wanted > 0 ? '#ff9040' : '#888888', shadow: true });
  // Mission banner (top-centre).
  const step = currentStepOf(g);
  if (step && !g.storyDone) {
    const m = MISSIONS[g.missionIndex];
    text(ctx, `${m.name} ${g.missionStep + 1}/${m.steps.length}`, 240, 6, { size: 8, bold: true, align: 'center', colour: PAL.heli, shadow: true });
    text(ctx, step.text, 240, 16, { size: 8, align: 'center', colour: PAL.paper, shadow: true });
    if (step.type === 'collect' || step.type === 'kill') {
      text(ctx, `${g.stepCount}/${step.count}`, 240, 26, { size: 8, align: 'center', colour: PAL.cash, shadow: true });
    }
  } else if (g.storyDone) {
    text(ctx, 'STORY COMPLETE', 240, 6, { size: 9, bold: true, align: 'center', colour: PAL.cash, shadow: true });
  }
  renderMinimap(ctx, g);
  // Clock under the minimap.
  const hh = String(Math.floor(g.clockMin / 60)).padStart(2, '0');
  const mm = String(g.clockMin % 60).padStart(2, '0');
  text(ctx, `${hh}:${mm}`, 424, 74, { size: 8, align: 'center', colour: PAL.paper, shadow: true });
  // Weapon slots (bottom-left).
  for (let i = 0; i < 3; i++) {
    const w = g.weapons[i];
    const x = 6 + i * 38, y = 238;
    ctx.fillStyle = i === g.weapon ? '#f4ecd8' : '#00000088';
    ctx.fillRect(x, y, 34, 20);
    ctx.strokeStyle = PAL.ink;
    ctx.strokeRect(x + 0.5, y + 0.5, 34, 20);
    text(ctx, `${i + 1} ${w.name}`, x + 3, y + 2, { size: 7, colour: i === g.weapon ? PAL.ink : PAL.paper });
    text(ctx, w.owned ? `${w.ammo}` : 'LOCKED', x + 3, y + 11, { size: 7, colour: w.owned ? PAL.cash : '#ff7070' });
  }
  // Speed (bottom-right, when driving/flying).
  const p = g.player;
  if (p.vehicle) text(ctx, Math.round(Math.abs(p.vehicle.speed) * 0.9) + ' mph', 474, 240, { size: 9, bold: true, align: 'right', colour: PAL.paper, shadow: true });
  if (p.inHeli) text(ctx, 'ALT ' + Math.round(g.heli.alt) + ' ft', 474, 240, { size: 9, bold: true, align: 'right', colour: PAL.paper, shadow: true });
  // Interaction prompt.
  const prompt = nearPrompt(g);
  if (prompt) text(ctx, prompt, 240, 196, { size: 8, align: 'center', colour: PAL.heli, shadow: true });
  // Dialogue box (kept clear of the weapon slots, which end at x=118).
  if (g.dialogue.length > 0 && g.dialogueT > 0) {
    const d = g.dialogue[g.dialogue.length - 1];
    ctx.fillStyle = 'rgba(20,20,28,0.92)';
    ctx.fillRect(124, 204, 288, 32);
    ctx.strokeStyle = PAL.heli;
    ctx.strokeRect(124.5, 204.5, 288, 32);
    const crew = CREW.find(c => c.name.startsWith(d.speaker)) || CREW[0];
    drawPortrait(ctx, crew, 128, 208, 24, 24, true);
    text(ctx, d.speaker.toUpperCase(), 158, 208, { size: 8, bold: true, colour: PAL.heli });
    wrapText(ctx, d.text, 158, 218, 248, 8);
  }
  // Radio + ticker strip.
  ctx.fillStyle = 'rgba(20,20,28,0.9)';
  ctx.fillRect(0, 262, VW, 8);
  text(ctx, g.radio.name(), 4, 263, { size: 7, colour: PAL.heli });
  text(ctx, g.ticker[0], g.tickerX, 263, { size: 7, colour: PAL.paper });
  // Toast message.
  if (g.msgT > 0) text(ctx, g.msg, 240, 44, { size: 8, align: 'center', colour: PAL.cash, shadow: true });
  // MISSION PASSED / WASTED overlays.
  if (g.missionPassed > 0) {
    ctx.fillStyle = 'rgba(20,20,28,0.75)';
    ctx.fillRect(140, 108, 200, 44);
    ctx.strokeStyle = PAL.cash;
    ctx.strokeRect(140.5, 108.5, 200, 44);
    text(ctx, 'MISSION PASSED', 240, 116, { size: 13, bold: true, align: 'center', colour: PAL.cash });
    const m = MISSIONS[Math.max(0, g.missionIndex - 1)];
    if (m) text(ctx, `+$${m.payout.toLocaleString()}`, 240, 134, { size: 9, align: 'center', colour: PAL.paper });
  }
  if (g.wasted > 0) {
    ctx.fillStyle = 'rgba(120,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);
    text(ctx, 'WASTED', 240, 120, { size: 22, bold: true, align: 'center', colour: '#ff4040', shadow: true });
    text(ctx, 'Respawning at the Safehouse...', 240, 148, { size: 8, align: 'center', colour: PAL.paper });
  }
  // Shop overlay.
  if (g.shop) renderShop(ctx, g);
}

function nearPrompt(g) {
  const p = g.player;
  if (p.inHeli) return g.heli.alt <= 12 ? 'E — Land & exit heli' : 'SPACE climb / C descend';
  if (p.vehicle) return 'E — Exit car';
  if (dist(p.x, p.y, g.heli.x, g.heli.y) < 34 && g.heli.alt < 10) return 'E — Fly the Seahawk';
  if (nearestCarDist(g) < 40) return 'E — Carjack';
  if (dist(p.x, p.y, PLACES.gunshop.x, PLACES.gunshop.y) < 55) return "E — Rico's Guns (shop)";
  if (dist(p.x, p.y, PLACES.market.x, PLACES.market.y) < 55) return 'E — Marina Market (shop)';
  if (dist(p.x, p.y, PLACES.respray.x, PLACES.respray.y) < 55) return 'E — Spray & Go (clear heat $50)';
  return '';
}

function nearestCarDist(g) {
  let bd = Infinity;
  for (const c of g.cars) {
    if (c.driver === 'player') continue;
    bd = Math.min(bd, dist(g.player.x, g.player.y, c.x, c.y));
  }
  return bd;
}

function wrapText(ctx, s, x, y, maxW, size) {
  const words = s.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (test.length * (size * 0.62) > maxW && line) {
      text(ctx, line, x, yy, { size, colour: PAL.paper });
      line = w;
      yy += size + 1;
    } else {
      line = test;
    }
  }
  if (line) text(ctx, line, x, yy, { size, colour: PAL.paper });
}

function renderMinimap(ctx, g) {
  const mx = 376, my = 6, mw = 98, mh = 64;
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(mx + ISLAND.x * sx, my + ISLAND.y * sy, ISLAND.w * sx, ISLAND.h * sy);
  ctx.strokeStyle = PAL.road;
  ctx.lineWidth = 1;
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(mx + rx * sx, my + ISLAND.y * sy); ctx.lineTo(mx + rx * sx, my + (ISLAND.y + ISLAND.h) * sy); ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath(); ctx.moveTo(mx + ISLAND.x * sx, my + ry * sy); ctx.lineTo(mx + (ISLAND.x + ISLAND.w) * sx, my + ry * sy); ctx.stroke();
  }
  const step = currentStepOf(g);
  if (step && step.x !== undefined) {
    ctx.fillStyle = PAL.heli;
    ctx.fillRect(mx + step.x * sx - 2, my + step.y * sy - 2, 5, 5);
  }
  for (const cop of g.cops) {
    ctx.fillStyle = '#4040ff';
    ctx.fillRect(mx + cop.x * sx - 1, my + cop.y * sy - 1, 3, 3);
  }
  if (g.policeHeli.active) {
    ctx.fillStyle = '#4040ff';
    ctx.fillRect(mx + g.policeHeli.x * sx - 1, my + g.policeHeli.y * sy - 1, 3, 3);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx + g.player.x * sx - 2, my + g.player.y * sy - 2, 4, 4);
  ctx.strokeStyle = PAL.paper;
  ctx.strokeRect(mx + 0.5, my + 0.5, mw, mh);
}

function renderShop(ctx, g) {
  const items = g.shop === 'gun'
    ? [{ name: 'SMG', price: 800 }, { name: 'Rifle', price: 1500 }, { name: 'Pistol ammo +24', price: 100 }, { name: 'SMG ammo +60', price: 150 }]
    : [{ name: 'Health +50', price: 80 }, { name: 'Armour +50', price: 120 }, { name: 'Snack +10 HP', price: 20 }];
  const title = g.shop === 'gun' ? "RICO'S GUNS" : 'MARINA MARKET';
  ctx.fillStyle = 'rgba(20,20,28,0.92)';
  ctx.fillRect(140, 70, 200, 40 + items.length * 16);
  ctx.strokeStyle = PAL.heli;
  ctx.strokeRect(140.5, 70.5, 200, 40 + items.length * 16);
  text(ctx, title, 240, 78, { size: 10, bold: true, align: 'center', colour: PAL.heli });
  text(ctx, 'Cash $' + g.cash.toLocaleString(), 240, 92, { size: 8, align: 'center', colour: PAL.cash });
  items.forEach((it, i) => {
    text(ctx, `${i + 1}. ${it.name} — $${it.price}`, 150, 108 + i * 16, { size: 8, colour: PAL.paper });
  });
  text(ctx, 'Press 1-4 to buy, E to leave', 240, 108 + items.length * 16 + 4, { size: 7, align: 'center', colour: '#aaaaaa' });
}

// ---- title screen ------------------------------------------------------------
export function renderTitle(ctx, g) {
  ctx.fillStyle = '#1d2f5e';
  ctx.fillRect(0, 0, VW, VH);
  // Sun + skyline silhouette.
  ctx.fillStyle = '#e8a24f';
  ctx.beginPath(); ctx.arc(400, 52, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#14141c';
  for (let i = 0; i < 14; i++) {
    const bw = 18 + ((i * 37) % 22);
    ctx.fillRect(8 + i * 34, 210 - bw, 26, bw);
  }
  ctx.fillStyle = '#1d6fb8';
  ctx.fillRect(0, 210, VW, 60);
  text(ctx, 'SOLMARINA', 240, 34, { size: 34, bold: true, align: 'center', colour: PAL.heli, shadow: true });
  text(ctx, 'A PIXEL OPEN-WORLD CRIME STORY', 240, 74, { size: 9, align: 'center', colour: PAL.paper, shadow: true });
  // Crew portraits.
  CREW.forEach((c, i) => {
    const x = 52 + i * 100;
    drawPortrait(ctx, c, x, 96, 72, 72, false);
    text(ctx, c.name, x + 36, 172, { size: 8, bold: true, align: 'center', colour: PAL.paper, shadow: true });
    text(ctx, c.role, x + 36, 182, { size: 7, align: 'center', colour: PAL.heli });
  });
  text(ctx, 'PRESS ENTER TO START', 240, 208, { size: 11, bold: true, align: 'center', colour: g.time % 1 < 0.6 ? PAL.cash : PAL.paper, shadow: true });
  text(ctx, 'WASD move / drive  •  E enter car, carjack, fly heli  •  Mouse aim, Click shoot', 240, 230, { size: 7, align: 'center', colour: PAL.paper });
  text(ctx, '1-3 weapons  •  R radio  •  M mute  •  Shift+S save  •  L load  •  P / ESC map', 240, 240, { size: 7, align: 'center', colour: PAL.paper });
  text(ctx, '10 missions with Ada Kline  •  5-star wanted  •  Police heli at 4 stars', 240, 250, { size: 7, align: 'center', colour: '#aaaaaa' });
}

// Pixel portrait: flat colours, chunky features, distinct per crew member.
export function drawPortrait(ctx, crew, x, y, w, h, small) {
  ctx.save();
  ctx.fillStyle = '#2c3a5e';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PAL.ink;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  const cx = x + w / 2;
  // Shirt / shoulders.
  ctx.fillStyle = crew.shirt;
  ctx.fillRect(x + 6, y + h - 18, w - 12, 18);
  // Neck + head.
  ctx.fillStyle = crew.skin;
  ctx.fillRect(cx - 3, y + h - 30, 6, 12);
  ctx.fillRect(cx - 11, y + 8, 22, 22);
  // Hair (style varies by crew index).
  ctx.fillStyle = crew.hair;
  const idx = CREW.indexOf(crew);
  if (idx === 0) { ctx.fillRect(cx - 11, y + 4, 22, 8); ctx.fillRect(cx - 11, y + 4, 4, 16); } // Ada: long side hair
  else if (idx === 1) { ctx.fillRect(cx - 11, y + 6, 22, 5); } // Rico: short
  else if (idx === 2) { ctx.fillRect(cx - 12, y + 2, 24, 10); ctx.fillRect(cx + 8, y + 2, 4, 18); } // Marisol: red sweep
  else { ctx.fillRect(cx - 11, y + 8, 22, 4); ctx.fillRect(cx - 3, y + 2, 6, 8); } // Rig: buzz + tuft
  // Eyes + mouth.
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(cx - 7, y + 17, 3, 3);
  ctx.fillRect(cx + 4, y + 17, 3, 3);
  ctx.fillRect(cx - 3, y + 25, 6, 1);
  ctx.restore();
}

// ---- pause / map screen -------------------------------------------------------
export function renderPause(ctx, g) {
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(0, 0, VW, VH);
  text(ctx, 'MAP — SOLMARINA', 240, 8, { size: 12, bold: true, align: 'center', colour: PAL.heli });
  // Full map (left-centre).
  const mx = 14, my = 30, mw = 250, mh = 190;
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(mx + ISLAND.x * sx, my + ISLAND.y * sy, ISLAND.w * sx, ISLAND.h * sy);
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(mx + ISLAND.x * sx, my + (ISLAND.y + ISLAND.h - 90) * sy, ISLAND.w * sx, 90 * sy);
  ctx.strokeStyle = PAL.road;
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(mx + rx * sx, my + ISLAND.y * sy); ctx.lineTo(mx + rx * sx, my + (ISLAND.y + ISLAND.h) * sy); ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath(); ctx.moveTo(mx + ISLAND.x * sx, my + ry * sy); ctx.lineTo(mx + (ISLAND.x + ISLAND.w) * sx, my + ry * sy); ctx.stroke();
  }
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    ctx.fillStyle = PAL.heli;
    ctx.fillRect(mx + pl.x * sx - 2, my + pl.y * sy - 2, 4, 4);
  }
  const step = currentStepOf(g);
  if (step && step.x !== undefined) {
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(mx + step.x * sx, my + step.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx + g.player.x * sx - 2, my + g.player.y * sy - 2, 4, 4);
  text(ctx, 'You', mx + g.player.x * sx + 6, my + g.player.y * sy - 3, { size: 7, colour: '#ffffff' });
  // Mission checklist (right).
  const lx = 278;
  text(ctx, 'MISSIONS — ADA KLINE', lx, 30, { size: 8, bold: true, colour: PAL.heli });
  MISSIONS.forEach((m, i) => {
    const done = i < g.missionIndex || g.storyDone;
    const cur = i === g.missionIndex && !g.storyDone;
    const mark = done ? '[x]' : cur ? '>>>' : '[ ]';
    const col = done ? PAL.cash : cur ? PAL.heli : '#888888';
    text(ctx, `${mark} ${m.name}  +$${m.payout.toLocaleString()}`, lx, 44 + i * 13, { size: 7, colour: col });
  });
  // Stats.
  const sy0 = 182;
  text(ctx, 'STATS', lx, sy0, { size: 8, bold: true, colour: PAL.heli });
  text(ctx, `Cash $${g.cash.toLocaleString()}   Earned $${g.stats.earned.toLocaleString()}`, lx, sy0 + 12, { size: 7, colour: PAL.paper });
  text(ctx, `Missions ${g.stats.missionsDone}/10   Cars stolen ${g.stats.carsStolen}`, lx, sy0 + 22, { size: 7, colour: PAL.paper });
  text(ctx, `Takedowns ${g.stats.kills}   Stashes ${g.stashes.filter(s => s.taken).length}/5`, lx, sy0 + 32, { size: 7, colour: PAL.paper });
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('solmarina-save-v1') || 'null'); } catch (e) { saved = null; }
  text(ctx, saved ? `Save slot: $${saved.cash.toLocaleString()}  ${new Date(saved.savedAt).toLocaleTimeString()}` : 'Save slot: empty (press Shift+S to save)', lx, sy0 + 44, { size: 7, colour: '#aaaaaa' });
  text(ctx, 'ESC / P — resume    Shift+S — save    L — load', 240, 252, { size: 8, align: 'center', colour: PAL.paper });
}
