// hud.js — HUD, title screen, pause map, shop, dialogue, portraits. Freshly authored.
import { G } from './state.js';
import { PAL, fmtCash, fmtClock } from './utils.js';
import { DISTRICTS, LANDMARKS, districtAt } from './city.js';
import { wantedStars, policePanel } from './police.js';
import { MISSIONS, CREW, currentMission, percentComplete } from './missions.js';
import { radioTicker } from './audio.js';
import { carName } from './vehicles.js';

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#333'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'left'; ctx.fillText(label, x + 2, y + 1); }
}
function panel(ctx, x, y, w, h, alpha = 0.78) {
  ctx.fillStyle = `rgba(12,6,22,${alpha})`; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}
export function drawHUD(ctx) {
  const p = G.player;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  // top-left: health/armour + cash + clock
  panel(ctx, 4, 4, 150, 46);
  bar(ctx, 8, 8, 78, 7, G.health / 100, '#e63946', 'HP');
  bar(ctx, 8, 18, 78, 7, G.armour / 100, '#3f7cff', 'ARM');
  ctx.fillStyle = '#7CFC00'; ctx.font = 'bold 11px monospace';
  ctx.fillText(fmtCash(G.cash), 8, 28);
  ctx.fillStyle = '#fff'; ctx.font = '7px monospace';
  ctx.fillText('DAY ' + G.day + '  ' + fmtClock(G.clockMin), 92, 8);
  ctx.fillStyle = '#ff9ecf'; ctx.fillText('REP ' + G.rep, 92, 18);
  ctx.fillStyle = '#ffd23f'; ctx.fillText(districtAt(p.x, p.y).name.toUpperCase(), 92, 28);
  // wanted stars top-right
  const stars = wantedStars();
  panel(ctx, 480 - 4 - 92, 4, 92, 20);
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23f' : '#444';
    ctx.fillText('★', 480 - 92 + i * 17, 7);
  }
  if (stars >= 4) { ctx.fillStyle = '#ff5da2'; ctx.font = '7px monospace'; ctx.fillText('AIR-1 ACTIVE', 480 - 92, 15); }
  // mission banner / objective
  const m = currentMission();
  if (m && G.screen === 'play') {
    panel(ctx, 158, 4, 222, 22);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 8px monospace';
    ctx.fillText('MISSION ' + (m.id + 1) + '/10 — ' + m.name.toUpperCase(), 162, 7);
    ctx.fillStyle = '#fff'; ctx.font = '7px monospace';
    ctx.fillText(m.desc.slice(0, 40), 162, 16);
  }
  // police response panel (wanted >= 2)
  if (stars >= 2) {
    const units = policePanel();
    panel(ctx, 480 - 4 - 92, 28, 92, 12 + units.length * 9);
    ctx.fillStyle = '#ff5da2'; ctx.font = 'bold 7px monospace';
    ctx.fillText('PD RESPONSE', 480 - 88, 30);
    ctx.font = '7px monospace'; ctx.fillStyle = '#fff';
    units.forEach((u, i) => ctx.fillText(u.unit + '  ' + u.d + 'm', 480 - 88, 40 + i * 9));
  }
  // radio ticker bottom (static single line, never overlapping)
  ctx.fillStyle = 'rgba(12,6,22,0.7)'; ctx.fillRect(0, 270 - 12, 480, 12);
  ctx.fillStyle = '#ff9ecf'; ctx.font = '7px monospace';
  ctx.fillText(radioTicker().slice(0, 95), 4, 270 - 9);
  // weapon slots bottom-left
  panel(ctx, 4, 270 - 12 - 34, 150, 30);
  G.weapons.forEach((w, i) => {
    const x = 8 + i * 48;
    ctx.fillStyle = G.weapon === i ? '#ff2e88' : '#333';
    ctx.fillRect(x, 270 - 12 - 30, 44, 24);
    ctx.fillStyle = w.owned ? '#fff' : '#666';
    ctx.font = 'bold 7px monospace';
    ctx.fillText((i + 1) + ' ' + w.name, x + 2, 270 - 12 - 27);
    ctx.fillStyle = '#ffd23f'; ctx.font = '7px monospace';
    ctx.fillText(w.ammo === Infinity ? '∞' : 'AMMO ' + w.ammo, x + 2, 270 - 12 - 17);
  });
  // speed / vehicle bottom-right
  if (!p.onFoot) {
    const spd = p.car ? Math.abs(p.car.speed) * 14 : Math.abs(p.heli ? p.heli.speed : 0) * 14;
    panel(ctx, 480 - 4 - 150, 270 - 12 - 46, 150, 42);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
    ctx.fillText(Math.round(spd) + ' MPH', 480 - 146, 270 - 12 - 42);
    ctx.fillStyle = '#ff9ecf'; ctx.font = '8px monospace';
    ctx.fillText((p.car ? p.car.name : 'SEAHAWK') + '  •  ' + Math.round(G.carCondition) + '%', 480 - 146, 270 - 12 - 26);
    bar(ctx, 480 - 146, 270 - 12 - 14, 142, 6, G.nos / 100, '#00e5ff', 'NOS');
  }
  // minimap (circular, bottom-right above speedo or corner)
  drawMinimap(ctx);
  // message + banner
  if (G.messageT > 0) {
    ctx.fillStyle = 'rgba(12,6,22,0.85)'; ctx.fillRect(140, 240, 200, 12);
    ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    ctx.fillText(G.message.slice(0, 60), 240, 243);
    ctx.textAlign = 'left';
  }
  if (G.banner && G.banner.t > 0) {
    ctx.globalAlpha = Math.min(1, G.banner.t / 40);
    ctx.fillStyle = 'rgba(12,6,22,0.85)'; ctx.fillRect(90, 90, 300, 44);
    ctx.strokeStyle = '#ffd23f'; ctx.strokeRect(90.5, 90.5, 300, 44);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
    ctx.fillText(G.banner.text, 240, 96);
    ctx.fillStyle = '#fff'; ctx.font = '9px monospace';
    ctx.fillText(G.banner.sub.slice(0, 60), 240, 118);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}
