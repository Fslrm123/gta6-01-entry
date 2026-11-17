// vehicles.js — cars of Solmarina: the player's stolen rides, police
// cruisers and the traffic that fills the avenues. Traffic cars follow the
// road grid, keep their lane, brake for the car ahead and pick a new turn at
// each intersection. Player driving is simple arcade physics: throttle,
// brake/reverse and steering that tightens with speed.

import { clamp, dist, mulberry32, pick, turnToward } from './utils.js';
import { CITY, WORLD_W, WORLD_H, BEACH_Y, nearestRoadPoint, hitsBuilding } from './city.js';

export const CAR_COLORS = [
  '#e84a4a', '#3a7bd5', '#f2c14e', '#4ecb71', '#9b59b6', '#e67e22',
  '#dfe3e6', '#2c2c34', '#16a085', '#c0392b', '#f5d76e', '#5d6d7e',
];
export const CAR_TYPES = [
  { name: 'Coupe', len: 52, wid: 26, top: 330, accel: 430 },
  { name: 'Sedan', len: 58, wid: 27, top: 300, accel: 380 },
  { name: 'Pickup', len: 62, wid: 28, top: 280, accel: 340 },
  { name: 'Van', len: 66, wid: 30, top: 250, accel: 300 },
  { name: 'Sport', len: 54, wid: 26, top: 390, accel: 500 },
  { name: 'Taxi', len: 56, wid: 27, top: 300, accel: 380 },
];

let nextId = 1;

export class Car {
  constructor(x, y, angle, type, color, kind = 'traffic') {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.angle = angle; // facing direction, radians
    this.speed = 0;
    this.type = type;
    this.color = color;
    this.kind = kind; // 'traffic' | 'player' | 'police' | 'parked'
    this.health = 100;
    this.smoke = 0; // 0..1 damage smoke
    this.dead = false;
    this.steer = 0;
    // Traffic state: which road axis it follows and where it turns next.
    this.vertical = Math.abs(Math.sin(angle)) < 0.7 ? false : true;
    this.dir = 1;
    this.targetSpeed = 110 + Math.random() * 60;
    this.stopped = 0;
    this.honk = 0;
  }

  get len() { return this.type.len; }
  get wid() { return this.type.wid; }

  // Arcade driving for the player (or a police ram): throttle -1..1, steer -1..1.
  drive(throttle, steer, dt) {
    const top = this.type.top;
    this.speed += throttle * this.type.accel * dt;
    if (throttle === 0) this.speed *= Math.pow(0.4, dt); // coast drag
    if (this.speed > 0) this.speed = Math.min(this.speed, top);
    if (this.speed < 0) this.speed = Math.max(this.speed, -top * 0.45);
    const sf = clamp(Math.abs(this.speed) / 120, 0.25, 1);
    this.angle += steer * 2.4 * sf * dt * Math.sign(this.speed || 1);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.x = clamp(this.x, 60, WORLD_W - 60);
    this.y = clamp(this.y, 60, WORLD_H - 60);
    if (hitsBuilding(this.x, this.y, 16)) {
      // Slide out of the building: push back along the travel direction.
      this.x -= Math.cos(this.angle) * this.speed * dt * 1.2;
      this.y -= Math.sin(this.angle) * this.speed * dt * 1.2;
      if (Math.abs(this.speed) > 120) {
        this.health -= Math.abs(this.speed) * 0.02;
        this.speed *= -0.25;
      } else {
        this.speed *= 0.4;
      }
    }
    if (this.y > BEACH_Y + 60) { // sand slows you down, sea stops you
      this.speed *= Math.pow(0.5, dt);
      if (this.y > WORLD_H - 90) { this.y = WORLD_H - 90; this.speed = 0; }
    }
    if (this.health <= 0 && !this.dead) this.dead = true;
    this.smoke = clamp(1 - this.health / 55, 0, 1);
  }

