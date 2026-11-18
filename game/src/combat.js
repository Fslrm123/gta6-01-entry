// combat.js — punch / shoot, bullets, enemies, weapon switching. Freshly authored.
import { G } from './state.js';
import { dist, rand } from './utils.js';
import { mouse } from './input.js';
import { addPopup } from './player.js';
import { addWanted } from './police.js';
import { sfx } from './audio.js';

export function aimAngle() {
  // mouse is in 480x270 screen space; world aim from player screen pos
  const px = 240, py = 135;
  return Math.atan2(mouse.y - py, mouse.x - px);
}
export function switchWeapon(i) {
  if (G.weapons[i] && G.weapons[i].owned) { G.weapon = i; }
}
export function tryAttack() {
  const p = G.player;
  const w = G.weapons[G.weapon];
  if (!w) return;
  if (G.weapon === 0) {
    sfx.punch();
    const a = p.onFoot ? aimAngle() : p.angle;
    const hx = p.x + Math.cos(a) * 26, hy = p.y + Math.sin(a) * 26;
    for (const e of G.enemies) {
      if (e.hp > 0 && dist(hx, hy, e.x, e.y) < 22) damageEnemy(e, 15);
    }
    for (const ped of G.peds) {
      if (dist(hx, hy, ped.x, ped.y) < 18) { ped.panic = 120; addWanted(0.5, 'assault'); }
    }
    return;
  }
  if (w.ammo <= 0) { sfx.error(); return; }
  w.ammo -= 1; G.stats.shots += 1; sfx.shoot();
  const a = p.onFoot ? aimAngle() : p.angle;
  const spread = G.weapon === 2 ? 0.12 : 0.04;
  G.bullets.push({
    x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16,
    vx: Math.cos(a + rand(-spread, spread)) * 11, vy: Math.sin(a + rand(-spread, spread)) * 11,
    dmg: G.weapon === 2 ? 12 : 25, life: 50, fromPlayer: true,
  });
}
export function damageEnemy(e, dmg) {
  e.hp -= dmg;
  addPopup(e.x, e.y - 16, '-' + dmg, '#ffd23f');
  if (e.hp <= 0) {
    e.dead = true; G.stats.kills += 1;
    addPopup(e.x, e.y - 20, 'DOWN +$25', '#7CFC00');
    G.cash += 25;
    addWanted(0.5, 'shooting');
  }
}
export function spawnEnemy(x, y, hp = 50, label = 'THUG') {
  const e = { x, y, hp, maxHp: hp, label, angle: 0, speed: 0.9, dead: false, shootT: rand(40, 120) };
  G.enemies.push(e);
  return e;
}
export function updateBullets() {
  for (const b of G.bullets) {
    b.x += b.vx; b.y += b.vy; b.life -= 1;
    if (b.fromPlayer) {
      for (const e of G.enemies) {
        if (!e.dead && dist(b.x, b.y, e.x, e.y) < 12) { damageEnemy(e, b.dmg); b.life = 0; break; }
      }
      for (const cop of G.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 14) { b.life = 0; addWanted(1, 'shot at police'); break; }
      }
    } else {
      const p = G.player;
      if (dist(b.x, b.y, p.x, p.y) < 10) {
        b.life = 0;
        if (G.armour > 0) G.armour = Math.max(0, G.armour - b.dmg);
        else G.health = Math.max(0, G.health - b.dmg);
        if (G.health <= 0) { G.screen = 'dead'; }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}
export function updateEnemies() {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 130) { e.x += Math.cos(e.angle) * e.speed; e.y += Math.sin(e.angle) * e.speed; }
    else if (d < 40) { e.x -= Math.cos(e.angle) * e.speed; e.y -= Math.sin(e.angle) * e.speed; }
    e.shootT -= 1;
    if (e.shootT <= 0 && d < 260) {
      e.shootT = rand(70, 140);
      const a = e.angle + rand(-0.1, 0.1);
      G.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, dmg: 6, life: 60, fromPlayer: false });
      sfx.shoot();
    }
  }
  G.enemies = G.enemies.filter((e) => !e.dead || e._keep);
}
