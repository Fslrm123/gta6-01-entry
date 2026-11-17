// heli.js — helicopters of Solmarina. One flyable heli waits on the
// Harbour Helipad for the player to steal; at high wanted levels the PD
// sends its own heli, which follows from the air and shoots. A heli flies
// over buildings, traffic and water, steers like a car, climbs with Space
// and descends with C. Altitude is visual (shadow offset, rotor blur) and
// tactical: ground enemies cannot hit a heli flying high.

import { clamp, dist } from './utils.js';
import { WORLD_W, WORLD_H } from './city.js';

export class Heli {
  constructor(x, y, angle, kind = 'parked') {
    this.x = x;
    this.y = y;
    this.angle = angle; // facing direction, radians
    this.speed = 0;
    this.alt = 0; // 0 landed .. 1 cruising altitude
    this.health = 100;
    this.dead = false;
    this.kind = kind; // 'parked' | 'player' | 'police-heli'
    this.rotorPhase = Math.random() * 6;
    this.shootCd = 1;
  }

  get len() { return 64; }
  get wid() { return 30; }

  // Arcade flying: throttle -1..1, steer -1..1, climb -1..1.
  // No building collision up here — the rotor clears the rooftops.
  fly(throttle, steer, climb, dt) {
    const top = 520;
    this.speed += throttle * 420 * dt;
    if (throttle === 0) this.speed *= Math.pow(0.4, dt);
    this.speed = clamp(this.speed, -top * 0.4, top);
    const sf = clamp(Math.abs(this.speed) / 140, 0.3, 1);
    this.angle += steer * 2.1 * sf * dt * Math.sign(this.speed || 1);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.x = clamp(this.x, 80, WORLD_W - 80);
    this.y = clamp(this.y, 80, WORLD_H - 80);
    // Altitude: Space climbs, C descends. A heli only rests on the ground
    // when it is slow and low over land AND not climbing — the old version
    // zeroed alt every frame while it was under 0.05, so a climb from the
    // ground could never get started (Space did nothing).
    this.alt = clamp(this.alt + climb * 0.7 * dt, 0, 1);
    if (climb <= 0 && this.alt < 0.05 && Math.abs(this.speed) < 40) this.alt = 0;
    this.rotorPhase += dt * (this.alt > 0 ? 34 : 6);
    if (this.health <= 0 && !this.dead) this.dead = true;
  }

  // Damage from bullets and explosions. A dead heli falls out of the sky.
  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return this.dead;
  }
}

// The police heli's chase: keep pace above the player and shoot in bursts.
export function updatePoliceHeli(heli, dt, game) {
  const player = game.player;
  const d = dist(heli.x, heli.y, player.x, player.y);
  const targetAngle = Math.atan2(player.y - heli.y, player.x - heli.x);
  const steer = clamp(((targetAngle - heli.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 1.6, -1, 1);
  const throttle = d > 120 ? 1 : 0.3;
  heli.fly(throttle, steer, heli.alt < 0.85 ? 1 : 0, dt);
  // Shoot in bursts when close enough to matter.
  heli.shootCd -= dt;
  if (d < 520 && heli.shootCd <= 0) {
    heli.shootCd = 0.85 + Math.random() * 0.4;
    game.combat.tracers.push({ x1: heli.x, y1: heli.y, x2: player.x, y2: player.y, life: 0.1 });
    game.sound.gunshot();
    if (Math.random() < 0.45) {
      if (player.inCar) player.car.health -= 6;
      else if (player.inHeli) player.heli.health -= 6;
      else player.damage(5);
    }
  }
}
