// player.js — Leo Marín, the player character. On foot he runs, punches
// and shoots with the mouse as his aim; in a car he drives it; in a
// helicopter he flies it over the whole city. He carries health, armor,
// cash and a weapon, and the city can bust him or waste him.

import { clamp } from './utils.js';
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
    this.car = null; // the Car being driven, or null on foot
    this.heli = null; // the Heli being flown, or null
    this.attackCd = 0;
    this.hurtCd = 0;
    this.runPhase = 0;
    this.moving = false;
    this.busted = false;
    this.wasted = false;
    this.kills = 0;
    this.carsStolen = 0;
    this.helisStolen = 0;
    this.missionsDone = 0;
    this.shotsFired = 0;
  }

  get inCar() { return this.car !== null; }
  get inHeli() { return this.heli !== null; }
  get weaponDef() { return WEAPONS[this.weapon]; }
  // Altitude of the ride under Leo: 0 on foot or in a car, 0..1 in a heli.
  get alt() { return this.heli ? this.heli.alt : 0; }

  // Hand the player a weapon and top up its ammo. Ammo defaults to 0, so a
  // call that forgets the amount can never add undefined and poison the
  // count into NaN.
  giveWeapon(name, ammo = 0) {
    this.weapon = name;
    this.ammo[name] = (this.ammo[name] || 0) + ammo;
  }

  // Damage is soaked by armor first, then health. True when it wastes him.
  damage(amount) {
    if (this.hurtCd > 0 || this.wasted) return false;
    this.hurtCd = 0.5;
    let remaining = amount;
    if (this.armor > 0) {
      const soaked = Math.min(this.armor, remaining);
      this.armor -= soaked;
      remaining -= soaked;
    }
    this.health -= remaining;
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
    if (this.heli) {
      this.flyStep(dt, input, game);
      this.x = this.heli.x;
      this.y = this.heli.y;
      this.angle = this.heli.angle;
    } else if (this.car) {
      this.driveStep(dt, input, game);
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
    } else {
      this.walkStep(dt, input, game);
    }
  }

  walkStep(dt, input, game) {
    const axis = input.moveAxis();
    const len = Math.hypot(axis.x, axis.y);
    this.moving = len > 0;
    const sprinting = input.down('ShiftLeft', 'ShiftRight');
    const pace = 210 * (sprinting ? 1.45 : 1);
    if (len > 0) {
      const stepX = (axis.x / len) * pace * dt;
      const stepY = (axis.y / len) * pace * dt;
      if (!hitsBuilding(this.x + stepX, this.y, 13)) this.x += stepX;
      if (!hitsBuilding(this.x, this.y + stepY, 13)) this.y += stepY;
      this.angle = Math.atan2(axis.y, axis.x);
      this.runPhase += dt * 11 * (sprinting ? 1.45 : 1);
    }
    this.x = clamp(this.x, 40, WORLD_W - 40);
    this.y = clamp(this.y, 40, WORLD_H - 60);
    // With a gun out, always face the cursor; with fists, only while aiming.
    // The cursor is in screen pixels, so convert it through the game's
    // pixel-buffer view (the camera shows 960x540 world units).
    if (game && game.camera && (this.weapon !== 'fists' || input.mouse.down)) {
      const w = game.screenToWorld
        ? game.screenToWorld(input.mouse.x, input.mouse.y)
        : { x: game.camera.x + input.mouse.x, y: game.camera.y + input.mouse.y };
      this.angle = Math.atan2(w.y - this.y, w.x - this.x);
    }
    this.tryAttack(input, game);
  }

  tryAttack(input, game) {
    const attacking = input.mouse.down || input.down('KeyF');
    if (!attacking || this.attackCd > 0) return;
    const def = this.weaponDef;
    const canFire = this.weapon === 'fists' || this.ammo[this.weapon] > 0;
    if (!canFire) return;
    if (this.weapon !== 'fists') this.ammo[this.weapon]--;
    this.attackCd = def.rate;
    this.shotsFired++;
    if (game) game.playerAttack(this);
  }

  driveStep(dt, input, game) {
    // Staged screenshot scenes drive on their own: full throttle, steering
    // eased onto the avenue the car is already on, so the shot shows motion.
    if (game && game.autoDrive) {
      const laneAngle = Math.round(this.car.angle / (Math.PI / 2)) * (Math.PI / 2);
      const steer = clamp(((laneAngle - this.car.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 2.5, -1, 1);
      this.car.drive(1, steer, dt);
      return;
    }
    const throttle = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 0.85 : 0);
    const steer = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    this.car.drive(throttle, steer, dt);
    // Space is the handbrake: it kills speed for a drift.
    if (input.down('Space')) this.car.speed *= Math.pow(0.15, dt);
  }

  // Flying: W/S thrust, A/D steer, Space climbs, C descends. In staged
  // scenes the heli flies itself in a slow circle over the bay.
  flyStep(dt, input, game) {
    if (game && game.autoFly) {
      this.heli.fly(0.55, 0.35, this.heli.alt < 0.9 ? 1 : 0, dt);
      return;
    }
    const throttle = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 0.7 : 0);
    const steer = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const climb = (input.down('Space') ? 1 : 0) - (input.down('KeyC') ? 1 : 0);
    this.heli.fly(throttle, steer, climb, dt);
  }

  // Climb out on the car's left side.
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

  // Step out of the heli: only safe on the ground, so a mid-air exit is
  // refused and the player is told why.
  exitHeli() {
    if (!this.heli) return false;
    if (this.heli.alt > 0.15) return false;
    const heli = this.heli;
    this.heli = null;
    this.x = heli.x - Math.cos(heli.angle + Math.PI / 2) * 40;
    this.y = heli.y - Math.sin(heli.angle + Math.PI / 2) * 40;
    this.angle = heli.angle;
    return true;
  }

  enterHeli(heli) {
    this.heli = heli;
    heli.kind = 'player';
    this.x = heli.x;
    this.y = heli.y;
    this.helisStolen++;
  }
}