function drawMinimap(ctx) {
  const cx = 480 - 42, cy = 270 - 12 - 84, r = 34;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
  ctx.fillStyle = '#0e7c86'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  for (const d of DISTRICTS) {
    ctx.globalAlpha = 0.5; ctx.fillStyle = d.color;
    ctx.fillRect(cx - r + (d.x / 2560) * r * 2, cy - r + (d.y / 1920) * r * 2, (d.w / 2560) * r * 2, (d.h / 1920) * r * 2);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#2b2b3d';
  for (const rx of [320, 640, 960, 1280, 1600, 1920, 2240]) ctx.fillRect(cx - r + (rx / 2560) * r * 2 - 1, cy - r, 2, r * 2);
  for (const ry of [320, 640, 960, 1280, 1600]) ctx.fillRect(cx - r, cy - r + (ry / 1920) * r * 2 - 1, r * 2, 2);
  const obj = currentMission();
  if (obj) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(cx - r + (obj.x / 2560) * r * 2, cy - r + (obj.y / 1920) * r * 2, 3, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.arc(cx - r + (G.player.x / 2560) * r * 2, cy - r + (G.player.y / 1920) * r * 2, 3, 0, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
  ctx.fillText(districtAt(G.player.x, G.player.y).name.toUpperCase(), cx, cy + r + 9);
  ctx.textAlign = 'left';
}

export function drawPortrait(ctx, x, y, color, name) {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 34, 38);
  ctx.fillStyle = color; ctx.fillRect(x, y, 32, 36);
  ctx.fillStyle = '#e8b48a'; ctx.beginPath(); ctx.arc(x + 16, y + 16, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(x + 8, y + 4, 16, 6);
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 11, y + 14, 3, 3); ctx.fillRect(x + 19, y + 14, 3, 3);
  ctx.fillStyle = '#7a2a2a'; ctx.fillRect(x + 12, y + 23, 8, 2);
  ctx.fillStyle = '#fff'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
  ctx.fillText(name.split(' ')[0], x + 16, y + 34);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx) {
  // sunset gradient sky
  const grad = ctx.createLinearGradient(0, 0, 0, 270);
  grad.addColorStop(0, '#7b2fbe'); grad.addColorStop(0.45, '#ff5da2'); grad.addColorStop(0.75, '#ff7e5f'); grad.addColorStop(1, '#feb47b');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 480, 270);
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(430, 58, 20, 0, 7); ctx.fill();
  ctx.fillStyle = '#0e7c86'; ctx.fillRect(0, 190, 480, 80);
  ctx.fillStyle = '#f2c98a'; ctx.fillRect(0, 180, 480, 12);
  ctx.fillStyle = '#2b2b3d'; ctx.fillRect(0, 230, 480, 40);
  ctx.fillStyle = '#ffd23f'; for (let x = 0; x < 480; x += 32) ctx.fillRect(x, 248, 14, 2);
  // palms + ferris silhouette
  ctx.fillStyle = '#1a0b2e';
  ctx.fillRect(60, 150, 4, 32); ctx.fillRect(48, 146, 28, 4);
  ctx.beginPath(); ctx.arc(420, 150, 22, 0, 7); ctx.stroke();
  ctx.fillStyle = '#ff2e88'; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center';
  ctx.fillText('SOLMARINA', 240, 52);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace';
  ctx.fillText('— A  P I X E L  C R I M E  S A G A —', 240, 72);
  ctx.fillStyle = '#ffd23f'; ctx.font = '9px monospace';
  ctx.fillText('One fixer. Ten jobs. A city that never sleeps.', 240, 88);
  ctx.textAlign = 'left';
  // crew portraits
  CREW.forEach((c, i) => {
    drawPortrait(ctx, 96 + i * 76, 100, c.color, c.name);
    ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    ctx.fillText(c.role.toUpperCase(), 112 + i * 76, 142);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = 'rgba(12,6,22,0.85)'; ctx.fillRect(60, 152, 360, 66);
  ctx.strokeStyle = '#ff2e88'; ctx.strokeRect(60.5, 152.5, 360, 66);
  ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
  ctx.fillText('WASD move/drive   MOUSE aim   CLICK/F shoot   E enter car/heli/shop', 70, 162);
  ctx.fillText('SPACE handbrake / climb heli   C descend   1/2/3 weapons   B shop', 70, 174);
  ctx.fillText('P save   M radio   L mute   ESC pause & map', 70, 186);
  ctx.fillStyle = '#7CFC00'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  const has = G.missionsDone.length > 0 || G.cash !== 250;
  ctx.fillText(has ? '▶ CONTINUE — ' + G.missionsDone.length + '/10 missions  •  ' + percentComplete() + '%  •  ' + fmtCash(G.cash) : '▶ PRESS ENTER — NEW GAME', 240, 206);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff9ecf'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Original game. No Rockstar / GTA assets. Vanilla JS, offline, pixel art.', 240, 228);
  ctx.textAlign = 'left';
}

export function drawPause(ctx) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(12,6,22,0.92)'; ctx.fillRect(0, 0, 480, 270);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 13px monospace';
  ctx.fillText('SOLMARINA — CITY MAP', 12, 10);
  ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
  ctx.fillText('ESC resume   •   P save   •   Day ' + G.day + '  ' + fmtClock(G.clockMin), 12, 26);
  // map area
  const mx = 12, my = 36, mw = 300, mh = 200;
  ctx.fillStyle = '#0e7c86'; ctx.fillRect(mx, my, mw, mh);
  for (const d of DISTRICTS) {
    ctx.globalAlpha = 0.55; ctx.fillStyle = d.color;
    ctx.fillRect(mx + (d.x / 2560) * mw, my + (d.y / 1920) * mh, (d.w / 2560) * mw, (d.h / 1920) * mh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0c0616'; ctx.font = 'bold 7px monospace';
    ctx.fillText(d.name.toUpperCase(), mx + (d.x / 2560) * mw + 3, my + (d.y / 1920) * mh + 9);
  }
  ctx.fillStyle = '#2b2b3d';
  for (const rx of [320, 640, 960, 1280, 1600, 1920, 2240]) ctx.fillRect(mx + (rx / 2560) * mw - 1, my, 2, mh);
  for (const ry of [320, 640, 960, 1280, 1600]) ctx.fillRect(mx, my + (ry / 1920) * mh - 1, mw, 2);
  // landmark dots
  const marks = [
    [LANDMARKS.safehouse, '#3fae5a', 'SAFEHOUSE'], [LANDMARKS.gunshop, '#e63946', 'GUN SHOP'],
    [LANDMARKS.market, '#ffc300', 'MARKET'], [LANDMARKS.respray, '#ff5da2', 'RESPRAY'],
    [LANDMARKS.garage, '#7b2fbe', 'GARAGE'], [LANDMARKS.helipad, '#00e5ff', 'HELI'],
  ];
  for (const [lm, c] of marks) {
    ctx.fillStyle = c; ctx.fillRect(mx + (lm.x / 2560) * mw - 3, my + (lm.y / 1920) * mh - 3, 6, 6);
  }
  for (const s of G.stashes) {
    if (s.taken) continue;
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(mx + (s.x / 2560) * mw - 2, my + (s.y / 1920) * mh - 2, 4, 4);
  }
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.arc(mx + (G.player.x / 2560) * mw, my + (G.player.y / 1920) * mh, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '7px monospace';
  ctx.fillText('LEGEND: ■ safehouse  ■ gun shop  ■ market  ■ respray  ■ garage  ■ heli  ◆ stash  ● you', 12, 242);
  ctx.fillText('DISTRICTS: Coral Strand · Neon Mile · Miramar Strip · Pelican Marina · Casino Row', 12, 252);
  ctx.fillText('Downtown · Beachfront · East Harbour · Solmarina Hills', 12, 262);
  // right column: missions + stats
  panel(ctx, 322, 36, 146, 200);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 8px monospace';
  ctx.fillText('MISSIONS ' + G.missionsDone.length + '/10', 328, 42);
  ctx.font = '7px monospace';
  MISSIONS.forEach((m, i) => {
    const done = G.missionsDone.includes(m.id);
    const cur = G.missionIndex === i && !done;
    ctx.fillStyle = done ? '#7CFC00' : cur ? '#ffd23f' : '#bbb';
    ctx.fillText((done ? '✓ ' : cur ? '► ' : '· ') + (i + 1) + '. ' + m.name + '  $' + m.payout.toLocaleString('en-US'), 328, 54 + i * 10);
  });
  ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace';
  ctx.fillText('STATS', 328, 164);
  ctx.font = '7px monospace';
  ctx.fillText('Cars stolen: ' + G.stats.carsStolen + '   Cops lost: ' + G.stats.copsLost, 328, 174);
  ctx.fillText('Kills: ' + G.stats.kills + '   Near miss: ' + G.stats.nearMiss, 328, 184);
  ctx.fillText('Cash: ' + fmtCash(G.cash) + '   REP: ' + G.rep, 328, 194);
  ctx.fillText('Garage: ' + G.garage.length + ' cars   Stashes: ' + G.stashes.filter((s) => s.taken).length + '/' + G.stashes.length, 328, 204);
  ctx.fillStyle = '#7CFC00'; ctx.font = 'bold 8px monospace';
  ctx.fillText('SAVE SLOT 1 — ' + percentComplete() + '% COMPLETE', 328, 222);
}

export function drawShop(ctx) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(12,6,22,0.9)'; ctx.fillRect(0, 0, 480, 270);
  panel(ctx, 90, 30, 300, 190);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px monospace';
  ctx.fillText(G.shop.kind === 'gun' ? 'IRONWORKS GUN SHOP' : 'COASTAL MARKET', 100, 40);
  ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
  ctx.fillText('Cash: ' + fmtCash(G.cash) + '    ↑↓ select   ENTER buy   ESC leave', 100, 56);
  G.shop.items.forEach((it, i) => {
    const y = 74 + i * 24;
    ctx.fillStyle = G.shop.sel === i ? '#ff2e88' : '#222';
    ctx.fillRect(100, y, 280, 20);
    ctx.fillStyle = '#fff'; ctx.font = '9px monospace';
    ctx.fillText(it.name, 106, y + 6);
    ctx.fillStyle = '#7CFC00'; ctx.fillText('$' + it.price, 330, y + 6);
  });
  ctx.fillStyle = '#ff9ecf'; ctx.font = '8px monospace';
  ctx.fillText(G.shopMsg, 100, 180);
  ctx.fillText('"No refunds. No questions." — IRONWORKS', 100, 196);
}
export function drawDialogue(ctx) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const d = G.dialogue;
  if (!d) return;
  ctx.fillStyle = 'rgba(12,6,22,0.6)'; ctx.fillRect(0, 0, 480, 270);
  panel(ctx, 40, 138, 340, 86);
  drawPortrait(ctx, 52, 148, d.portrait === 0 ? '#ff5da2' : '#0e7c86', d.speaker);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 10px monospace';
  ctx.fillText(d.speaker, 96, 146);
  ctx.fillStyle = '#fff'; ctx.font = '9px monospace';
  wrapText(ctx, d.text, 96, 162, 272, 12);
  ctx.fillStyle = '#7CFC00'; ctx.font = '8px monospace';
  ctx.fillText('ENTER / E — continue', 96, 214);
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) { ctx.fillText(line, x, yy); line = ''; yy += lh; }
    line += w + ' ';
  }
  ctx.fillText(line, x, yy);
}
export function drawDead(ctx) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(60,0,0,0.85)'; ctx.fillRect(0, 0, 480, 270);
  ctx.fillStyle = '#e63946'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
  ctx.fillText('WASTED', 240, 110);
  ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
  ctx.fillText('You wake up at Solmarina General — $50 hospital bill', 240, 140);
  ctx.fillStyle = '#7CFC00'; ctx.fillText('PRESS ENTER TO RESPAWN', 240, 170);
  ctx.textAlign = 'left';
}
export function drawWin(ctx) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(12,6,22,0.9)'; ctx.fillRect(0, 0, 480, 270);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
  ctx.fillText('GOLDEN ANCHOR — COMPLETE', 240, 80);
  ctx.fillStyle = '#fff'; ctx.font = '11px monospace';
  ctx.fillText('All 10 missions done. Solmarina is yours, kid.', 240, 110);
  ctx.fillText('Final cash: ' + fmtCash(G.cash) + '   REP: ' + G.rep + '   100% COMPLETE', 240, 132);
  ctx.fillStyle = '#7CFC00'; ctx.fillText('PRESS ENTER — FREE ROAM', 240, 160);
  ctx.textAlign = 'left';
}
