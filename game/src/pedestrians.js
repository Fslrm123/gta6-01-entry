// pedestrians.js — the people of Solmarina: shoppers, joggers, beach
// walkers and dock workers. They stroll the sidewalks, cross at corners,
// flee from gunfire and panic when a car barrels at them. A few carry cash
// the player can take — at the cost of a wanted level.

import { clamp, dist, mulberry32, pick } from './utils.js';
import { CITY, WORLD_W, WORLD_H, BEACH_Y, hitsBuilding, randomRoadPoint } from './city.js';

const NAMES = ['Marta', 'Jules', 'Tomas', 'Priya', 'Omar', 'Lena', 'Carlos', 'Nia', 'Diego', 'Sofia', 'Ravi', 'Elena', 'Marco', 'Aisha', 'Ken', 'Lucia'];
const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1', '#fd79a8', '#00cec9'];
const PANTS = ['#2c3e50', '#5d4037', '#37474f', '#4a235a', '#1b4f72'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = 34 + rng() * 26;
    this.name = pick(rng, NAMES);
    this.shirt = pick(rng, SHIRTS);
    this.pants = pick(rng, PANTS);
    this.skin = pick(rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']);
    this.cash = 8 + Math.floor(rng() * 40);
    this.state = 'walk'; // walk | flee | panic | down
    this.fleeX = 0; this.fleeY = 0;
    this.target = this.newTarget(rng);
    this.rng = rng;
    this.health = 100;
    this.dead = false;
    this.walkPhase = rng() * Math.PI * 2;
    this.beach = y > BEACH_Y - 60;
  }

  newTarget(rng) {
    // Walk along sidewalks: pick a nearby road, then a point along it.
    const vertical = rng() < 0.5;
    const rx = CITY.roadsV[Math.floor(rng() * CITY.roadsV.length)];
    const ry = CITY.roadsH[Math.floor(rng() * CITY.roadsH.length)];
    if (this.beach) return { x: 300 + rng() * (WORLD_W - 600), y: BEACH_Y + 60 + rng() * 260 };
    return vertical
      ? { x: rx + (rng() < 0.5 ? 62 : -62), y: 300 + rng() * (BEACH_Y - 600) }
      : { x: 300 + rng() * (WORLD_W - 600), y: ry + (rng() < 0.5 ? 62 : -62) };
  }

  update(dt, danger) {
    if (this.dead) return;
    this.walkPhase += dt * 8;
    if (this.state === 'flee' || this.state === 'panic') {
      const ang = Math.atan2(this.fleeY - this.y, this.fleeX - this.x);
      this.angle = ang;
      const sp = this.state === 'panic' ? 150 : 110;
      this.x += Math.cos(ang) * sp * dt;
      this.y += Math.sin(ang) * sp * dt;
      if (dist(this.x, this.y, this.fleeX, this.fleeY) < 40 || Math.random() < dt * 0.25) {
        this.state = 'walk';
        this.target = this.newTarget(this.rng);
      }
    } else {
      const d = dist(this.x, this.y, this.target.x, this.target.y);
      if (d < 24) { this.target = this.newTarget(this.rng); return; }
      const ang = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      this.angle = ang;
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
    }
    // Keep out of buildings and the sea.
    if (hitsBuilding(this.x, this.y, 10)) {
      this.x -= Math.cos(this.angle) * this.speed * dt * 2;
      this.y -= Math.sin(this.angle) * this.speed * dt * 2;
      this.target = this.newTarget(this.rng);
    }
    this.x = clamp(this.x, 60, WORLD_W - 60);
    this.y = clamp(this.y, 60, WORLD_H - 90);
    // React to nearby danger (gunfire, a speeding car, a corpse).
    if (danger && dist(this.x, this.y, danger.x, danger.y) < danger.r) {
      if (this.state !== 'panic') {
        this.state = 'panic';
        const away = Math.atan2(this.y - danger.y, this.x - danger.x);
        this.fleeX = this.x + Math.cos(away) * 500;
        this.fleeY = this.y + Math.sin(away) * 500;
      }
    }
  }

  scareFrom(x, y) {
    if (this.dead) return;
    this.state = 'flee';
    const away = Math.atan2(this.y - y, this.x - x);
    this.fleeX = this.x + Math.cos(away) * 420;
    this.fleeY = this.y + Math.sin(away) * 420;
  }
}

export class Crowd {
  constructor() {
    this.peds = [];
    this.rng = mulberry32(4242);
  }

  spawnInitial(count, playerPos) {
    for (let i = 0; i < count; i++) {
      const p = randomRoadPoint(this.rng, playerPos, 300);
      const ped = new Ped(p.x + (this.rng() - 0.5) * 80, p.y + (this.rng() - 0.5) * 80, this.rng);
      this.peds.push(ped);
    }
    // Beach crowd.
    for (let i = 0; i < 10; i++) {
      const ped = new Ped(400 + this.rng() * (WORLD_W - 800), BEACH_Y + 60 + this.rng() * 220, this.rng);
      ped.beach = true;
      this.peds.push(ped);
    }
  }

  maintain(playerPos, want = 34) {
    const alive = this.peds.filter((p) => !p.dead).length;
    if (alive < want) {
      const p = randomRoadPoint(this.rng, playerPos, 700);
      this.peds.push(new Ped(p.x, p.y, this.rng));
    }
    this.peds = this.peds.filter((p) => {
      if (p.dead) return Math.random() < 0.98; // corpses fade slowly
      return !playerPos || dist(p.x, p.y, playerPos.x, playerPos.y) < 2400;
    });
  }

  update(dt, danger) {
    for (const p of this.peds) p.update(dt, danger);
  }

  nearest(x, y, range = 60) {
    let best = null; let bd = range;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = dist(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // Everyone near a gunshot or explosion panics.
  scareAll(x, y, radius = 420) {
    for (const p of this.peds) {
      if (!p.dead && dist(p.x, p.y, x, y) < radius) p.scareFrom(x, y);
    }
  }
}
