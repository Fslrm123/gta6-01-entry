// player.js — Leo Marín, the player character. On foot he runs, punches
// and shoots (mouse aims); in a car he drives it. He carries health, armor,
// cash, a weapon and a wanted level, and he can be busted or wasted.

import { clamp, dist, turnToward } from './utils.js';
import { hitsBuilding, WORLD_W, WORLD_H } from './city.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 46, rate: 0.32, ammo: Infinity, auto: false },
  pistol: { name: 'Pistol', damage: 26, range: 420, rate: 0.24, ammo: 120, auto: false },
  smg: { name: 'Street SMG', damage: 14, range: 380, rate: 0.09, ammo: 240, auto: true },
};

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2; // facing up
    this.speed = 0;
    this.health = 100;
    this.armor = 0;
    this.cash = 250;
    this.weapon = 'fists';
    this.ammo = { pistol: 0, smg: 0 };
    this.car = null; // the Car he is driving, or null on foot
    this.attackCd = 0;
    this.hurtCd = 0;
    this.runPhase = 0;
    this.moving = false;
    this.busted = false;
    this.wasted = false;
    this.kills = 0;
    this.carsStolen = 0;
    this.missionsDone = 0;
    this.shotsFired = 0;
  }

  get inCar() { return this.car !== null; }
  get weaponDef() { return WEAPONS[this.weapon]; }

  giveWeapon(name, ammo) {
    this.weapon = name;
    this.ammo[name] = (this.ammo[name] || 0) + ammo;
  }

  // Damage goes to armor first, then health. Returns true if wasted.
  damage(amount) {
    if (this.hurtCd > 0 || this.wasted) return false;
    this.hurtCd = 0.5;
    let left = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, left);
      this.armor -= absorbed;
      left -= absorbed;
    }
    this.health -= left;
    if (this.health <= 0) {
      this.health = 0;
      this.wasted = true;
      return true;
    }
    return false;
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }

  update(dt, input, game) {
    if (this.busted || this.wasted) return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    if (this.car) {
      this.updateDriving(dt, input, game);
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
    } else {
      this.updateOnFoot(dt, input, game);
    }
  }

  updateOnFoot(dt, input, game) {
    const axis = input.moveAxis();
    const len = Math.hypot(axis.x, axis.y);
    this.moving = len > 0;
    const sprint = input.down('ShiftLeft', 'ShiftRight') ? 1.45 : 1;
    const spd = 210 * sprint;
    if (len > 0) {
      const nx = this.x + (axis.x / len) * spd * dt;
      const ny = this.y + (axis.y / len) * spd * dt;
      if (!hitsBuilding(nx, this.y, 13)) this.x = nx;
      if (!hitsBuilding(this.x, ny, 13)) this.y = ny;
      this.angle = Math.atan2(axis.y, axis.x);
      this.runPhase += dt * 11 * sprint;
    }
    this.x = clamp(this.x, 40, WORLD_W - 40);
    this.y = clamp(this.y, 40, WORLD_H - 60);
    // Aim with the mouse: face the cursor.
    if (game && game.camera) {
      const wx = game.camera.x + input.mouse.x;
      const wy = game.camera.y + input.mouse.y;
      if (this.weapon !== 'fists' || input.mouse.down) {
        this.angle = Math.atan2(wy - this.y, wx - this.x);
      }
    }
    // Attack: click (or F) to shoot / punch.
    const wantAttack = input.mouse.down || input.down('KeyF');
    if (wantAttack && this.attackCd <= 0) {
      const w = this.weaponDef;
      if (this.weapon === 'fists' || this.ammo[this.weapon] > 0 || this.weapon === 'fists') {
        if (this.weapon !== 'fists') this.ammo[this.weapon]--;
        this.attackCd = w.rate;
        this.shotsFired++;
        if (game) game.playerAttack(this);
      }
    }
  }

  updateDriving(dt, input, game) {
    // Staged scenes (screenshots) drive themselves: full throttle, steering
    // snapped to the avenue the car is on, so the shot shows motion.
    if (game && game.autoDrive) {
      const target = Math.round(this.car.angle / (Math.PI / 2)) * (Math.PI / 2);
      const steer = clamp(((target - this.car.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 2.5, -1, 1);
      this.car.drive(1, steer, dt);
      return;
    }
    const throttle = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 0.85 : 0);
    const steer = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    this.car.drive(throttle, steer, dt);
    // Handbrake: Space locks the rear wheels for a drift.
    if (input.down('Space')) this.car.speed *= Math.pow(0.15, dt);
  }

  // Step out of the car to its left side.
  exitCar() {
    if (!this.car) return;
    const car = this.car;
    this.car = null;
    this.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
    this.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
    this.angle = car.angle;
  }

  enterCar(car) {
    this.car = car;
    car.kind = 'player';
    this.x = car.x;
    this.y = car.y;
    this.carsStolen++;
  }
}
