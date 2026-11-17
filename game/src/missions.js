// missions.js — the story of Solmarina. Ten missions from Ada Kline, a
// fixer who runs jobs out of Mama Rosa's Diner, take Leo from a nobody
// driver to the crew that pulls the Golden Anchor. Two heists (the Harbour
// Heist and the Casino Vault), a helicopter job, a 5-star skyline getaway,
// and a finale at the pier. Each mission has an objective, a map marker,
// a waypoint arrow and a cash reward; completing one unlocks the next.
// Enemies are rival crew members with health bars.

import { dist, clamp } from './utils.js';
import { LANDMARKS } from './city.js';

export const MISSIONS = [
  {
    id: 'first-fare', name: 'First Fare', giver: 'Ada Kline',
    brief: 'Ada needs a driver she can trust. Take her coupe from the diner to the pier pickup — no scratches, no cops.',
    objective: 'Drive to Solmarina Pier',
    target: LANDMARKS.pier, reward: 400,
    hint: 'Press E near a car to get in. W/S drive, A/D steer.',
  },
  {
    id: 'hot-wheels', name: 'Hot Wheels', giver: 'Ada Kline',
    brief: 'A client wants a sunset-red Sport, no questions asked. Steal the marked car from the casino lot and bring it to Rosa\'s Garage.',
    objective: 'Steal the red Sport at Casino Lumen, deliver to the garage',
    target: LANDMARKS.casino, reward: 800, needsCar: true,
    hint: 'Get out with E, walk up to the red car and press E to steal it. That is a crime — watch the stars.',
  },
  {
    id: 'loud-neighbours', name: 'Loud Neighbours', giver: 'Ada Kline',
    brief: 'The Dock Rats are shaking down Rosa\'s suppliers. Go to East Harbour and send their crew packing — all three of them.',
    objective: 'Deal with the 3 Dock Rats at East Harbour',
    target: LANDMARKS.harbour, reward: 1200, combat: true,
    hint: 'Click to shoot. Pick up the SMG at the harbour if you need it.',
  },
  {
    id: 'heat-wave', name: 'Heat Wave', giver: 'Ada Kline',
    brief: 'The job went loud and the whole PD is on you. Lose the heat — get your wanted level back to zero, any way you can.',
    objective: 'Lose the cops — wanted level back to 0',
    target: LANDMARKS.spray, reward: 900,
    hint: 'Hide until the stars cool off, or pay $150 at the Sunset Spray Shop for a respray.',
  },
  {
    id: 'cash-run', name: 'Cash Run', giver: 'Ada Kline',
    brief: 'Three drops, one hour on the clock. Collect the cash from the park, the pier and the hospital before time runs out.',
    objective: 'Collect 3 cash drops (Park, Pier, Hospital)',
    target: LANDMARKS.park, reward: 1500, timed: 120,
    hint: 'A car helps. The drops glow gold on the map.',
  },
  {
    id: 'rotor-work', name: 'Rotor Work', giver: 'Ada Kline',
    brief: 'Ada\'s crew needs wings. Steal the helicopter off the Harbour Helipad and put it down gentle at the Safehouse.',
    objective: 'Steal the heli at the Helipad, land at the Safehouse',
    target: LANDMARKS.helipad, reward: 2000, heli: true,
    hint: 'Press E at the helipad to climb in. W/S thrust, A/D steer, Space climbs, C descends.',
  },
  {
    id: 'harbour-heist', name: 'The Harbour Heist', giver: 'Ada Kline',
    brief: 'The big one, part one. Grab the case from the harbour warehouse, then lose a 4-star manhunt and make it to the safehouse alive.',
    objective: 'Grab the case at East Harbour, then reach the Safehouse',
    target: LANDMARKS.harbour, reward: 5000, combat: true, heist: true,
    hint: 'Grab the case, expect the whole city after you. The safehouse is on the west side.',
  },
  {
    id: 'high-roller', name: 'High Roller', giver: 'Ada Kline',
    brief: 'The big one, part two. Casino Lumen\'s vault is fat tonight. Take the vault case past their crew, then shake a 4-star tail to the safehouse.',
    objective: 'Grab the vault case at Casino Lumen, reach the Safehouse',
    target: LANDMARKS.casino, reward: 6000, combat: true, heist: true,
    hint: 'Four guards on the vault. Grab the case and run — do not stop to count it.',
  },
  {
    id: 'skyline-getaway', name: 'Skyline Getaway', giver: 'Ada Kline',
    brief: 'The whole city wants you now — five stars, and the PD heli is up. Lose them in the sky: land the heli back at the helipad, or cool the heat to zero.',
    objective: 'Escape the 5-star manhunt — land at the Helipad or cool off',
    target: LANDMARKS.helipad, reward: 4000, heli: true,
    hint: 'Stay high and fast. The PD heli cannot keep up forever.',
  },
  {
    id: 'golden-anchor', name: 'The Golden Anchor', giver: 'Ada Kline',
    brief: 'The finale. The Golden Anchor — the statue the whole bay brags about — sits on the pier under guard. Take it, shake the tail, and bring it home to Ada at the diner.',
    objective: 'Grab the Golden Anchor at the Pier, deliver to the Diner',
    target: LANDMARKS.pier, reward: 10000, combat: true, heist: true,
    hint: 'Three guards on the pier. The anchor is heavy — drive it home, do not walk it.',
  },
];

