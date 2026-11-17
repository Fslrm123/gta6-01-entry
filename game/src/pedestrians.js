// pedestrians.js — the people of Solmarina: shoppers, joggers, beach
// walkers and dock workers. They stroll the sidewalks and the sand, cross
// at corners, and run when gunfire or a speeding car comes near. A few
// carry cash the player can take — at the cost of a wanted level.

import { clamp, dist, mulberry32, pick } from './utils.js';
import { CITY, WORLD_W, WORLD_H, BEACH_Y, hitsBuilding, randomRoadPoint } from './city.js';

const FIRST_NAMES = ['Marta', 'Jules', 'Tomas', 'Priya', 'Omar', 'Lena', 'Carlos', 'Nia', 'Diego', 'Sofia', 'Ravi', 'Elena', 'Marco', 'Aisha', 'Ken', 'Lucia'];
const SHIRT_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1', '#fd79a8', '#00cec9'];
const PANTS_COLORS = ['#2c3e50', '#5d4037', '#37474f', '#4a235a', '#1b4f72'];
const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = 34 + rng() * 26;
    this.name = pick(rng, FIRST_NAMES);
    this.shirt = pick(rng, SHIRT_COLORS);
    this.pants = pick(rng, PANTS_COLORS);
    this.skin = pick(rng, SKIN_TONES);
    this.cash = 8 + Math.floor(rng() * 40);
    this.state = 'walk'; // walk | flee | panic
    this.fleeX = 0;
    this.fleeY = 0;
    this.rng = rng;
    this.health = 100;
    this.dead = false;
    this.walkPhase = rng() * Math.PI * 2;
    this.beach = y > BEACH_Y - 60;
    this.target = this.pickStrollTarget();
  }

  // A stroll target on a sidewalk: a point alongside a road, or a spot on
  // the sand for beach walkers.
  pickStrollTarget() {
    const rng = this.rng;
    if (this.beach) {
      return { x: 300 + rng() * (WORLD_W - 600), y: BEACH_Y + 60 + rng() * 260 };
    }
    const alongVertical = rng() < 0.5;
    if (alongVertical) {
      const rx = CITY.roadsV[Math.floor(rng() * CITY.roadsV.length)];
      return { x: rx + (rng() < 0.5 ? 62 : -62), y: 300 + rng() * (BEACH_Y - 600) };
    }
    const ry = CITY.roadsH[Math.floor(rng() * CITY.roadsH.length)];
    return { x: 300 + rng() * (WORLD_W - 600), y: ry + (rng() < 0.5 ? 62 : -62) };
  }

  // Run away from (x, y): fleeing is a brisk jog, panic is a sprint.
  runFrom(x, y, panicking) {
    if (this.dead) return;
    this.state = panicking ? 'panic' : 'flee';
    const away = Math.atan2(this.y - y, this.x - x);
    const range = panicking ? 500 : 420;
    this.fleeX = this.x + Math.cos(away) * range;
    this.fleeY = this.y + Math.sin(away) * range;
  }

  scareFrom(x, y) {
    this.runFrom(x, y, false);
  }

  update(dt, danger) {
    if (this.dead) return;
    this.walkPhase += dt * 8;
    if (this.state === 'flee' || this.state === 'panic') this.stepFleeing(dt);
    else this.stepStrolling(dt);
    // Never walk through a wall or into the sea.
    if (hitsBuilding(this.x, this.y, 10)) {
      this.x -= Math.cos(this.angle) * this.speed * dt * 2;
      this.y -= Math.sin(this.angle) * this.speed * dt * 2;
      this.target = this.pickStrollTarget();
    }
    this.x = clamp(this.x, 60, WORLD_W - 60);
    this.y = clamp(this.y, 60, WORLD_H - 90);
    // A danger nearby (gunfire, a speeding car) sends them running.
    if (danger && this.state !== 'panic' && dist(this.x, this.y, danger.x, danger.y) < danger.r) {
      this.runFrom(danger.x, danger.y, true);
    }
  }

  stepFleeing(dt) {
    const heading = Math.atan2(this.fleeY - this.y, this.fleeX - this.x);
    this.angle = heading;
    const pace = this.state === 'panic' ? 150 : 110;
    this.x += Math.cos(heading) * pace * dt;
    this.y += Math.sin(heading) * pace * dt;
    if (dist(this.x, this.y, this.fleeX, this.fleeY) < 40 || Math.random() < dt * 0.25) {
      this.state = 'walk';
      this.target = this.pickStrollTarget();
    }
  }

  stepStrolling(dt) {
    if (dist(this.x, this.y, this.target.x, this.target.y) < 24) {
      this.target = this.pickStrollTarget();
      return;
    }
    const heading = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.angle = heading;
    this.x += Math.cos(heading) * this.speed * dt;
    this.y += Math.sin(heading) * this.speed * dt;
  }
}

export class Crowd {
  constructor() {
    this.peds = [];
    this.rng = mulberry32(4242);
  }

  spawnInitial(count, playerPos) {
    for (let i = 0; i < count; i++) {
      const spot = randomRoadPoint(this.rng, playerPos, 300);
      this.peds.push(new Ped(
        spot.x + (this.rng() - 0.5) * 80,
        spot.y + (this.rng() - 0.5) * 80,
        this.rng,
      ));
    }
    // A crowd on the sand by the sea.
    for (let i = 0; i < 10; i++) {
      const ped = new Ped(400 + this.rng() * (WORLD_W - 800), BEACH_Y + 60 + this.rng() * 220, this.rng);
      ped.beach = true;
      this.peds.push(ped);
    }
  }

  maintain(playerPos, want = 34) {
    const alive = this.peds.filter((p) => !p.dead).length;
    if (alive < want) {
      const spot = randomRoadPoint(this.rng, playerPos, 700);
      this.peds.push(new Ped(spot.x, spot.y, this.rng));
    }
    // Corpses linger a while, then fade; the living stay near the player.
    this.peds = this.peds.filter((p) => {
      if (p.dead) return Math.random() < 0.98;
      return !playerPos || dist(p.x, p.y, playerPos.x, playerPos.y) < 2400;
    });
  }

  update(dt, danger) {
    for (const p of this.peds) p.update(dt, danger);
  }

  nearest(x, y, range = 60) {
    let best = null;
    let bestDist = range;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = dist(x, y, p.x, p.y);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  // Everyone near a gunshot or an explosion runs.
  scareAll(x, y, radius = 420) {
    for (const p of this.peds) {
      if (!p.dead && dist(p.x, p.y, x, y) < radius) p.scareFrom(x, y);
    }
  }
}
