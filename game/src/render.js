// render.js — pixel-art world rendering on the 480x270 buffer. Freshly authored.
import { G, WORLD_W, WORLD_H } from './state.js';
import { PAL, CAR_COLORS } from './utils.js';
import { DISTRICTS, BUILDINGS, LANDMARKS, ROADS_X, ROADS_Y, isWater, districtAt, isRoad } from './city.js';
import { wantedStars } from './police.js';
import { missionObjectivePos } from './missions.js';

export function drawWorld(ctx) {
  const cam = G.cam;
  const vx = cam.x - 240, vy = cam.y - 135;
  // sunset sky tint at top when looking at sea edge — ground base
  ctx.fillStyle = '#2e7d4f'; ctx.fillRect(0, 0, 480, 270);
  // sea (west)
  const seaX = 260 - vx;
  if (seaX > -10) {
    ctx.fillStyle = PAL.sea; ctx.fillRect(0, 0, Math.min(480, seaX), 270);
    ctx.fillStyle = PAL.seaDark;
    for (let y = 0; y < 270; y += 18) {
      const off = ((G.time / 2 + y * 3) % 36) - 18;
      ctx.fillRect(Math.max(0, seaX - 60 + off), y, 24, 2);
    }
  }
  // beach sand strip
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(Math.max(0, 260 - vx), 0, Math.min(480, 320 - vx) - Math.max(0, 260 - vx), 270);
  // districts tint
  for (const d of DISTRICTS) {
    ctx.globalAlpha = 0.16; ctx.fillStyle = d.color;
    ctx.fillRect(d.x - vx, d.y - vy, d.w, d.h); ctx.globalAlpha = 1;
  }
  // roads
  ctx.fillStyle = PAL.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - 26 - vx, -vy, 52, WORLD_H);
  for (const ry of ROADS_Y) ctx.fillRect(-vx, ry - 26 - vy, WORLD_W, 52);
  ctx.fillStyle = PAL.roadLine;
  for (const rx of ROADS_X) for (let y = 0; y < WORLD_H; y += 32) ctx.fillRect(rx - 1 - vx, y - vy, 2, 14);
  for (const ry of ROADS_Y) for (let x = 0; x < WORLD_W; x += 32) ctx.fillRect(x - vx, ry - 1 - vy, 14, 2);
  // causeway bridge over the sea
  ctx.fillStyle = '#6a6a7a'; ctx.fillRect(0, 880 - vy, 260, 80);
  ctx.fillStyle = PAL.roadLine; for (let x = 0; x < 260; x += 32) ctx.fillRect(x - vx, 918 - vy, 14, 2);
  // palms
  for (const palm of BUILDINGS.palms) {
    ctx.fillStyle = '#6a4a2f'; ctx.fillRect(palm.x - vx - 1, palm.y - vy - 6, 2, 8);
    ctx.fillStyle = '#2e9e4f';
    ctx.fillRect(palm.x - vx - 5, palm.y - vy - 9, 10, 3);
    ctx.fillRect(palm.x - vx - 3, palm.y - vy - 11, 6, 2);
  }
  // buildings (with fake height shadow)
  for (const b of BUILDINGS) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x - vx + 3, b.y - vy + 3, b.w, b.h);
    ctx.fillStyle = b.c; ctx.fillRect(b.x - vx, b.y - vy, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(b.x - vx, b.y - vy, b.w, 3);
    ctx.fillStyle = '#ffd23f';
    for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 18) for (let wy = b.y + 8; wy < b.y + b.h - 8; wy += 18) {
      if (((wx + wy) % 36) < 18) ctx.fillRect(wx - vx, wy - vy, 6, 5);
    }
  }
  // landmarks: signs + pads
  drawLandmark(ctx, vx, vy, LANDMARKS.safehouse, '#3fae5a', 'H');
  drawLandmark(ctx, vx, vy, LANDMARKS.gunshop, '#e63946', '$');
  drawLandmark(ctx, vx, vy, LANDMARKS.market, '#ffc300', 'M');
  drawLandmark(ctx, vx, vy, LANDMARKS.respray, '#ff5da2', 'R');
  drawLandmark(ctx, vx, vy, LANDMARKS.garage, '#7b2fbe', 'G');
  drawLandmark(ctx, vx, vy, LANDMARKS.hospital, '#f5f0ff', '+');
  drawLandmark(ctx, vx, vy, LANDMARKS.casino, '#ffc300', 'C');
  drawLandmark(ctx, vx, vy, LANDMARKS.diner, '#ff7e5f', 'D');
  drawLandmark(ctx, vx, vy, LANDMARKS.marina, '#0e7c86', 'A');
  drawLandmark(ctx, vx, vy, LANDMARKS.ferris, '#ff2e88', 'F');
  drawLandmark(ctx, vx, vy, LANDMARKS.pier, '#f2c98a', 'P');
  // helipad
  const hp = LANDMARKS.helipad;
  ctx.fillStyle = '#3a3a4a'; ctx.beginPath(); ctx.arc(hp.x - vx, hp.y - vy, 26, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hp.x - vx, hp.y - vy, 20, 0, 7); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText('H', hp.x - vx, hp.y - vy + 6);
  // stashes
  for (const s of G.stashes) {
    if (s.taken) continue;
    const bob = Math.sin(G.time / 20 + s.x) * 2;
    ctx.fillStyle = '#ffc300'; ctx.fillRect(s.x - vx - 4, s.y - vy - 4 + bob, 8, 8);
    ctx.fillStyle = '#000'; ctx.fillRect(s.x - vx - 2, s.y - vy - 1 + bob, 4, 2);
  }
  // mission objective marker
  const obj = missionObjectivePos();
  if (obj && G.screen === 'play') {
    const pulse = 6 + Math.sin(G.time / 12) * 3;
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(obj.x - vx, obj.y - vy, obj.r + pulse, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(obj.x - vx, obj.y - vy - 26 - pulse); ctx.lineTo(obj.x - vx - 5, obj.y - vy - 16 - pulse); ctx.lineTo(obj.x - vx + 5, obj.y - vy - 16 - pulse); ctx.fill();
  }
  drawEntities(ctx, vx, vy);
  // police heli searchlight cone
  if (G.policeHeli) {
    const h = G.policeHeli;
    const hx = h.x - vx, hy = h.y - vy - h.z * 0.5;
    const px = G.player.x - vx, py = G.player.y - vy;
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff8c0';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(px - 26, py); ctx.lineTo(px + 26, py); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff8c0';
    ctx.beginPath(); ctx.arc(px, py, 18, 0, 7); ctx.fill();
    ctx.restore();
  }
}