export class Enemy {
  constructor(x, y, name) {
    this.x = x; this.y = y;
    this.name = name;
    this.health = 80;
    this.dead = false;
    this.angle = 0;
    this.shootCd = 1 + Math.random();
    this.runPhase = Math.random() * 6;
  }
}

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0; // current mission
    this.active = false;
    this.stage = 0; // per-mission progress
    this.enemies = [];
    this.drops = []; // cash-run drop points
    this.timer = 0;
    this.caseTaken = false;
    this.markedCar = null; // hot-wheels target car
    this.started = false;
  }

  get current() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  // Spawn a few rival crew members around a landmark.
  spawnCrew(x, y, count, name) {
    for (let i = 0; i < count; i++) {
      this.enemies.push(new Enemy(
        x + (i - Math.floor(count / 2)) * 90,
        y + (i % 2) * 80 - 40,
        name,
      ));
    }
  }

  start() {
    const m = this.current;
    if (!m) return;
    this.active = true;
    this.started = true;
    this.stage = 0;
    this.timer = m.timed || 0;
    this.caseTaken = false;
    this.enemies = [];
    this.drops = [];
    const game = this.game;
    if (m.id === 'loud-neighbours') {
      this.spawnCrew(LANDMARKS.harbour.x, LANDMARKS.harbour.y, 3, 'Rat');
    }
    if (m.id === 'harbour-heist') {
      this.spawnCrew(LANDMARKS.harbour.x, LANDMARKS.harbour.y, 4, 'Rat');
    }
    if (m.id === 'high-roller') {
      this.spawnCrew(LANDMARKS.casino.x, LANDMARKS.casino.y, 4, 'Guard');
    }
    if (m.id === 'golden-anchor') {
      this.spawnCrew(LANDMARKS.pier.x, LANDMARKS.pier.y, 3, 'Guard');
    }
    if (m.id === 'cash-run') {
      this.drops = [
        { ...LANDMARKS.park, taken: false },
        { ...LANDMARKS.pier, taken: false },
        { ...LANDMARKS.hospital, taken: false },
      ];
    }
    if (m.id === 'hot-wheels') {
      // The red Sport waiting at the casino lot.
      const { Car, CAR_TYPES } = { Car: game.CarClass, CAR_TYPES: game.CarTypes };
      const car = new Car(LANDMARKS.casino.x + 60, LANDMARKS.casino.y + 40, 0, CAR_TYPES[4], '#e84a4a', 'parked');
      game.traffic.cars.push(car);
      this.markedCar = car;
    }
    if (m.id === 'heat-wave') {
      game.police.addWanted(game, 3, 'The job went loud');
    }
    if (m.id === 'skyline-getaway') {
      game.police.addWanted(game, 5, 'Five stars — the whole city is after you');
    }
    game.sound.missionStart();
    game.notify(`Mission: ${m.name} — ${m.objective}`, 'mission');
  }

  // The current objective marker on the map.
  objectivePoint() {
    const m = this.current;
    if (!m || !this.active) return null;
    if (m.id === 'cash-run') {
      const next = this.drops.find((d) => !d.taken);
      return next || LANDMARKS.diner;
    }
    if (m.id === 'hot-wheels') return this.stage === 0 ? LANDMARKS.casino : LANDMARKS.garage;
    if (m.id === 'harbour-heist') return this.caseTaken ? LANDMARKS.safehouse : LANDMARKS.harbour;
    if (m.id === 'high-roller') return this.caseTaken ? LANDMARKS.safehouse : LANDMARKS.casino;
    if (m.id === 'golden-anchor') return this.caseTaken ? LANDMARKS.diner : LANDMARKS.pier;
    if (m.id === 'rotor-work') return this.stage === 0 ? LANDMARKS.helipad : LANDMARKS.safehouse;
    if (m.id === 'skyline-getaway') return LANDMARKS.helipad;
    if (m.id === 'heat-wave') return LANDMARKS.spray;
    return m.target;
  }

  update(dt) {
    if (!this.active || this.done) return;
    const m = this.current;
    const game = this.game;
    const p = game.player;
    if (m.timed) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.fail('Out of time.');
        return;
      }
    }
    const obj = this.objectivePoint();
    // Enemy AI: close in and shoot at the player when near. Ground crews
    // cannot hit a helicopter flying high — they hold fire and wait.
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      e.shootCd -= dt;
      if (d < 460) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (d > 180) {
          e.x += Math.cos(e.angle) * 95 * dt;
          e.y += Math.sin(e.angle) * 95 * dt;
        } else if (e.shootCd <= 0) {
          e.shootCd = 0.9 + Math.random() * 0.5;
          game.combat.tracers.push({ x1: e.x, y1: e.y, x2: p.x, y2: p.y, life: 0.1 });
          game.sound.gunshot();
          if (p.alt < 0.4 && Math.random() < 0.55) p.damage(7);
        }
      }
      e.runPhase += dt * 8;
    }

    // Mission completion checks.
    if (m.id === 'first-fare') {
      if (dist(p.x, p.y, LANDMARKS.pier.x, LANDMARKS.pier.y) < 130) this.complete();
    } else if (m.id === 'hot-wheels') {
      if (this.stage === 0 && p.car === this.markedCar) {
        this.stage = 1;
        game.notify('Got it. Now deliver it to Rosa\'s Garage.', 'mission');
      }
      if (this.stage === 1 && p.car === this.markedCar && dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 140) this.complete();
    } else if (m.id === 'loud-neighbours') {
      if (this.enemies.length > 0 && this.enemies.every((e) => e.dead)) this.complete();
    } else if (m.id === 'heat-wave') {
      if (game.wanted === 0) this.complete();
    } else if (m.id === 'cash-run') {
      for (const d of this.drops) {
        if (!d.taken && dist(p.x, p.y, d.x, d.y) < 90) {
          d.taken = true;
          game.addCash(200, 'Cash drop +$200');
          game.sound.cash();
        }
      }
      if (this.drops.every((d) => d.taken)) this.complete();
    } else if (m.id === 'rotor-work') {
      if (this.stage === 0 && p.inHeli) {
        this.stage = 1;
        game.notify('In the air! Put her down gentle at the Safehouse.', 'mission');
      }
      if (this.stage === 1 && p.inHeli && p.heli.alt < 0.5 && dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 150) this.complete();
    } else if (m.id === 'harbour-heist') {
      if (!this.caseTaken && dist(p.x, p.y, LANDMARKS.harbour.x, LANDMARKS.harbour.y) < 110) {
        this.caseTaken = true;
        game.police.addWanted(game, 4, 'Harbour heist — case taken');
        game.notify('Case grabbed! Lose the manhunt and reach the Safehouse.', 'mission');
      }
      if (this.caseTaken && dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 130) this.complete();
    } else if (m.id === 'high-roller') {
      if (!this.caseTaken && dist(p.x, p.y, LANDMARKS.casino.x, LANDMARKS.casino.y) < 110) {
        this.caseTaken = true;
        game.police.addWanted(game, 4, 'Vault case taken — the house is coming');
        game.notify('Vault case grabbed! Shake the tail to the Safehouse.', 'mission');
      }
      if (this.caseTaken && dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 130) this.complete();
    } else if (m.id === 'skyline-getaway') {
      const landed = p.inHeli && p.heli.alt < 0.5 && dist(p.x, p.y, LANDMARKS.helipad.x, LANDMARKS.helipad.y) < 140;
      if (landed || game.wanted === 0) this.complete();
    } else if (m.id === 'golden-anchor') {
      if (!this.caseTaken && dist(p.x, p.y, LANDMARKS.pier.x, LANDMARKS.pier.y) < 110) {
        this.caseTaken = true;
        game.police.addWanted(game, 4, 'The Golden Anchor is gone');
        game.notify('Anchor secured! Bring it home to Ada at the diner.', 'mission');
      }
      if (this.caseTaken && dist(p.x, p.y, LANDMARKS.diner.x, LANDMARKS.diner.y) < 140) this.complete();
    }
  }

  onEnemyDown(e) {
    // The combat / heist completion is checked in update().
  }

  complete() {
    const m = this.current;
    const game = this.game;
    this.active = false;
    this.index++;
    game.player.missionsDone++;
    game.addCash(m.reward, `Mission complete: ${m.name} +$${m.reward}`);
    game.sound.missionDone();
    game.notify(`Mission complete: ${m.name} (+$${m.reward})`, 'good');
    game.flashBanner(`MISSION COMPLETE — ${m.name.toUpperCase()}`);
    if (this.done) {
      game.notify('Story complete! Solmarina is yours. Free roam unlocked.', 'good');
      game.flashBanner('STORY COMPLETE — SOLMARINA IS YOURS');
    }
  }

  fail(reason) {
    const game = this.game;
    this.active = false;
    this.enemies = [];
    this.drops = [];
    game.sound.fail();
    game.notify(`Mission failed: ${reason} — talk to Ada to retry.`, 'bad');
    game.flashBanner('MISSION FAILED');
  }

  // Restart the current mission from the diner (Ada's spot).
  retry() {
    this.start();
  }
}
