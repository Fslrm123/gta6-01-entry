// hud.js — every interface panel drawn into the 480x270 pixel buffer, so
// the whole HUD is chunky pixel art too: flat panels, hard edges, monospace
// type, no rounded corners. Layout is tuned for the small buffer:
// stats top-left, wanted top-center, minimap top-right, speed bottom-right,
// objective under the stats, hints along the bottom edge.

import { CITY, WORLD_W, WORLD_H, LANDMARKS } from './city.js';
import { SHOP_DEFS } from './shops.js';
import { clamp, dist, fmtTime } from './utils.js';

const BW = 480;
const BH = 270;

export class HUD {
  constructor(bufferCanvas) {
    this.canvas = bufferCanvas;
    this.ctx = bufferCanvas.getContext('2d');
    this.blink = 0;
  }

  draw(game) {
    const p = game.player;
    this.blink += 1 / 60;
    if (game.state === 'title') { this.drawTitle(game); return; }
    this.drawStats(game, p);
    this.drawWanted(game);
    this.drawObjective(game);
    this.drawMinimap(game);
    this.drawSpeed(game, p);
    this.drawToasts(game);
    this.drawHeliHud(game, p);
    if (game.shops.isOpen) this.drawShop(game);
    else if (game.shopPrompt) this.drawShopPrompt(game);
    if (game.banner) this.drawBanner(game);
    this.drawHints(game, p);
    if (game.state === 'paused') this.drawPaused(game);
    if (game.state === 'gameover') this.drawGameOver(game);
  }

