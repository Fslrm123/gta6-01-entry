// player.js — on-foot movement, damage, respawn. Freshly authored.
import { G, WORLD_W, WORLD_H } from './state.js';
import { clamp, dist } from './utils.js';
import { collideBuildings, isWater, clampWorld } from './city.js';
import { keys } from './input.js';
import { sfx } from './audio.js';

export function spawnPlayer(x, y) {
  G.player.x = x; G.player.y = y; G.player.onFoot = true; G.player.car = null; G.player.heli = null;
}
export function hurtPlayer(dmg) {
  if (G.screen !== 'play') return;
  let left = dmg;
  if (G.armour > 0) { const absorbed = Math.min(G.armour, left); G.armour -= absorbed; left -= absorbed; }
  G.health -= left;
  if (G.health <= 0) {
    G.health = 0; G.screen = 'dead';
    G.banner = { text: 'WASTED', sub: 'You wake up at Solmarina General — $50 hospital bill', t: 240 };
  }
}
export function respawn() {
  G.health = 100; G.armour = 0; G.cash = Math.max(0, G.cash - 50);
  G.wanted = 0; G.policeHeli = null; G.cops = [];
  spawnPlayer(2100, 800); G.screen = 'play';
}
export function updatePlayer() {
  const p = G.player;
  if (!p.onFoot) return;
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    p.sprint = !!(keys['shift']);
    const sp = p.sprint ? 3.4 : 2.3;
    const nx = p.x + dx * sp, ny = p.y + dy * sp;
    if (!collideBuildings(nx, p.y, 8) && !isWater(nx, p.y)) p.x = nx;
    if (!collideBuildings(p.x, ny, 8) && !isWater(p.x, ny)) p.y = ny;
    p.angle = Math.atan2(dy, dx);
    p.moving = true;
    G.stats.distance += sp;
  } else p.moving = false;
  const c = clampWorld(p.x, p.y);
  p.x = c.x; p.y = c.y;
  // pick up stashes
  for (const s of G.stashes) {
    if (!s.taken && dist(p.x, p.y, s.x, s.y) < 18) {
      s.taken = true; G.cash += s.value; G.rep += 2;
      addPopup(p.x, p.y - 14, '+$' + s.value + ' STASH', '#ffc300');
      sfx.pickup(); showMessage('Stash found: +$' + s.value);
    }
  }
}
export function addPopup(x, y, text, color) {
  G.popups.push({ x, y, text, color: color || '#fff', t: 70 });
}
export function showMessage(text) { G.message = text; G.messageT = 200; }
export function showBanner(text, sub) { G.banner = { text, sub: sub || '', t: 220 }; sfx.mission(); }
export function addCash(n, why) {
  G.cash += n;
  addPopup(G.player.x, G.player.y - 16, (n >= 0 ? '+' : '') + '$' + Math.abs(n) + (why ? ' ' + why : ''), n >= 0 ? '#7CFC00' : '#e63946');
  if (n > 0) sfx.cash();
}