function drawLandmark(ctx, vx, vy, lm, color, letter) {
  ctx.fillStyle = color; ctx.fillRect(lm.x - vx - 12, lm.y - vy - 8, 24, 16);
  ctx.fillStyle = '#0c0616'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  ctx.fillText(letter, lm.x - vx, lm.y - vy + 4);
}

function drawCarShape(ctx, x, y, angle, color, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-11, -6, 22, 12);
  ctx.fillStyle = color; ctx.fillRect(-12, -7, 24, 14);
  ctx.fillStyle = '#bfe8ff'; ctx.fillRect(-2, -6, 7, 12);
  ctx.fillStyle = '#222'; ctx.fillRect(-10, -8, 5, 3); ctx.fillRect(-10, 5, 5, 3); ctx.fillRect(7, -8, 5, 3); ctx.fillRect(7, 5, 5, 3);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(11, -6, 1, 3); ctx.fillRect(11, 3, 1, 3);
  ctx.restore();
}
function drawHeliShape(ctx, x, y, angle, z, color, rotor) {
  const lift = z * 0.45;
  ctx.save(); ctx.translate(x, y - lift);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, lift * 0.6 + 6, 14, 5, 0, 0, 7); ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.ellipse(7, 0, 4, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#333'; ctx.fillRect(-16, -1, 6, 2);
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-Math.cos(rotor) * 20, -Math.sin(rotor) * 20); ctx.lineTo(Math.cos(rotor) * 20, Math.sin(rotor) * 20); ctx.stroke();
  ctx.restore();
}
function drawPerson(ctx, x, y, angle, skin, shirt, bob) {
  ctx.save(); ctx.translate(x, y + bob);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 5, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = shirt; ctx.fillRect(-4, -4, 8, 9);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(5, 0, 3.4, 0, 7); ctx.fill();
  ctx.restore();
}
function drawEntities(ctx, vx, vy) {
  const p = G.player;
  for (const t of G.traffic) drawCarShape(ctx, t.x - vx, t.y - vy, t.angle, t.color);
  for (const c of G.cars) drawCarShape(ctx, c.x - vx, c.y - vy, c.angle, c.color);
  for (const cop of G.cops) {
    drawCarShape(ctx, cop.x - vx, cop.y - vy, cop.angle, '#1a1a2e');
    ctx.fillStyle = '#e63946';
    const blink = Math.floor(G.time / 8) % 2 === 0;
    ctx.fillRect(cop.x - vx - 6, cop.y - vy - 9, 4, 2);
    if (blink) { ctx.fillStyle = '#3f7cff'; ctx.fillRect(cop.x - vx + 2, cop.y - vy - 9, 4, 2); }
  }
  for (const ped of G.peds) drawPerson(ctx, ped.x - vx, ped.y - vy, ped.angle, ped.skin, ped.shirt, ped.panic ? Math.sin(G.time / 3) * 1 : 0);
  for (const e of G.enemies) {
    if (e.dead) continue;
    drawPerson(ctx, e.x - vx, e.y - vy, e.angle, '#c98a5a', '#222', 0);
    ctx.fillStyle = '#000'; ctx.fillRect(e.x - vx - 10, e.y - vy - 14, 20, 3);
    ctx.fillStyle = '#e63946'; ctx.fillRect(e.x - vx - 10, e.y - vy - 14, 20 * (e.hp / e.maxHp), 3);
  }
  // player heli (parked or flown)
  if (G.heli) {
    const h = G.heli;
    if (!p.heli || p.heli !== h) drawHeliShape(ctx, h.x - vx, h.y - vy, h.angle, h.z, '#ff5da2', h.rotor || 0);
  }
  if (G.policeHeli) drawHeliShape(ctx, G.policeHeli.x - vx, G.policeHeli.y - vy, G.policeHeli.angle, G.policeHeli.z, '#1a1a2e', G.time / 6);
  // player
  if (p.heli) drawHeliShape(ctx, p.heli.x - vx, p.heli.y - vy, p.heli.angle, p.heli.z, '#ff5da2', p.heli.rotor);
  else if (p.car) drawCarShape(ctx, p.car.x - vx, p.car.y - vy, p.car.angle, p.car.color);
  else drawPerson(ctx, p.x - vx, p.y - vy, p.angle, '#e8b48a', '#ff2e88', p.moving ? Math.sin(G.time / 4) * 1.2 : 0);
  // bullets
  ctx.fillStyle = '#ffd23f';
  for (const b of G.bullets) ctx.fillRect(b.x - vx - 1, b.y - vy - 1, 3, 3);
  // popups
  ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
  for (const pop of G.popups) {
    ctx.globalAlpha = Math.min(1, pop.t / 30);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x - vx, pop.y - vy - (70 - pop.t) * 0.4);
    ctx.globalAlpha = 1;
  }
}
