// render.js — draws Solmarina. A sun-soaked top-down city: warm grass and
// sand, asphalt avenues with lane markings, stucco buildings with a fake-3D
// roof offset, palm trees, the pier and the sea. Cars, people and effects
// are drawn in world space; the HUD lives in hud.js.

import { CITY, WORLD_W, WORLD_H, BEACH_Y, ROAD_W } from './city.js';
import { clamp } from './utils.js';

const SEA = '#2e86c1';
const SAND = '#ecd9a0';
const GRASS = '#7fbf5a';
const GRASS_DARK = '#74b04f';
const ASPHALT = '#3d4450';
const SIDEWALK = '#b9b3a4';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game) {
    const ctx = this.ctx;
    const cam = game.camera;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-cam.x + game.shakeX, -cam.y + game.shakeY);

    const vx0 = cam.x - 60, vy0 = cam.y - 60, vx1 = cam.x + W + 60, vy1 = cam.y + H + 60;

    this.drawGround(ctx, vx0, vy0, vx1, vy1);
    this.drawRoads(ctx, vx0, vy0, vx1, vy1);
    this.drawPark(ctx, vx0, vy0, vx1, vy1);
    this.drawBuildings(ctx, vx0, vy0, vx1, vy1);
    this.drawProps(ctx, vx0, vy0, vx1, vy1);
    this.drawPickups(game, ctx);
    this.drawMissionMarkers(game, ctx);
    for (const c of game.traffic.cars) this.drawCar(ctx, c);
    for (const c of game.police.cruisers) this.drawCar(ctx, c, true);
    for (const p of game.crowd.peds) this.drawPed(ctx, p);
    for (const e of game.missions.enemies) this.drawEnemy(ctx, e);
    for (const o of game.police.officers) this.drawOfficer(ctx, o);
    this.drawPlayer(game, ctx);
    this.drawTracers(game, ctx);
    this.drawParticles(game, ctx);
    ctx.restore();
  }

  drawGround(ctx, x0, y0, x1, y1) {
    // Grass base.
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
        // Wave lines.
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const wy = seaY + 18 + i * 34;
          if (wy < y0 || wy > y1) continue;
          ctx.beginPath();
          for (let x = x0; x < x1; x += 60) {
            const yy = wy + Math.sin(x / 90 + i * 2) * 5;
            if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }
    }
  }

  drawRoads(ctx, x0, y0, x1, y1) {
    // Asphalt slabs.
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
    // Palmera Park: darker lawn, a pond and a path.
    const px0 = 700, py0 = 1300, px1 = 1120, py1 = 1720;
    if (px1 < x0 || px0 > x1 || py1 < y0 || py0 > y1) return;
    ctx.fillStyle = '#5da244';
    ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
    ctx.fillStyle = '#4a90d9';
    ctx.beginPath();
    ctx.ellipse(910, 1520, 90, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d9c9a8';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(px0, py0 + 210);
    ctx.lineTo(px1, py0 + 210);
    ctx.stroke();
  }

  drawBuildings(ctx, x0, y0, x1, y1) {
    for (const b of CITY.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      const h = b.height;
      // Fake-3D: wall face offset down-right, then the roof on top.
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
      // Roof details: vents / pool / garden.
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (b.kind === 'tower') {
        ctx.fillStyle = '#7fb3d5';
        ctx.fillRect(cx - 26, cy - 14, 52, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(cx - 26, cy - 14, 52, 8);
      } else if (b.kind === 'shop') {
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(b.x + 10, b.y + 10, 34, 18);
      } else {
        ctx.fillRect(cx - 12, cy - 12, 24, 24);
      }
      // Windows on the wall face.
      ctx.fillStyle = 'rgba(20,30,45,0.75)';
      const cols = Math.max(2, Math.floor(b.w / 42));
      for (let i = 0; i < cols; i++) {
        ctx.fillRect(b.x + 12 + i * ((b.w - 24) / cols), b.y + b.h + h * 0.5 - 12, 16, 9);
      }
    }
  }

  drawProps(ctx, x0, y0, x1, y1) {
    for (const p of CITY.props) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      if (p.kind === 'lamp') {
        ctx.fillStyle = '#2c2c34';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        ctx.fillStyle = 'rgba(255,240,180,0.85)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'hydrant') {
        ctx.fillStyle = '#d43d2a';
        ctx.fillRect(p.x - 4, p.y - 5, 8, 10);
      } else if (p.kind === 'umbrella') {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath(); ctx.arc(p.x, p.y, 16, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8d5524';
        ctx.fillRect(p.x - 2, p.y, 4, 10);
      } else if (p.kind === 'crate') {
        ctx.fillStyle = '#a8763e';
        const s = 26 * (p.s || 1);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        ctx.strokeStyle = '#7d5a2e';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    // Palm trees.
    for (const t of CITY.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      const s = t.s;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, 12 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a6d3b';
      ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 8 * s); ctx.lineTo(t.x, t.y - 6 * s); ctx.stroke();
      ctx.fillStyle = '#2f9e44';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(t.x + Math.cos(a) * 12 * s, t.y - 8 * s + Math.sin(a) * 7 * s, 11 * s, 4.5 * s, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPickups(game, ctx) {
    for (const p of game.combat.pickups) {
      const bob = Math.sin(p.bob) * 3;
      const colors = { health: '#e74c3c', armor: '#3498db', pistol: '#f1c40f', smg: '#f39c12' };
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colors[p.kind] || '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'health' ? '+' : p.kind === 'armor' ? 'A' : '◈', p.x, p.y + bob + 1);
      // Glow ring so pickups read at a glance.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 18 + Math.sin(p.bob * 2) * 2, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawMissionMarkers(game, ctx) {
    const obj = game.missions.objectivePoint();
    if (!obj || game.state !== 'playing') return;
    const pulse = 1 + Math.sin(game.time * 4) * 0.12;
    // Ground marker.
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(obj.x, obj.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(241,196,15,0.25)';
    ctx.beginPath(); ctx.arc(obj.x, obj.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    // Floating diamond.
    const dy = Math.sin(game.time * 3) * 8;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(obj.x, obj.y - 58 + dy);
    ctx.lineTo(obj.x + 12, obj.y - 42 + dy);
    ctx.lineTo(obj.x, obj.y - 26 + dy);
    ctx.lineTo(obj.x - 12, obj.y - 42 + dy);
    ctx.closePath(); ctx.fill();
    // Cash-run drops.
    for (const d of game.missions.drops) {
      if (d.taken) continue;
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(d.x, d.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', d.x, d.y + 1);
    }
  }

  drawCar(ctx, car, isPolice = false) {
    if (car.dead) {
      // Wreck: charred shell.
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 8); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.roundRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid, 9); ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath(); ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 9); ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = '#20262e';
    ctx.beginPath(); ctx.roundRect(-car.len * 0.18, -car.wid / 2 + 4, car.len * 0.32, car.wid - 8, 5); ctx.fill();
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
      // Light bar.
      ctx.fillStyle = Math.floor(performance.now() / 180) % 2 ? '#e74c3c' : '#3498db';
      ctx.fillRect(-6, -car.wid / 2 + 2, 12, 7);
      ctx.fillStyle = Math.floor(performance.now() / 180) % 2 ? '#3498db' : '#e74c3c';
      ctx.fillRect(-6, car.wid / 2 - 9, 12, 7);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    if (car.kind === 'player') {
      // Outline the player's car so it reads as "yours".
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-car.len / 2 - 2, -car.wid / 2 - 2, car.len + 4, car.wid + 4, 10); ctx.stroke();
    }
    ctx.restore();
    // Damage smoke.
    if (car.smoke > 0.15 && Math.random() < car.smoke) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * car.len / 2 + (Math.random() - 0.5) * 10,
        car.y - Math.sin(car.angle) * car.len / 2 + (Math.random() - 0.5) * 10, 6 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPed(ctx, p) {
    if (p.dead) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(15, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Legs (two dots that alternate with the walk).
    ctx.fillStyle = p.pants;
    const legSwing = Math.sin(p.walkPhase) * 4;
    ctx.beginPath(); ctx.arc(-3 + legSwing * 0.4, 4, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3 - legSwing * 0.4, 4, 3.4, 0, Math.PI * 2); ctx.fill();
    // Body.
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, bob * 0.4, 8, 0, Math.PI * 2); ctx.fill();
    // Head.
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2 + bob * 0.4 - 1, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawEnemy(ctx, e) {
    if (e.dead) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = '#5b2c2c';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(e.runPhase) * 2;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b1f1f';
    ctx.beginPath(); ctx.arc(0, bob * 0.4, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(Math.cos(e.angle) * 2, Math.sin(e.angle) * 2 - 1, 5.5, 0, Math.PI * 2); ctx.fill();
    // Bandana.
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-5, -7, 10, 3);
    // Gun.
    ctx.fillStyle = '#222';
    ctx.fillRect(Math.cos(e.angle) * 10 - 2, Math.sin(e.angle) * 10 - 2, 8, 4);
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-16, -22, 32, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-16, -22, 32 * clamp(e.health / 80, 0, 1), 5);
    ctx.restore();
  }

  drawOfficer(ctx, o) {
    const bob = Math.sin(o.runPhase) * 2;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.arc(0, bob * 0.4, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(Math.cos(o.angle) * 2, Math.sin(o.angle) * 2 - 1, 5.5, 0, Math.PI * 2); ctx.fill();
    // Cap + badge.
    ctx.fillStyle = '#10161d';
    ctx.beginPath(); ctx.arc(0, -2, 5.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-2, -1, 4, 3);
    ctx.restore();
  }

  drawPlayer(game, ctx) {
    const p = game.player;
    if (p.inCar || p.wasted || p.busted) return;
    const bob = p.moving ? Math.sin(p.runPhase) * 2 : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 7, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Legs.
    const legSwing = p.moving ? Math.sin(p.runPhase) * 4 : 0;
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(-3 + legSwing * 0.4, 4, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3 - legSwing * 0.4, 4, 3.6, 0, Math.PI * 2); ctx.fill();
    // Jacket (teal — Leo's signature).
    ctx.fillStyle = '#0e7c7b';
    ctx.beginPath(); ctx.arc(0, bob * 0.4, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-2, bob * 0.4 - 8, 4, 12);
    // Head + hair.
    ctx.fillStyle = '#e0ac69';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2 + bob * 0.4 - 1, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 2 - 1, Math.sin(p.angle) * 2 + bob * 0.4 - 3, 6, Math.PI, Math.PI * 2); ctx.fill();
    // Weapon in hand.
    if (p.weapon !== 'fists') {
      ctx.fillStyle = '#222';
      ctx.fillRect(Math.cos(p.angle) * 11 - 3, Math.sin(p.angle) * 11 - 2, 10, 4);
    }
    // Hurt flash.
    if (p.hurtCd > 0.3) {
      ctx.fillStyle = 'rgba(231,76,60,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawTracers(game, ctx) {
    for (const t of game.combat.tracers) {
      ctx.strokeStyle = `rgba(255,220,110,${clamp(t.life / 0.12, 0, 1)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
  }

  drawParticles(game, ctx) {
    for (const pt of game.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.5 + pt.life / pt.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
