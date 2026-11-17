// combat.js — shooting, punching, explosions and pickups. Bullets are
// hitscan with a tracer line and a muzzle flash; cars and helicopters
// explode when their health hits zero; health, armor and weapon pickups
// sit around the city. Ground fire cannot reach a helicopter flying high.

import { dist, clamp } from './utils.js';
import { WORLD_W, WORLD_H, BEACH_Y } from './city.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.tracers = []; // {x1,y1,x2,y2,life}
    this.pickups = [];
    this.spawnPickups();
  }

  spawnPickups() {
    const spots = [
      { kind: 'health', x: 1300, y: 980 }, // hospital
      { kind: 'health', x: 2100, y: 1980 }, // diner
      { kind: 'armor', x: 3500, y: 2980 }, // gun shop
      { kind: 'pistol', x: 3550, y: 2940 },
      { kind: 'smg', x: 4780, y: 2700 }, // harbour
      { kind: 'health', x: 900, y: 1560 }, // park
      { kind: 'armor', x: 2600, y: 3940 }, // pier
      { kind: 'pistol', x: 700, y: 3360 }, // safehouse
      { kind: 'health', x: 1700, y: 1160 }, // coastal market
      { kind: 'armor', x: 4620, y: 2340 }, // helipad
    ];
    for (const s of spots) this.pickups.push({ ...s, bob: Math.random() * 6 });
  }

  // The player's attack: fists hit what's close, guns hitscan to the aim.
  playerAttack(player) {
    const game = this.game;
    const w = player.weaponDef;
    const aimX = player.x + Math.cos(player.angle) * w.range;
    const aimY = player.y + Math.sin(player.angle) * w.range;
    game.sound.gunshot?.();
    if (player.weapon === 'fists') {
      game.sound.punch();
      // Hit the nearest ped / officer / enemy in front of the player.
      const hit = this.nearestTarget(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30, 46);
      if (hit) this.damageTarget(hit, w.damage, player);
      return;
    }
    // Gun: hitscan along the aim line; the nearest thing in the cone takes it.
    const end = { x: aimX, y: aimY };
    const hit = this.raycast(player.x, player.y, player.angle, w.range);
    if (hit) {
      end.x = hit.x; end.y = hit.y;
      this.damageTarget(hit.target, w.damage, player);
    }
    this.tracers.push({ x1: player.x, y1: player.y, x2: end.x, y2: end.y, life: 0.12 });
    game.addParticles(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, 4, '#ffd76e');
    game.crowd.scareAll(player.x, player.y, 500);
    game.police.addWanted(game, 0.4, 'Shots fired');
  }

  // Find the closest hittable thing along a ray (peds, officers, enemies,
  // cars, helicopters). A helicopter at cruising altitude is out of reach
  // of ground fire, so its cone check is skipped when it flies high.
  raycast(x, y, angle, range) {
    let best = null; let bd = range;
    const consider = (tx, ty, target) => {
      const dx = tx - x; const dy = ty - y;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      if (along < 0 || along > bd) return;
      const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
      if (perp < 26) { bd = along; best = { x: tx, y: ty, target }; }
    };
    for (const p of this.game.crowd.peds) if (!p.dead) consider(p.x, p.y, { kind: 'ped', ref: p });
    for (const o of this.game.police.officers) consider(o.x, o.y, { kind: 'officer', ref: o });
    for (const e of this.game.missions.enemies) if (!e.dead) consider(e.x, e.y, { kind: 'enemy', ref: e });
    for (const c of this.game.traffic.cars) {
      if (c.dead || c.kind === 'player') continue;
      consider(c.x, c.y, { kind: 'car', ref: c });
    }
    for (const c of this.game.police.cruisers) if (!c.dead) consider(c.x, c.y, { kind: 'car', ref: c });
    for (const h of this.game.helis) {
      if (h.dead || h.kind === 'player') continue;
      if (h.alt > 0.4) continue; // too high for a street gun
      consider(h.x, h.y, { kind: 'heli', ref: h });
    }
    for (const h of this.game.police.helis) {
      if (h.dead || h.alt > 0.4) continue;
      consider(h.x, h.y, { kind: 'heli', ref: h });
    }
    return best;
  }

  nearestTarget(x, y, range) {
    let best = null; let bd = range;
    const consider = (tx, ty, target) => {
      const d = dist(x, y, tx, ty);
      if (d < bd) { bd = d; best = target; }
    };
    for (const p of this.game.crowd.peds) if (!p.dead) consider(p.x, p.y, { kind: 'ped', ref: p });
    for (const o of this.game.police.officers) consider(o.x, o.y, { kind: 'officer', ref: o });
    for (const e of this.game.missions.enemies) if (!e.dead) consider(e.x, e.y, { kind: 'enemy', ref: e });
    return best;
  }

  damageTarget(target, dmg, player) {
    const game = this.game;
    if (target.kind === 'ped') {
      const p = target.ref;
      p.health -= dmg;
      if (p.health <= 0) {
        p.dead = true;
        player.kills++;
        game.addCash(p.cash, `Took $${p.cash} from ${p.name}`);
        game.police.addWanted(game, 1, 'Assault on a civilian');
      } else {
        p.scareFrom(player.x, player.y);
      }
    } else if (target.kind === 'officer') {
      const o = target.ref;
      o.health -= dmg;
      if (o.health <= 0) {
        game.police.addWanted(game, 1, 'Officer down');
        player.kills++;
      }
    } else if (target.kind === 'enemy') {
      const e = target.ref;
      e.health -= dmg;
      if (e.health <= 0) {
        e.dead = true;
        player.kills++;
        game.missions.onEnemyDown(e);
      }
    } else if (target.kind === 'car') {
      const c = target.ref;
      c.health -= dmg;
      game.addParticles(c.x, c.y, 6, '#ff9a3c');
      if (c.health <= 0 && !c.dead) {
        c.dead = true;
        game.explode(c.x, c.y);
        game.police.addWanted(game, 1, 'Vehicle destroyed');
      }
    } else if (target.kind === 'heli') {
      const h = target.ref;
      const dead = h.damage(dmg);
      game.addParticles(h.x, h.y, 6, '#ff9a3c');
      if (dead) {
        game.explode(h.x, h.y);
        game.police.addWanted(game, 1, 'Helicopter down');
      }
    }
  }

  // Explode at a point: particles, shake, sound, splash damage.
  explodeAt(x, y) {
    const game = this.game;
    game.addParticles(x, y, 42, '#ff7a1a');
    game.addParticles(x, y, 26, '#3a3a3a');
    game.addParticles(x, y, 16, '#ffd76e');
    game.addShake(10);
    game.sound.explosion();
    game.crowd.scareAll(x, y, 700);
    const player = game.player;
    const d = dist(x, y, player.x, player.y);
    if (d < 130 && !player.inCar && !player.inHeli) player.damage(45);
    if (d < 130 && player.inCar) player.car.health -= 40;
    if (d < 130 && player.inHeli) player.heli.health -= 40;
    for (const c of game.traffic.cars) {
      if (!c.dead && dist(x, y, c.x, c.y) < 110) { c.health -= 60; if (c.health <= 0) c.dead = true; }
    }
  }

  update(dt) {
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    // Pickup collection.
    const player = this.game.player;
    for (const p of this.pickups) {
      p.bob += dt * 3;
      if (player.inCar || player.inHeli) continue;
      if (dist(player.x, player.y, p.x, p.y) < 44) {
        if (p.kind === 'health') { player.heal(50); this.game.notify('Health +50', 'good'); }
        if (p.kind === 'armor') { player.armor = clamp(player.armor + 50, 0, 100); this.game.notify('Armor +50', 'good'); }
        if (p.kind === 'pistol') { player.giveWeapon('pistol', 60); this.game.notify('Picked up a Pistol', 'good'); }
        if (p.kind === 'smg') { player.giveWeapon('smg', 120); this.game.notify('Picked up a Street SMG', 'good'); }
        this.game.sound.pickup();
        p.taken = true;
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }
}