  // Traffic AI: cruise along its road, slow for cars ahead, turn at random
  // intersections, and occasionally pause (as if at a light).
  updateTraffic(dt, cars, playerCar) {
    if (this.kind !== 'traffic') return;
    if (this.stopped > 0) { this.stopped -= dt; this.speed *= 0.8; }
    else {
      // Car ahead? Brake.
      let ahead = Infinity;
      for (const o of cars) {
        if (o === this || o.dead) continue;
        const d = dist(this.x, this.y, o.x, o.y);
        if (d < 90) {
          const ang = Math.atan2(o.y - this.y, o.x - this.x);
          if (Math.abs(((ang - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.6) ahead = Math.min(ahead, d);
        }
      }
      if (playerCar && !playerCar.dead) {
        const d = dist(this.x, this.y, playerCar.x, playerCar.y);
        if (d < 90) {
          const ang = Math.atan2(playerCar.y - this.y, playerCar.x - this.x);
          if (Math.abs(((ang - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.6) ahead = Math.min(ahead, d);
        }
      }
      const want = ahead < 70 ? 0 : this.targetSpeed;
      this.speed += clamp(want - this.speed, -260 * dt, 160 * dt);
      // Steer back onto the road centre line.
      const rp = nearestRoadPoint(this.x, this.y);
      const lane = 20;
      const tx = this.vertical ? rp.x + (this.dir > 0 ? lane : -lane) : this.x;
      const ty = this.vertical ? this.y : rp.y + (this.dir > 0 ? lane : -lane);
      const wantAngle = Math.atan2(ty + (this.vertical ? this.dir * 100 : 0) - this.y,
        tx + (this.vertical ? 0 : this.dir * 100) - this.x);
      this.angle = turnToward(this.angle, wantAngle, 1.6 * dt);
      // At an intersection, sometimes turn onto the crossing road.
      const onV = CITY.roadsV.some((rx) => Math.abs(this.x - rx) < 14);
      const onH = CITY.roadsH.some((ry) => Math.abs(this.y - ry) < 14);
      if (onV && onH && Math.random() < dt * 0.9) {
        this.vertical = !this.vertical;
        this.dir = Math.random() < 0.5 ? 1 : -1;
      }
      if (Math.random() < dt * 0.02) this.stopped = 1 + Math.random() * 2;
    }
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    // Keep traffic on the road network: if it drifts off, snap it back.
    if (this.y > BEACH_Y - 80 || this.x < 120 || this.x > WORLD_W - 120 || this.y < 120) {
      const rp = nearestRoadPoint(clamp(this.x, 200, WORLD_W - 200), clamp(this.y, 200, BEACH_Y - 200));
      this.x = rp.x; this.y = rp.y; this.vertical = rp.vertical;
      this.angle = this.vertical ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
    }
  }
}

export class Traffic {
  constructor() {
    this.cars = [];
    this.rng = mulberry32(777);
  }

  spawnInitial(count, playerPos) {
    for (let i = 0; i < count; i++) {
      const p = this.freeRoadPoint(playerPos);
      if (!p) continue;
      const type = pick(this.rng, CAR_TYPES);
      const car = new Car(p.x, p.y, p.vertical ? (Math.PI / 2) : 0, type, pick(this.rng, CAR_COLORS));
      car.vertical = p.vertical;
      car.dir = this.rng() < 0.5 ? 1 : -1;
      car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.speed = car.targetSpeed * 0.7;
      this.cars.push(car);
    }
    // Parked cars the player can steal.
    for (const spot of CITY.parkingSpots.slice(0, 14)) {
      const type = pick(this.rng, CAR_TYPES);
      const car = new Car(spot.x, spot.y, spot.angle, type, pick(this.rng, CAR_COLORS), 'parked');
      this.cars.push(car);
    }
  }

  freeRoadPoint(playerPos) {
    for (let tries = 0; tries < 30; tries++) {
      const vertical = this.rng() < 0.5;
      const rx = CITY.roadsV[Math.floor(this.rng() * CITY.roadsV.length)];
      const ry = CITY.roadsH[Math.floor(this.rng() * CITY.roadsH.length)];
      const x = vertical ? rx : 300 + this.rng() * (WORLD_W - 600);
      const y = vertical ? 300 + this.rng() * (BEACH_Y - 600) : ry;
      if (playerPos && dist(x, y, playerPos.x, playerPos.y) < 500) continue;
      if (this.cars.some((c) => dist(x, y, c.x, c.y) < 120)) continue;
      return { x, y, vertical };
    }
    return null;
  }

  // Keep the streets busy: top the traffic back up near the player.
  maintain(playerPos, want = 16) {
    const alive = this.cars.filter((c) => c.kind === 'traffic' && !c.dead).length;
    if (alive < want) {
      const p = this.freeRoadPoint(playerPos);
      if (p) {
        const type = pick(this.rng, CAR_TYPES);
        const car = new Car(p.x, p.y, 0, type, pick(this.rng, CAR_COLORS));
        car.vertical = p.vertical;
        car.dir = this.rng() < 0.5 ? 1 : -1;
        car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
        car.speed = car.targetSpeed;
        this.cars.push(car);
      }
    }
    // Remove wrecks and far-away traffic.
    this.cars = this.cars.filter((c) => {
      if (c.kind === 'traffic' && c.dead) return false;
      if (c.kind === 'traffic' && playerPos && dist(c.x, c.y, playerPos.x, playerPos.y) > 2600) return false;
      return true;
    });
  }

  update(dt, playerCar) {
    for (const c of this.cars) c.updateTraffic(dt, this.cars, playerCar);
    // Simple car-car separation so traffic does not stack up.
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i]; const b = this.cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0 && d < 46) {
          const push = (46 - d) / 2;
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          a.x -= Math.cos(ang) * push; a.y -= Math.sin(ang) * push;
          b.x += Math.cos(ang) * push; b.y += Math.sin(ang) * push;
          a.speed *= 0.9; b.speed *= 0.9;
        }
      }
    }
  }

  // The nearest car within `range` of a point (for stealing / entering).
  nearest(x, y, range = 90) {
    let best = null; let bd = range;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
