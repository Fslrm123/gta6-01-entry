// police.js — the Solmarina PD and the wanted system. Crimes raise the
// wanted level (1–5 stars); cruisers chase and ram, officers on foot chase
// and punch. Lose the heat by staying out of sight, hiding, or paying for a
// respray at the Sunset Spray Shop. At 5 stars the whole city is after you.

import { clamp, dist, turnToward, mulberry32 } from './utils.js';
import { Car, CAR_TYPES } from './vehicles.js';
import { WORLD_W, WORLD_H, BEACH_Y, randomRoadPoint } from './city.js';

export const WANTED_LABELS = [
  'Clean', 'Petty theft', 'Grand theft', 'Assault', 'Armed & dangerous', 'Citywide manhunt',
];

export class Police {
  constructor() {
    this.cruisers = [];
    this.officers = [];
    this.rng = mulberry32(99);
    this.calmTimer = 0; // seconds without a crime
    this.bustProgress = 0; // 0..1 while an officer holds the player
  }

  // How many cruisers / officers a wanted level fields.
  static unitsFor(level) {
    return { cruisers: level === 0 ? 0 : Math.min(1 + Math.floor(level / 2), 4), officers: level >= 2 ? Math.min(level - 1, 4) : 0 };
  }

  addWanted(game, amount, reason) {
    if (game.player.wasted || game.player.busted) return;
    const before = game.wanted;
    game.wanted = clamp(game.wanted + amount, 0, 5);
    this.calmTimer = 0;
    if (game.wanted > before) game.notify(`Wanted level ${game.wanted} — ${reason}`, 'bad');
  }

  update(dt, game) {
    const player = game.player;
    const level = game.wanted;
    const want = Police.unitsFor(level);

    // Spawn cruisers just off-screen, on a road near the player.
    while (this.cruisers.length < want.cruisers) {
      const p = randomRoadPoint(this.rng, player, 900);
      const cruiser = new Car(p.x, p.y, 0, CAR_TYPES[1], '#1c2733', 'police');
      cruiser.speed = 200;
      this.cruisers.push(cruiser);
    }
    // Spawn officers on foot near the player.
    while (this.officers.length < want.officers) {
      const a = this.rng() * Math.PI * 2;
      const off = new Officer(player.x + Math.cos(a) * 420, player.y + Math.sin(a) * 420);
      this.officers.push(off);
    }
    // Remove extras when the heat drops.
    while (this.cruisers.length > want.cruisers) this.cruisers.pop();
    while (this.officers.length > want.officers) this.officers.pop();

    // Cruiser chase: steer toward the player and ram.
    for (const c of this.cruisers) {
      const targetAngle = Math.atan2(player.y - c.y, player.x - c.x);
      const d = dist(c.x, c.y, player.x, player.y);
      const steer = clamp(((targetAngle - c.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 1.4, -1, 1);
      const throttle = d > 60 ? 1 : 0.4;
      c.drive(throttle, steer, dt);
      // Ram damage when it slams the player's car or the player on foot.
      if (d < 56) {
        if (player.inCar) {
          if (Math.abs(c.speed) > 60) {
            player.car.health -= 14 * dt * 4;
            game.addShake(3);
          }
        } else if (player.hurtCd <= 0) {
          player.damage(8);
          game.addShake(4);
        }
      }
      if (c.health <= 0) c.dead = true;
      if (c.dead) game.explode(c.x, c.y);
    }
    this.cruisers = this.cruisers.filter((c) => !c.dead && dist(c.x, c.y, player.x, player.y) < 3200);

    // Officers chase on foot and try to bust the player.
    for (const o of this.officers) {
      o.update(dt, player, game);
    }
    this.officers = this.officers.filter((o) => o.health > 0 && dist(o.x, o.y, player.x, player.y) < 2600);

    // Wanted decays after a long quiet stretch with no police nearby.
    if (level > 0) {
      this.calmTimer += dt;
      const nearestCop = Math.min(
        ...this.cruisers.map((c) => dist(c.x, c.y, player.x, player.y)),
        ...this.officers.map((o) => dist(o.x, o.y, player.x, player.y)),
        Infinity,
      );
      if (this.calmTimer > 26 && nearestCop > 700) {
        game.wanted = level - 1;
        this.calmTimer = 0;
        game.notify(`Heat cooling off — wanted level ${game.wanted}`, 'good');
      }
    } else {
      this.calmTimer = 0;
    }

    // Busted: an officer holds the player for 2.5 s.
    if (this.bustProgress > 0 && !player.inCar) {
      this.bustProgress += dt / 2.5;
      if (this.bustProgress >= 1) {
        player.busted = true;
        game.onBusted();
      }
    } else {
      this.bustProgress = Math.max(0, this.bustProgress - dt / 2);
    }
  }

  clearAll() {
    this.cruisers = [];
    this.officers = [];
    this.bustProgress = 0;
  }
}

class Officer {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.health = 60;
    this.speed = 175;
    this.punchCd = 0;
    this.runPhase = Math.random() * 6;
  }

  update(dt, player, game) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    const d = dist(this.x, this.y, player.x, player.y);
    const ang = Math.atan2(player.y - this.y, player.x - this.x);
    this.angle = ang;
    this.runPhase += dt * 10;
    if (player.inCar) {
      // On foot they cannot catch a car: fall back and wait.
      return;
    }
    if (d > 34) {
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
    } else if (this.punchCd <= 0) {
      this.punchCd = 0.8;
      player.damage(9);
      game.addShake(3);
      game.sound.hurt();
    }
    // Holding the player: if very close for a while, the bust begins.
    if (d < 30) game.police.bustProgress += dt / 3;
  }
}
