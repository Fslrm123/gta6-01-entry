// render.js — draws Solmarina as PIXEL ART, GTA 1/2 style. Everything is
// rendered into a tiny 480x270 buffer and blown up with nearest-neighbour
// sampling, so every edge lands on a crisp chunky pixel. The world camera
// shows 960x540 world units (a 2x zoom over the old view), which makes the
// on-foot character big and readable. All sprites are built from flat
// rectangles on a limited palette — no smooth shapes, no gradients in the
// world, positions snapped to whole buffer pixels.
//
// Palette (16 colours, used everywhere):
//   grass #5fae3f / dark #549c38 · sand #e8d39a · sea #2f7fc1
//   asphalt #3a3f4a · sidewalk #b0a894 · roof stucco #d98a5f #8fb4d9 #d9c07a
//   #c07a7a #8fb98a · gold #f1c40f · red #e74c3c · blue #3498db · teal #0e7c7b

import { CITY, WORLD_W, WORLD_H, BEACH_Y, ROAD_W, LANDMARKS } from './city.js';
import { SHOP_DEFS } from './shops.js';
import { clamp } from './utils.js';

export const BUF_W = 480;
export const BUF_H = 270;
export const VIEW_W = 960; // world units visible across the buffer
export const VIEW_H = 540;

const SEA = '#2f7fc1';
const SAND = '#e8d39a';
const GRASS = '#5fae3f';
const GRASS_DARK = '#549c38';
const ASPHALT = '#3a3f4a';
const SIDEWALK = '#b0a894';
const GOLD = '#f1c40f';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buf = document.createElement('canvas');
    this.buf.width = BUF_W;
    this.buf.height = BUF_H;
    this.bctx = this.buf.getContext('2d');
    this.bctx.imageSmoothingEnabled = false;
  }

  // Draw the whole world into the low-res buffer.
  drawWorld(game) {
    const ctx = this.bctx;
    const cam = game.camera;
    // Snap the camera to whole buffer pixels (2 world units) so the
    // upscale never shimmers.
    const cx = Math.round((cam.x + game.shakeX) / 2) * 2;
    const cy = Math.round((cam.y + game.shakeY) / 2) * 2;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, BUF_W, BUF_H);
    ctx.setTransform(0.5, 0, 0, 0.5, -cx * 0.5, -cy * 0.5);

    const vx0 = cx - 60, vy0 = cy - 60, vx1 = cx + VIEW_W + 60, vy1 = cy + VIEW_H + 60;

    this.drawGround(ctx, vx0, vy0, vx1, vy1);
    this.drawRoads(ctx, vx0, vy0, vx1, vy1);
    this.drawPark(ctx, vx0, vy0, vx1, vy1);
    this.drawBuildings(ctx, vx0, vy0, vx1, vy1);
    this.drawProps(ctx, vx0, vy0, vx1, vy1, game);
    this.drawPickups(game, ctx);
    this.drawMissionMarkers(game, ctx);
    for (const c of game.traffic.cars) this.drawCar(ctx, c);
    for (const c of game.police.cruisers) this.drawCar(ctx, c, true);
    for (const h of game.helis) this.drawHeli(ctx, h);
    for (const h of game.police.helis) this.drawHeli(ctx, h, true);
    for (const p of game.crowd.peds) this.drawPed(ctx, p);
    for (const e of game.missions.enemies) this.drawEnemy(ctx, e);
    for (const o of game.police.officers) this.drawOfficer(ctx, o);
    this.drawPlayer(game, ctx);
    this.drawTracers(game, ctx);
    this.drawParticles(game, ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Blit the buffer onto the real canvas, nearest-neighbour, fullscreen.
  present() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.buf, 0, 0, this.canvas.width, this.canvas.height);
  }

  drawGround(ctx, x0, y0, x1, y1) {
    ctx.fillStyle = GRASS;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Mow stripes for a little texture.
    ctx.fillStyle = GRASS_DARK;
    const stripe = 140;
    for (let y = Math.floor(y0 / stripe) * stripe; y < y1; y += stripe * 2) {
      if (y > BEACH_Y) continue;
      ctx.fillRect(x0, y, x1 - x0, stripe);
    }
    // Beach and sea along the south edge.
    if (y1 > BEACH_Y) {
      ctx.fillStyle = SAND;
      ctx.fillRect(x0, Math.max(y0, BEACH_Y), x1 - x0, WORLD_H - Math.max(y0, BEACH_Y));
      ctx.fillStyle = SEA;
      const seaY = WORLD_H - 130;
      if (y1 > seaY) {
        ctx.fillRect(x0, Math.max(y0, seaY), x1 - x0, WORLD_H - Math.max(y0, seaY));
        // Chunky wave bars.
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 3; i++) {
          const wy = seaY + 18 + i * 34;
          if (wy < y0 || wy > y1) continue;
          for (let x = Math.floor(x0 / 120) * 120; x < x1; x += 120) {
            ctx.fillRect(x, wy + (i % 2) * 6, 70, 4);
          }
        }
      }
    }
  }

  drawRoads(ctx, x0, y0, x1, y1) {
    ctx.fillStyle = ASPHALT;
    for (const rx of CITY.roadsV) {
      if (rx + ROAD_W / 2 < x0 || rx - ROAD_W / 2 > x1) continue;
      ctx.fillRect(rx - ROAD_W / 2, Math.max(y0, 0), ROAD_W, Math.min(y1, BEACH_Y) - Math.max(y0, 0));
    }
    for (const ry of CITY.roadsH) {
      if (ry + ROAD_W / 2 < y0 || ry - ROAD_W / 2 > y1) continue;
      ctx.fillRect(Math.max(x0, 0), ry - ROAD_W / 2, Math.min(x1, WORLD_W) - Math.max(x0, 0), ROAD_W);
    }
    // Sidewalk edges.
    ctx.fillStyle = SIDEWALK;
    for (const rx of CITY.roadsV) {
      if (rx + ROAD_W / 2 + 12 < x0 || rx - ROAD_W / 2 - 12 > x1) continue;
      ctx.fillRect(rx - ROAD_W / 2 - 10, Math.max(y0, 0), 10, Math.min(y1, BEACH_Y) - Math.max(y0, 0));
      ctx.fillRect(rx + ROAD_W / 2, Math.max(y0, 0), 10, Math.min(y1, BEACH_Y) - Math.max(y0, 0));
    }
    for (const ry of CITY.roadsH) {
      if (ry + ROAD_W / 2 + 12 < y0 || ry - ROAD_W / 2 - 12 > y1) continue;
      ctx.fillRect(Math.max(x0, 0), ry - ROAD_W / 2 - 10, Math.min(x1, WORLD_W) - Math.max(x0, 0), 10);
      ctx.fillRect(Math.max(x0, 0), ry + ROAD_W / 2, Math.min(x1, WORLD_W) - Math.max(x0, 0), 10);
    }
    // Centre dashes.
    ctx.fillStyle = '#f5d76e';
    for (const rx of CITY.roadsV) {
      if (rx < x0 || rx > x1) continue;
      for (let y = Math.floor(y0 / 44) * 44; y < Math.min(y1, BEACH_Y); y += 44) {
        if (CITY.roadsH.some((ry) => Math.abs(y - ry) < ROAD_W / 2 + 6)) continue;
        ctx.fillRect(rx - 3, y, 6, 22);
      }
    }
    for (const ry of CITY.roadsH) {
      if (ry < y0 || ry > y1) continue;
      for (let x = Math.floor(x0 / 44) * 44; x < Math.min(x1, WORLD_W); x += 44) {
        if (CITY.roadsV.some((rx) => Math.abs(x - rx) < ROAD_W / 2 + 6)) continue;
        ctx.fillRect(x, ry - 3, 22, 6);
      }
    }
  }

  drawPark(ctx, x0, y0, x1, y1) {
    const px0 = 700, py0 = 1300, px1 = 1120, py1 = 1720;
    if (px1 < x0 || px0 > x1 || py1 < y0 || py0 > y1) return;
    ctx.fillStyle = '#4a8f36';
    ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
    // Pond: a flat blue block.
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(830, 1470, 160, 100);
    ctx.fillStyle = '#6db3f2';
    ctx.fillRect(830, 1470, 160, 18);
    // Path.
    ctx.fillStyle = '#d9c9a8';
    ctx.fillRect(px0, py0 + 210, px1 - px0, 16);
  }

  drawBuildings(ctx, x0, y0, x1, y1) {
    for (const b of CITY.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      const h = b.height;
      // Fake-3D: wall face offset down, then the roof on top. All rects.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 6, b.y + h * 0.5 + 6, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y + h * 0.5, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Roof trim.
      ctx.strokeStyle = b.trim;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      // Roof details: pool on towers, shop sign, vent block.
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (b.kind === 'tower') {
        ctx.fillStyle = '#7fb3d5';
        ctx.fillRect(cx - 26, cy - 14, 52, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(cx - 26, cy - 14, 52, 8);
      } else if (b.kind === 'shop') {
        ctx.fillStyle = GOLD;
        ctx.fillRect(b.x + 10, b.y + 10, 34, 18);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(cx - 12, cy - 12, 24, 24);
      }
      // Windows on the wall face, in a straight pixel row.
      ctx.fillStyle = 'rgba(20,30,45,0.75)';
      const cols = Math.max(2, Math.floor(b.w / 42));
      for (let i = 0; i < cols; i++) {
        ctx.fillRect(b.x + 12 + i * ((b.w - 24) / cols), b.y + b.h + h * 0.5 - 12, 16, 9);
      }
    }
  }

  drawProps(ctx, x0, y0, x1, y1, game) {
    for (const p of CITY.props) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      if (p.kind === 'lamp') {
        ctx.fillStyle = '#2c2c34';
        ctx.fillRect(p.x - 2, p.y - 6, 4, 12);
        ctx.fillStyle = '#fff0b4';
        ctx.fillRect(p.x - 4, p.y - 8, 8, 6);
      } else if (p.kind === 'hydrant') {
        ctx.fillStyle = '#d43d2a';
        ctx.fillRect(p.x - 4, p.y - 5, 8, 10);
      } else if (p.kind === 'umbrella') {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(p.x - 14, p.y - 6, 28, 8);
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(p.x - 14, p.y - 6, 14, 8);
        ctx.fillStyle = '#8d5524';
        ctx.fillRect(p.x - 2, p.y + 2, 4, 10);
      } else if (p.kind === 'chair') {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(p.x - 8, p.y - 4, 16, 8);
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(p.x - 8, p.y - 4, 16, 3);
      } else if (p.kind === 'crate') {
        ctx.fillStyle = '#a8763e';
        const s = 26 * (p.s || 1);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        ctx.strokeStyle = '#7d5a2e';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === 'boat') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(-26, -8, 52, 16);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-26, -8, 10, 16);
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(0, -34); ctx.lineTo(16, -8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8d5524';
        ctx.fillRect(-2, -34, 4, 28);
        ctx.restore();
      }
    }
    // Palm trees: blocky trunks and square frond clusters.
    for (const t of CITY.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      const s = t.s;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(t.x + 2, t.y + 4, 14 * s, 6 * s);
      ctx.fillStyle = '#8a6d3b';
      ctx.fillRect(t.x - 2, t.y - 8 * s, 5, 16 * s);
      ctx.fillStyle = '#2f9e44';
      ctx.fillRect(t.x - 13 * s, t.y - 14 * s, 26 * s, 8 * s);
      ctx.fillRect(t.x - 8 * s, t.y - 20 * s, 16 * s, 8 * s);
      ctx.fillStyle = '#37b24d';
      ctx.fillRect(t.x - 13 * s, t.y - 14 * s, 26 * s, 3 * s);
    }
    // Helipad: dark pad, yellow border, big H.
    const hp = LANDMARKS.helipad;
    if (hp.x > x0 && hp.x < x1 && hp.y > y0 && hp.y < y1) {
      ctx.fillStyle = '#2c2c34';
      ctx.fillRect(hp.x - 70, hp.y - 70, 140, 140);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 6;
      ctx.strokeRect(hp.x - 62, hp.y - 62, 124, 124);
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 64px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', hp.x, hp.y + 2);
    }
    // Shop storefronts: striped awnings with a sign.
    for (const def of SHOP_DEFS) {
      const sx = def.x, sy = def.y;
      if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue;
      ctx.fillStyle = '#20262e';
      ctx.fillRect(sx - 34, sy - 22, 68, 44);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#f5f5f5' : (def.id === 'gunshop' ? '#e74c3c' : '#2ecc71');
        ctx.fillRect(sx - 34 + i * 17, sy - 22, 17, 12);
      }
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', sx, sy + 12);
    }
  }

  drawPickups(game, ctx) {
    for (const p of game.combat.pickups) {
      const bob = Math.round(Math.sin(p.bob) * 3);
      const colors = { health: '#e74c3c', armor: '#3498db', pistol: '#f1c40f', smg: '#f39c12' };
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(p.x - 12, p.y + 12, 24, 8);
      ctx.fillStyle = colors[p.kind] || '#fff';
      ctx.fillRect(p.x - 12, p.y - 12 + bob, 24, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'health' ? '+' : p.kind === 'armor' ? 'A' : '◈', p.x, p.y + bob + 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 16, p.y - 16 + bob, 32, 32);
    }
  }

  drawMissionMarkers(game, ctx) {
    const obj = game.missions.objectivePoint();
    if (!obj || game.state !== 'playing') return;
    const pulse = Math.sin(game.time * 4) > 0 ? 34 : 30;
    // Ground marker: a pulsing square ring.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.strokeRect(obj.x - pulse, obj.y - pulse, pulse * 2, pulse * 2);
    ctx.fillStyle = 'rgba(241,196,15,0.25)';
    ctx.fillRect(obj.x - pulse, obj.y - pulse, pulse * 2, pulse * 2);
    // Floating diamond.
    const dy = Math.round(Math.sin(game.time * 3) * 8);
    ctx.fillStyle = GOLD;
    ctx.save();
    ctx.translate(obj.x, obj.y - 58 + dy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
    // Cash-run drops.
    for (const d of game.missions.drops) {
      if (d.taken) continue;
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(d.x - 14, d.y - 14, 28, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', d.x, d.y + 1);
    }
    // The case / anchor for heist missions: a gold block at the target.
    const m = game.missions.current;
    if (m && (m.heist || m.id === 'golden-anchor') && !game.missions.caseTaken && game.missions.active) {
      const t = m.target;
      ctx.fillStyle = GOLD;
      ctx.fillRect(t.x - 12, t.y - 12, 24, 24);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(t.x - 12, t.y - 12, 24, 24);
    }
  }

  drawCar(ctx, car, isPolice = false) {
    ctx.save();
    ctx.translate(Math.round(car.x), Math.round(car.y));
    ctx.rotate(car.angle);
    if (car.dead) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-car.len / 2, -car.wid / 2, car.len, car.wid);
      ctx.restore();
      return;
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
    // Wheels: four dark blocks at the corners.
    ctx.fillStyle = '#141414';
    ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 - 3, 12, 6);
    ctx.fillRect(-car.len / 2 + 4, car.wid / 2 - 3, 12, 6);
    ctx.fillRect(car.len / 2 - 16, -car.wid / 2 - 3, 12, 6);
    ctx.fillRect(car.len / 2 - 16, car.wid / 2 - 3, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    ctx.fillRect(-car.len / 2, -car.wid / 2, car.len, car.wid);
    // Cabin + windshield.
    ctx.fillStyle = '#20262e';
    ctx.fillRect(-car.len * 0.18, -car.wid / 2 + 4, car.len * 0.32, car.wid - 8);
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(car.len * 0.14, -car.wid / 2 + 5, 5, car.wid - 10);
    // Headlights / taillights.
    ctx.fillStyle = '#fff6b0';
    ctx.fillRect(car.len / 2 - 3, -car.wid / 2 + 3, 3, 6);
    ctx.fillRect(car.len / 2 - 3, car.wid / 2 - 9, 3, 6);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-car.len / 2, -car.wid / 2 + 3, 3, 6);
    ctx.fillRect(-car.len / 2, car.wid / 2 - 9, 3, 6);
    if (isPolice) {
      // Light bar, alternating red/blue by the clock.
      const flip = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = flip ? '#e74c3c' : '#3498db';
      ctx.fillRect(-6, -car.wid / 2 + 2, 12, 7);
      ctx.fillStyle = flip ? '#3498db' : '#e74c3c';
      ctx.fillRect(-6, car.wid / 2 - 9, 12, 7);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PD', 0, 1);
    }
    if (car.kind === 'player') {
      // Gold outline: this one is yours.
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.strokeRect(-car.len / 2 - 2, -car.wid / 2 - 2, car.len + 4, car.wid + 4);
    }
    ctx.restore();
    // Damage smoke, as square puffs.
    if (car.smoke > 0.15 && Math.random() < car.smoke) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      const sx = car.x - Math.cos(car.angle) * car.len / 2 + (Math.random() - 0.5) * 10;
      const sy = car.y - Math.sin(car.angle) * car.len / 2 + (Math.random() - 0.5) * 10;
      ctx.fillRect(sx - 5, sy - 5, 10 + Math.random() * 6, 10 + Math.random() * 6);
    }
  }

  drawHeli(ctx, heli, isPolice = false) {
    const shadowDx = 14 + heli.alt * 46;
    const shadowDy = 14 + heli.alt * 46;
    // Ground shadow, offset by altitude.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(heli.x - 26 + shadowDx, heli.y - 12 + shadowDy, 52, 24);
    ctx.save();
    ctx.translate(Math.round(heli.x), Math.round(heli.y));
    ctx.rotate(heli.angle);
    if (heli.dead) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-28, -12, 56, 24);
      ctx.restore();
      return;
    }
    // Tail boom + tail fin.
    ctx.fillStyle = isPolice ? '#1c2733' : '#c0392b';
    ctx.fillRect(-52, -4, 30, 8);
    ctx.fillRect(-52, -12, 8, 24);
    // Body: chunky block with a gold stripe.
    ctx.fillStyle = isPolice ? '#1c2733' : '#e84a4a';
    ctx.fillRect(-26, -13, 52, 26);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-26, -2, 52, 4);
    // Cockpit glass.
    ctx.fillStyle = 'rgba(180,220,255,0.9)';
    ctx.fillRect(14, -9, 12, 18);
    // Skids.
    ctx.fillStyle = '#141414';
    ctx.fillRect(-20, -18, 44, 4);
    ctx.fillRect(-20, 14, 44, 4);
    // Rotor: two spinning bars, blurred by speed.
    ctx.save();
    ctx.rotate(heli.rotorPhase);
    ctx.fillStyle = 'rgba(20,20,20,0.75)';
    ctx.fillRect(-46, -2, 92, 4);
    ctx.restore();
    ctx.save();
    ctx.rotate(heli.rotorPhase + Math.PI / 2);
    ctx.fillStyle = 'rgba(20,20,20,0.45)';
    ctx.fillRect(-46, -2, 92, 4);
    ctx.restore();
    if (isPolice) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PD', 0, 1);
    }
    ctx.restore();
  }

  // Chunky person sprite, drawn from rects: legs, body, head, gun.
  // The player is drawn at 1.6x the size of a ped so Leo reads clearly.
  drawFigure(ctx, x, y, angle, bob, shirt, skin, pants, scale, opts = {}) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    const s = scale;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-8 * s, 8 * s, 16 * s, 5 * s);
    // Legs.
    const legSwing = bob ? Math.sin(bob) * 3 * s : 0;
    ctx.fillStyle = pants;
    ctx.fillRect(-5 * s + legSwing * 0.4, 4 * s, 4 * s, 6 * s);
    ctx.fillRect(1 * s - legSwing * 0.4, 4 * s, 4 * s, 6 * s);
    // Body.
    ctx.fillStyle = shirt;
    ctx.fillRect(-8 * s, -6 * s, 16 * s, 12 * s);
    if (opts.stripe) {
      ctx.fillStyle = opts.stripe;
      ctx.fillRect(-2 * s, -6 * s, 4 * s, 12 * s);
    }
    // Head.
    ctx.fillStyle = skin;
    ctx.fillRect(2 * s, -5 * s, 9 * s, 9 * s);
    if (opts.hair) {
      ctx.fillStyle = opts.hair;
      ctx.fillRect(2 * s, -7 * s, 9 * s, 4 * s);
    }
    if (opts.bandana) {
      ctx.fillStyle = opts.bandana;
      ctx.fillRect(0, -6 * s, 12 * s, 3 * s);
    }
    if (opts.cap) {
      ctx.fillStyle = opts.cap;
      ctx.fillRect(0, -7 * s, 12 * s, 4 * s);
      ctx.fillStyle = GOLD;
      ctx.fillRect(4 * s, -1 * s, 4 * s, 3 * s);
    }
    // Gun in hand.
    if (opts.gun) {
      ctx.fillStyle = '#222';
      ctx.fillRect(10 * s, -2 * s, 10 * s, 4 * s);
    }
    ctx.restore();
  }

  drawPed(ctx, p) {
    if (p.dead) {
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      ctx.rotate(p.angle);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-12, -6, 24, 12);
      ctx.fillStyle = p.skin;
      ctx.fillRect(12, -4, 8, 8);
      ctx.restore();
      return;
    }
    this.drawFigure(ctx, p.x, p.y, p.angle, p.walkPhase, p.shirt, p.skin, p.pants, 1);
  }

  drawEnemy(ctx, e) {
    if (e.dead) {
      ctx.save();
      ctx.translate(Math.round(e.x), Math.round(e.y));
      ctx.fillStyle = '#5b2c2c';
      ctx.fillRect(-12, -6, 24, 12);
      ctx.restore();
      return;
    }
    this.drawFigure(ctx, e.x, e.y, e.angle, e.runPhase, '#6b1f1f', '#f1c27d', '#2c2c34', 1, { bandana: '#c0392b', gun: true });
    // Health bar: chunky blocks.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 18, e.y - 26, 36, 6);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 18, e.y - 26, 36 * clamp(e.health / 80, 0, 1), 6);
  }

  drawOfficer(ctx, o) {
    this.drawFigure(ctx, o.x, o.y, o.angle, o.runPhase, '#1c2733', '#f1c27d', '#10161d', 1, { cap: '#10161d' });
  }

  drawPlayer(game, ctx) {
    const p = game.player;
    if (p.inCar || p.inHeli || p.wasted || p.busted) return;
    const bob = p.moving ? p.runPhase : 0;
    this.drawFigure(ctx, p.x, p.y, p.angle, bob, '#0e7c7b', '#e0ac69', '#2c3e50', 1.6,
      { stripe: '#f5f5f5', hair: '#1a1a1a', gun: p.weapon !== 'fists' });
    // Hurt flash.
    if (p.hurtCd > 0.3) {
      ctx.fillStyle = 'rgba(231,76,60,0.35)';
      ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
    }
  }

  drawTracers(game, ctx) {
    for (const t of game.combat.tracers) {
      ctx.strokeStyle = `rgba(255,220,110,${clamp(t.life / 0.12, 0, 1)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.round(t.x1), Math.round(t.y1));
      ctx.lineTo(Math.round(t.x2), Math.round(t.y2));
      ctx.stroke();
    }
  }

  drawParticles(game, ctx) {
    for (const pt of game.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      const s = pt.size * (0.5 + pt.life / pt.maxLife);
      ctx.fillRect(Math.round(pt.x - s / 2), Math.round(pt.y - s / 2), Math.round(s), Math.round(s));
    }
    ctx.globalAlpha = 1;
  }
}