  panel(x, y, w, h, fill = 'rgba(12,16,22,0.78)', stroke = 'rgba(255,255,255,0.25)') {
    const ctx = this.ctx;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  text(str, x, y, size, color, align = 'left', weight = 'bold') {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px "Courier New", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(str, x, y);
  }

  drawStats(game, p) {
    this.panel(8, 8, 152, 56);
    this.text(`$${p.cash.toLocaleString('en-US')}`, 16, 14, 15, '#f1c40f');
    // Health bar.
    this.text('HP', 16, 34, 9, '#fff');
    this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
    this.ctx.fillRect(36, 35, 56, 7);
    this.ctx.fillStyle = p.health > 30 ? '#2ecc71' : '#e74c3c';
    this.ctx.fillRect(36, 35, 56 * clamp(p.health / 100, 0, 1), 7);
    // Armor bar.
    this.text('AR', 16, 46, 9, '#fff');
    this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
    this.ctx.fillRect(36, 47, 56, 7);
    this.ctx.fillStyle = '#3498db';
    this.ctx.fillRect(36, 47, 56 * clamp(p.armor / 100, 0, 1), 7);
    const ammo = p.weapon === 'fists' ? '—' : `${p.ammo[p.weapon] ?? 0}`;
    this.text(p.weaponDef.name, 100, 34, 9, '#fff');
    this.text(ammo, 100, 46, 9, '#f1c40f');
  }

  drawWanted(game) {
    const w = 150;
    const x = (BW - w) / 2;
    this.panel(x, 8, w, 40);
    // Five diamond "stars", filled gold up to the wanted level, with the
    // label underneath so it never collides with the diamonds.
    for (let i = 0; i < 5; i++) {
      const cx = x + 22 + i * 24;
      const cy = 21;
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(Math.PI / 4);
      this.ctx.fillStyle = i < game.wanted ? '#f1c40f' : 'rgba(255,255,255,0.18)';
      this.ctx.fillRect(-7, -7, 14, 14);
      this.ctx.restore();
    }
    this.text('WANTED', x + w / 2, 34, 7, '#fff', 'center');
  }

  drawObjective(game) {
    const m = game.missions.current;
    const obj = game.missions.objectivePoint();
    if (!m || !game.missions.active) {
      this.panel(8, 72, 200, 30);
      this.text(game.missions.done ? 'STORY COMPLETE — FREE ROAM' : 'NO ACTIVE MISSION', 14, 78, 9, '#f1c40f');
      this.text(game.missions.done ? 'Explore Solmarina.' : 'Press E at the diner to start.', 14, 90, 8, '#fff');
      return;
    }
    const timer = m.timed ? `  ${fmtTime(game.missions.timer)}` : '';
    const d = obj ? Math.round(dist(game.player.x, game.player.y, obj.x, obj.y)) : 0;
    this.panel(8, 72, 200, 30);
    this.text(`${game.missions.index + 1}/10 ${m.name.toUpperCase()}${timer}`, 14, 76, 9, '#f1c40f');
    const label = obj ? `${m.objective} (${d}m)` : m.objective;
    this.text(label.length > 36 ? label.slice(0, 36) + '…' : label, 14, 89, 8, '#fff');
  }

  drawMinimap(game) {
    const mx = 362, my = 8, mw = 110, mh = 89;
    this.panel(mx, my, mw, mh);
    const ctx = this.ctx;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    const px = (x) => mx + x * sx;
    const py = (y) => my + y * sy;
    // Sea band.
    ctx.fillStyle = '#2f7fc1';
    ctx.fillRect(mx, py(4070), mw, mh - (py(4070) - my));
    // Roads.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const rx of CITY.roadsV) ctx.fillRect(px(rx), my, 1, mh);
    for (const ry of CITY.roadsH) ctx.fillRect(mx, py(ry), mw, 1);
    // Helipad.
    ctx.fillStyle = '#7ff0ff';
    ctx.fillRect(px(LANDMARKS.helipad.x) - 2, py(LANDMARKS.helipad.y) - 2, 4, 4);
    // Shops.
    ctx.fillStyle = '#2ecc71';
    for (const s of SHOP_DEFS) ctx.fillRect(px(s.x) - 2, py(s.y) - 2, 4, 4);
    // Safehouse.
    ctx.fillStyle = '#fff';
    ctx.fillRect(px(LANDMARKS.safehouse.x) - 2, py(LANDMARKS.safehouse.y) - 2, 4, 4);
    // Objective marker (blinking gold).
    const obj = game.missions.objectivePoint();
    if (obj && game.missions.active && Math.sin(this.blink * 6) > -0.2) {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(px(obj.x) - 3, py(obj.y) - 3, 6, 6);
    }
    // Enemies and police.
    ctx.fillStyle = '#e74c3c';
    for (const e of game.missions.enemies) if (!e.dead) ctx.fillRect(px(e.x) - 1, py(e.y) - 1, 3, 3);
    ctx.fillStyle = '#3498db';
    for (const c of game.police.cruisers) ctx.fillRect(px(c.x) - 1, py(c.y) - 1, 3, 3);
    // Player.
    ctx.fillStyle = '#fff';
    ctx.fillRect(px(game.player.x) - 2, py(game.player.y) - 2, 4, 4);
    this.text('SOLMARINA', mx + mw / 2, my + mh + 3, 7, 'rgba(255,255,255,0.7)', 'center');
  }

  drawSpeed(game, p) {
    if (!p.inCar && !p.inHeli) return;
    const speed = p.inCar ? Math.abs(p.car.speed) : Math.abs(p.heli.speed);
    const kmh = Math.round(speed * 0.9);
    this.panel(404, 234, 68, 28);
    this.text(`${kmh}`, 412, 238, 14, '#fff');
    this.text('KM/H', 448, 240, 7, '#f1c40f');
  }

  drawHeliHud(game, p) {
    if (!p.inHeli || !p.heli) return;
    // Altitude meter, left edge.
    this.panel(8, 120, 16, 100);
    this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
    this.ctx.fillRect(11, 124, 10, 92);
    this.ctx.fillStyle = '#7ff0ff';
    const h = 92 * clamp(p.heli.alt, 0, 1);
    this.ctx.fillRect(11, 124 + 92 - h, 10, h);
    this.text('ALT', 8, 222, 7, '#fff');
  }

  drawToasts(game) {
    const ctx = this.ctx;
    ctx.font = 'bold 9px "Courier New", monospace';
    game.toasts.forEach((t, i) => {
      const y = 112 + i * 18;
      ctx.globalAlpha = clamp(t.life / 1, 0, 1);
      const label = t.text.length > 44 ? t.text.slice(0, 44) + '…' : t.text;
      const w = ctx.measureText(label).width + 12;
      this.panel((BW - w) / 2, y, w, 15, t.kind === 'bad' ? 'rgba(120,20,20,0.85)' : t.kind === 'good' ? 'rgba(20,90,40,0.85)' : 'rgba(12,16,22,0.85)');
      this.text(label, BW / 2, y + 3, 9, '#fff', 'center');
      ctx.globalAlpha = 1;
    });
  }

  drawBanner(game) {
    const ctx = this.ctx;
    ctx.globalAlpha = clamp(game.banner.life, 0, 1);
    const w = 380;
    this.panel((BW - w) / 2, 100, w, 40, 'rgba(12,16,22,0.9)', '#f1c40f');
    this.text(game.banner.text, BW / 2, 112, 16, '#f1c40f', 'center');
    ctx.globalAlpha = 1;
  }

  drawHints(game, p) {
    if (game.state !== 'playing') return;
    // Two short lines — one long line overflows the 480-wide buffer.
    const line1 = p.inHeli
      ? 'W/S thrust · A/D steer · SPACE up · C down · E exit'
      : p.inCar
        ? 'W/S drive · A/D steer · SPACE handbrake · E exit'
        : 'WASD walk · E enter car/heli · CLICK shoot · 1/2/3 weapon';
    this.text(line1, BW / 2, BH - 20, 8, 'rgba(255,255,255,0.75)', 'center');
    this.text('B shop · M radio · L mute · P save · Esc pause', BW / 2, BH - 11, 8, 'rgba(255,255,255,0.75)', 'center');
  }

  drawShop(game) {
    const ctx = this.ctx;
    const def = game.shops.openShop;
    const items = def.items;
    const x = 80, y = 40, w = 320, h = 190;
    this.panel(x, y, w, h, 'rgba(10,14,18,0.94)', '#f1c40f');
    this.text(def.name.toUpperCase(), x + w / 2, y + 10, 14, '#f1c40f', 'center');
    this.text(`CASH $${game.player.cash.toLocaleString('en-US')} — 1-6 buy · B/Esc close`, x + w / 2, y + 28, 8, '#fff', 'center');
    items.forEach((item, i) => {
      const iy = y + 50 + i * 20;
      const afford = game.player.cash >= item.price;
      if (i === game.shops.selected) {
        ctx.fillStyle = 'rgba(241,196,15,0.2)';
        ctx.fillRect(x + 8, iy - 2, w - 16, 18);
      }
      this.text(`${i + 1}. ${item.name}`, x + 14, iy, 10, afford ? '#fff' : '#888');
      const desc = item.desc.length > 20 ? item.desc.slice(0, 20) + '…' : item.desc;
      this.text(desc, x + 150, iy + 1, 8, 'rgba(255,255,255,0.7)');
      this.text(`$${item.price}`, x + w - 16, iy, 10, afford ? '#2ecc71' : '#e74c3c', 'right');
    });
    this.text('Arrow keys to choose, Enter to buy.', x + w / 2, y + h - 16, 8, 'rgba(255,255,255,0.7)', 'center');
  }

  drawShopPrompt(game) {
    const s = game.shopPrompt;
    this.panel(150, 200, 180, 24);
    this.text(`Press B — ${s.short}`, 240, 206, 10, '#2ecc71', 'center');
  }

  drawTitle(game) {
    const ctx = this.ctx;
    // Sun-soaked sky in flat pixel bands.
    const bands = ['#ffd76e', '#ffb347', '#ff8c5a', '#e76f51'];
    bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * 40, BW, 40); });
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(330, 20, 70, 70);
    // Sea + beach + skyline blocks.
    ctx.fillStyle = '#2f7fc1';
    ctx.fillRect(0, 160, BW, 60);
    ctx.fillStyle = '#e8d39a';
    ctx.fillRect(0, 220, BW, 50);
    ctx.fillStyle = '#3a3f4a';
    for (let i = 0; i < 8; i++) {
      const bw = 34 + (i * 17) % 30;
      ctx.fillRect(10 + i * 58, 160 - 30 - (i % 3) * 18, bw, 30 + (i % 3) * 18);
    }
    // Title.
    this.text('SOLMARINA', BW / 2, 30, 42, '#1a2a3a', 'center');
    this.text('SOLMARINA', BW / 2, 28, 42, '#fff', 'center');
    this.text('PIXEL CRIME IN THE SUN', BW / 2, 74, 11, '#1a2a3a', 'center');
    // How to play panel.
    this.panel(70, 100, 340, 108, 'rgba(12,16,22,0.85)');
    const lines = [
      'WASD move / drive · Mouse aim · Click shoot',
      'E enter car, steal cars & the HELICOPTER',
      'B shops: guns, ammo, armor, health',
      'E at the diner starts Ada\'s next mission — 10 missions',
      'Ada Kline runs the jobs. Do not cross the PD.',
    ];
    lines.forEach((l, i) => this.text(l, 240, 108 + i * 15, 9, '#fff', 'center'));
    this.text('ENTER to start', BW / 2, 220, 14, Math.sin(this.blink * 4) > 0 ? '#fff' : '#f1c40f', 'center');
    this.text('A tiny pixel-art open world. No Rockstar. No GTA.', BW / 2, 244, 8, 'rgba(255,255,255,0.85)', 'center');
  }

  drawPaused(game) {
    this.panel(140, 90, 200, 90, 'rgba(12,16,22,0.92)', '#f1c40f');
    this.text('PAUSED', 240, 102, 18, '#f1c40f', 'center');
    this.text('P resume · L mute · M music', 240, 132, 9, '#fff', 'center');
    this.text('R restart mission · Q quit to title', 240, 148, 9, '#fff', 'center');
  }

  drawGameOver(game) {
    const over = game.overText;
    this.panel(90, 80, 300, 110, 'rgba(12,16,22,0.94)', '#e74c3c');
    this.text(over.title, 240, 94, 20, '#e74c3c', 'center');
    this.text(over.sub, 240, 122, 10, '#fff', 'center');
    this.text(`Missions done: ${game.player.missionsDone}/10 · Cash $${game.player.cash.toLocaleString('en-US')}`, 240, 142, 9, '#fff', 'center');
    this.text('Press ENTER to try again', 240, 164, 11, '#f1c40f', 'center');
  }
}
