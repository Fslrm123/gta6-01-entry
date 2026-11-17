// hud.js — everything drawn in screen space: the cash and health panel,
// the wanted stars, the mission objective, the speedometer, the live
// minimap, notification toasts, the big centre banner, and the title,
// pause, busted and wasted screens.
//
// Layout rule that matters: the wanted cluster owns the top centre
// (stars plus label, roughly y 12–74). Toasts stack from y 196 downward
// and the centre banner sits near 40% of the height, so no message ever
// covers the stars or the wanted label. The footer hint is drawn with a
// bottom baseline so its descenders can never clip at 720p.

import { CITY, WORLD_W, WORLD_H, BEACH_Y, LANDMARKS } from './city.js';
import { WANTED_LABELS } from './police.js';
import { clamp, dist } from './utils.js';

const PANEL = 'rgba(10,14,20,0.62)';
const GOLD = '#f1c40f';
const TOAST_TOP = 196;
const TOAST_STEP = 34;

export class HUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game) {
    if (game.state === 'title') return this.drawTitle(game);
    if (game.state === 'paused') return this.drawPause(game);
    if (game.state === 'busted') return this.drawEnd(game, 'BUSTED', 'The Solmarina PD caught up with you.', '#3498db');
    if (game.state === 'wasted') return this.drawEnd(game, 'WASTED', 'Leo got taken out on the streets of Solmarina.', '#e74c3c');
    this.drawStats(game);
    this.drawWanted(game);
    this.drawObjective(game);
    this.drawMinimap(game);
    this.drawSpeed(game);
    this.drawToasts(game);
    this.drawBanner(game);
    this.drawHints(game);
  }

  // --- in-game panels ------------------------------------------------------

  bar(ctx, x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  }

  drawStats(game) {
    const ctx = this.ctx;
    const p = game.player;
    ctx.save();
    ctx.fillStyle = PANEL;
    ctx.beginPath(); ctx.roundRect(14, 14, 250, 92, 10); ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`$${p.cash.toLocaleString()}`, 28, 24);
    this.bar(ctx, 28, 60, 150, 10, p.health / 100, p.health > 30 ? '#2ecc71' : '#e74c3c');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HP', 186, 58);
    this.bar(ctx, 28, 78, 150, 10, p.armor / 100, '#3498db');
    ctx.fillText('ARMOR', 186, 76);
    const ammo = p.weapon === 'fists' ? '—' : `${p.ammo[p.weapon] ?? 0}`;
    ctx.fillStyle = '#f5f5f5';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${p.weaponDef.name}  •  ${ammo}`, 28, 92);
    ctx.restore();
  }

  drawWanted(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const cx = W / 2;
    // Whole stars only, whatever the level's stored shape is.
    const level = Math.floor(game.wanted);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // A dark pill behind the whole cluster so it reads over any street.
    if (level > 0) {
      ctx.fillStyle = 'rgba(10,14,20,0.62)';
      ctx.beginPath(); ctx.roundRect(cx - 118, 10, 236, 66, 10); ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const lit = i < level;
      const throb = lit && level >= 3 ? 1 + Math.sin(game.time * 6 + i) * 0.12 : 1;
      ctx.font = `bold ${Math.round(30 * throb)}px sans-serif`;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      const x = cx + (i - 2) * 38;
      ctx.strokeText('★', x, 16);
      ctx.fillStyle = lit ? GOLD : 'rgba(255,255,255,0.28)';
      ctx.fillText('★', x, 16);
    }
    if (game.wanted > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(WANTED_LABELS[level], cx, 54);
    }
    ctx.restore();
  }

  drawObjective(game) {
    const ctx = this.ctx;
    const m = game.missions.current;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const boxY = 118;
    if (game.missions.active && m) {
      const obj = game.missions.objectivePoint();
      const d = obj ? Math.round(dist(game.player.x, game.player.y, obj.x, obj.y)) : 0;
      ctx.fillStyle = PANEL;
      ctx.beginPath(); ctx.roundRect(14, boxY, 330, 52, 10); ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`MISSION — ${m.name}`, 28, boxY + 10);
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${m.objective}  (${d}m)`, 28, boxY + 30);
      if (m.timed) {
        ctx.fillStyle = game.missions.timer < 20 ? '#e74c3c' : '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`⏱ ${Math.ceil(game.missions.timer)}s`, 330, boxY + 10);
      }
    } else {
      ctx.fillStyle = PANEL;
      ctx.beginPath(); ctx.roundRect(14, boxY, 330, 34, 10); ctx.fill();
      if (game.missions.done) {
        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('★ STORY COMPLETE — free roam', 28, boxY + 10);
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText("Visit Mama Rosa's Diner (♥) for the next job", 28, boxY + 10);
      }
    }
    ctx.restore();
  }

  drawSpeed(game) {
    const ctx = this.ctx;
    const p = game.player;
    if (!p.inCar) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const kmh = Math.round(Math.abs(p.car.speed) * 0.9);
    ctx.save();
    ctx.fillStyle = PANEL;
    ctx.beginPath(); ctx.roundRect(W - 150, H - 66, 136, 52, 10); ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(p.car.type.name.toUpperCase(), W - 136, H - 54);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh} km/h`, W - 28, H - 30);
    if (p.car.health < 55) {
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚠ DAMAGE', W - 136, H - 28);
    }
    ctx.restore();
  }

  drawMinimap(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const mw = 220;
    const mh = 178;
    const x0 = W - mw - 14;
    const y0 = 14;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    const dot = (x, y, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); ctx.fill();
    };
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.beginPath(); ctx.roundRect(x0 - 4, y0 - 4, mw + 8, mh + 8, 10); ctx.fill();
    ctx.beginPath(); ctx.rect(x0, y0, mw, mh); ctx.clip();
    ctx.fillStyle = '#5da244';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(x0, y0 + BEACH_Y * sy, mw, (WORLD_H - BEACH_Y) * sy);
    ctx.fillStyle = '#2e86c1';
    ctx.fillRect(x0, y0 + (WORLD_H - 130) * sy, mw, 130 * sy);
    ctx.fillStyle = '#3d4450';
    for (const rx of CITY.roadsV) ctx.fillRect(x0 + rx * sx - 2, y0, 4, mh);
    for (const ry of CITY.roadsH) ctx.fillRect(x0, y0 + ry * sy - 2, mw, 4);
    ctx.fillStyle = '#2f7d32';
    ctx.fillRect(x0 + 700 * sx, y0 + 1300 * sy, 420 * sx, 420 * sy);
    for (const key of Object.keys(LANDMARKS)) {
      const lm = LANDMARKS[key];
      dot(lm.x, lm.y, 3.5, GOLD);
    }
    const obj = game.missions.objectivePoint();
    if (obj && game.missions.active) {
      const pulse = 5 + Math.sin(game.time * 5) * 1.5;
      dot(obj.x, obj.y, pulse, '#ff5722');
      dot(obj.x, obj.y, 2, '#fff');
    }
    for (const c of game.police.cruisers) dot(c.x, c.y, 3, '#3498db');
    for (const e of game.missions.enemies) {
      if (!e.dead) dot(e.x, e.y, 3, '#e74c3c');
    }
    const p = game.player;
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('N', x0 + mw / 2 - 4, y0 + 4);
    ctx.restore();
  }

  drawToasts(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const colors = { good: '#2ecc71', bad: '#e74c3c', mission: GOLD, info: '#ecf0f1' };
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = TOAST_TOP;
    for (const t of game.toasts) {
      ctx.globalAlpha = clamp(t.life / 0.8, 0, 1);
      ctx.font = 'bold 14px sans-serif';
      const w = ctx.measureText(t.text).width + 28;
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y, w, 28, 8); ctx.fill();
      ctx.fillStyle = colors[t.kind] || '#fff';
      ctx.fillText(t.text, W / 2, y + 15);
      y += TOAST_STEP;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawBanner(game) {
    const ctx = this.ctx;
    if (!game.banner) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const bandY = Math.round(H * 0.4);
    ctx.save();
    ctx.globalAlpha = clamp(game.banner.life / 0.5, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px sans-serif';
    const w = ctx.measureText(game.banner.text).width + 60;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - w / 2, bandY, w, 66);
    ctx.fillStyle = GOLD;
    ctx.fillText(game.banner.text, W / 2, bandY + 34);
    ctx.restore();
  }

  drawHints(game) {
    const ctx = this.ctx;
    const H = this.canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const p = game.player;
    const hint = p.inCar
      ? 'W/S drive • A/D steer • Space handbrake • E get out • M radio • Esc pause'
      : 'WASD move • Shift run • Click / F attack • E enter car • 1 fists • 2 pistol • 3 SMG • Esc pause';
    ctx.fillText(hint, 16, H - 8);
    ctx.restore();
  }

  // --- screens --------------------------------------------------------------

  drawTitle(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#ff9a56');
    sky.addColorStop(0.45, '#ff6b6b');
    sky.addColorStop(0.75, '#8e44ad');
    sky.addColorStop(1, '#2c3e50');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd76e';
    ctx.beginPath(); ctx.arc(W * 0.72, H * 0.3, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,215,110,0.3)';
    ctx.beginPath(); ctx.arc(W * 0.72, H * 0.3, 100, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    const skyline = [120, 200, 150, 260, 180, 300, 170, 230, 280, 190, 150, 240, 200];
    let x = 0;
    for (const h of skyline) {
      ctx.fillRect(x, H - 180 - h * 0.4, 96, 180 + h * 0.4);
      x += 100;
    }
    ctx.fillStyle = '#2e86c1';
    ctx.fillRect(0, H - 60, W, 60);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 84px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.fillText('SOLMARINA', W / 2, 190);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd76e';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('AN OPEN-WORLD CRIME STORY', W / 2, 232);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Steal cars. Outrun the law. Run the city.', W / 2, 268);
    if (Math.floor(game.time * 1.6) % 2 === 0) {
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(game.hasSave ? 'Press ENTER to continue — or N for a new game' : 'Press ENTER to start', W / 2, 360);
    }
    ctx.fillStyle = 'rgba(10,14,20,0.66)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 300, 400, 600, 190, 12); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('HOW TO PLAY', W / 2, 430);
    ctx.font = '15px sans-serif';
    const lines = [
      'WASD / Arrows — move & drive      E — steal / enter a car',
      'Mouse — aim      Click / F — punch & shoot      Shift — sprint',
      'Space — handbrake      1/2/3 — switch weapon      M — radio',
      "Complete Ada's 6 missions to own Solmarina. Save with P.",
    ];
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 462 + i * 26));
    ctx.font = '13px sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('A completely original city. No Rockstar material. Best played with sound on.', W / 2, H - 24);
  }

  drawPause(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('PAUSED', W / 2, 220);
    ctx.font = '18px sans-serif';
    const m = game.missions.current;
    ctx.fillText(m ? `Current mission: ${m.name} — ${m.objective}` : 'Free roam', W / 2, 270);
    ctx.fillText(`Cash $${game.player.cash}   •   Missions ${game.player.missionsDone}/6   •   Kills ${game.player.kills}`, W / 2, 300);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Esc — resume      P — save game      R — restart mission      Q — quit to title', W / 2, 380);
  }

  drawEnd(game, title, sub, color) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(title, W / 2, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(sub, W / 2, 310);
    ctx.font = '18px sans-serif';
    ctx.fillText('The hospital patched you up — but the PD kept $200 of your cash.', W / 2, 350);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press ENTER to get back out there', W / 2, 430);
  }
}
