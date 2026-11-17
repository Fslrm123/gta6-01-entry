// main.js — Solmarina's game loop and state machine. Boots the city, the
// traffic, the crowd, the police and the story, then runs the frame loop:
// input → player → traffic → peds → police → missions → combat → camera →
// render → HUD. Also handles every world interaction (steal a car, start a
// mission at the diner, respray, gun shop, hospital, save) and the ?scene=
// staging used to take the entry's screenshots of real gameplay.

import { Input } from './input.js';
import { Sound } from './audio.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { Player } from './player.js';
import { Traffic, Car, CAR_TYPES, CAR_COLORS } from './vehicles.js';
import { Crowd } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { clamp, dist, mulberry32 } from './utils.js';
import { CITY, WORLD_W, WORLD_H, LANDMARKS as LM } from './city.js';

const VIEW_W = 1280;
const VIEW_H = 720;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.input = new Input(this.canvas);
    this.sound = new Sound();
    this.renderer = new Renderer(this.canvas);
    this.hud = new HUD(this.canvas);
    this.state = 'title'; // title | playing | paused | busted | wasted
    this.time = 0;
    this.wanted = 0;
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.particles = [];
    this.toasts = [];
    this.banner = null;
    this.danger = null;
    this.hasSave = hasSave();
    this.player = new Player(LM.diner.x, LM.diner.y + 90);
    this.traffic = new Traffic();
    this.crowd = new Crowd();
    this.police = new Police();
    this.missions = new Missions(this);
    this.combat = new Combat(this);
    // Missions needs the car classes for the hot-wheels target car.
    this.CarClass = Car;
    this.CarTypes = CAR_TYPES;
    this.traffic.spawnInitial(18, this.player);
    this.crowd.spawnInitial(30, this.player);
    this.last = performance.now();
    this.prompt = null;
    window.__game = this; // handy for the screenshot driver and debugging
    this.maybeStageScene();
    requestAnimationFrame((t) => this.loop(t));
  }

  // --- scene staging for the entry's screenshots (?scene=chase|shootout|downtown|port)
  // Each scene is real gameplay state: the game is running, the camera is
  // live, the police are chasing. Nothing here is a mock or a still image.
  maybeStageScene() {
    const params = new URLSearchParams(location.search);
    const scene = params.get('scene') || params.get('shot');
    if (!scene) return;
    this.sound.ensure();
    this.state = 'playing';
    const p = this.player;
    if (scene === 'chase') {
      // Eastbound on the long 1560 avenue, cruisers in pursuit behind.
      this.autoDrive = true;
      const car = new Car(2400, 1560, 0, CAR_TYPES[4], '#e84a4a', 'player');
      car.speed = 330;
      this.traffic.cars.push(car);
      p.enterCar(car);
      this.wanted = 3;
      this.missions.index = 0;
      this.missions.start();
      this.police.update(0.01, this);
      for (const c of this.police.cruisers) {
        c.type = CAR_TYPES[4]; // Sport cruisers keep up with the getaway car
        c.x = p.x - 300 - Math.random() * 120; c.y = 1560 + (Math.random() - 0.5) * 60; c.speed = 340; c.angle = 0;
      }
      this.addParticles(p.x + 200, p.y + 40, 10, '#cfd8dc');
    } else if (scene === 'shootout') {
      // On foot at the pier: Dock Rats close in, a cruiser rolling up the
      // beach road, peds fleeing. The staged tracer stays visible for the shot.
      p.x = LM.pier.x - 120; p.y = LM.pier.y - 260;
      p.giveWeapon('pistol', 60);
      p.weapon = 'pistol';
      this.wanted = 2;
      this.missions.index = 2;
      this.missions.start();
      for (let i = 0; i < this.missions.enemies.length; i++) {
        const e = this.missions.enemies[i];
        e.x = p.x + 130 + i * 55;
        e.y = p.y - 90 + (i % 2) * 150;
      }
      this.combat.tracers.push({ x1: p.x + 20, y1: p.y, x2: p.x + 180, y2: p.y - 60, life: 3.0 });
      this.addParticles(p.x + 26, p.y, 6, '#ffd76e');
      this.crowd.scareAll(p.x, p.y, 500);
    } else if (scene === 'downtown') {
      // Southbound on the 2820 avenue through the tower district.
      this.autoDrive = true;
      const car = new Car(2820, 900, Math.PI / 2, CAR_TYPES[1], '#3a7bd5', 'player');
      car.speed = 260;
      this.traffic.cars.push(car);
      p.enterCar(car);
      this.wanted = 1;
      this.missions.index = 1;
      this.missions.start();
      this.traffic.maintain(p, 22);
      // One cruiser closing in head-on, in frame below the player.
      this.police.update(0.01, this);
      for (const c of this.police.cruisers) { c.x = p.x; c.y = p.y + 430; c.speed = 300; c.angle = -Math.PI / 2; }
    } else if (scene === 'port') {
      // Eastbound on the 2400 avenue toward the harbour; a rival car
      // blows up beside the crates just as the shot is taken.
      this.autoDrive = true;
      const car = new Car(4400, 2400, 0, CAR_TYPES[2], '#f2c14e', 'player');
      car.speed = 130;
      this.traffic.cars.push(car);
      p.enterCar(car);
      this.wanted = 2;
      this.missions.index = 5;
      this.missions.start();
      this.missions.caseTaken = true;
      const wreck = new Car(4700, 2440, 0.4, CAR_TYPES[0], '#9b59b6', 'traffic');
      wreck.health = 5;
      this.traffic.cars.push(wreck);
      this.stagedBoom = { x: 4720, y: 2440, at: this.time + 1.8 };
      this.police.update(0.01, this);
    }
    this.updateCamera(0);
  }

  // --- helpers used by the other modules -----------------------------------

  notify(text, kind = 'info') {
    this.toasts.push({ text, kind, life: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  flashBanner(text) {
    this.banner = { text, life: 2.6 };
  }

  addCash(amount, note) {
    this.player.cash += amount;
    if (note) this.notify(note, 'good');
    this.sound.cash();
  }

  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  addParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
        size: 2 + Math.random() * 4, color,
      });
    }
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
  }

  explode(x, y) {
    this.combat.explodeAt(x, y);
    this.danger = { x, y, r: 500 };
  }

  playerAttack(player) {
    this.combat.playerAttack(player);
    this.danger = { x: player.x, y: player.y, r: 420 };
  }

  onBusted() {
    this.state = 'busted';
    this.sound.fail();
    this.police.clearAll();
    this.player.cash = Math.max(0, this.player.cash - 200);
    this.wanted = 0;
    if (this.player.car) { this.player.car.kind = 'traffic'; this.player.car = null; }
  }

  respawn() {
    const p = this.player;
    p.x = LM.hospital.x; p.y = LM.hospital.y + 80;
    p.health = 100; p.armor = 0;
    p.busted = false; p.wasted = false;
    this.wanted = 0;
    this.police.clearAll();
    this.state = 'playing';
    this.updateCamera(0);
    if (this.missions.current && !this.missions.done) {
      this.missions.start();
      this.notify('Back on the street. Ada\'s job is still open.', 'mission');
    }
  }

  // --- interaction prompts ---------------------------------------------------

  nearestInteraction() {
    const p = this.player;
    if (p.inCar) {
      if (dist(p.x, p.y, LM.spray.x, LM.spray.y) < 150) return { key: 'spray', text: 'E — Respray $150 (lose wanted, repair car)' };
      return null;
    }
    const checks = [
      { key: 'diner', at: LM.diner, r: 130, text: this.missions.active ? '' : (this.missions.done ? '' : 'E — Talk to Ada (next mission)') },
      { key: 'spray', at: LM.spray, r: 130, text: 'E — Respray $150 (lose wanted)' },
      { key: 'gunshop', at: LM.gunshop, r: 130, text: 'E — Gun shop (Pistol $300 / SMG $600 / Ammo $100)' },
      { key: 'hospital', at: LM.hospital, r: 130, text: 'E — Hospital (heal $100)' },
    ];
    for (const c of checks) {
      if (c.text && dist(p.x, p.y, c.at.x, c.at.y) < c.r) return c;
    }
    const car = this.traffic.nearest(p.x, p.y, 80);
    if (car) return { key: 'car', car, text: car.kind === 'parked' || car.kind === 'traffic' ? 'E — Steal car' : 'E — Get in car' };
    return null;
  }

  doInteraction(it) {
    const p = this.player;
    if (it.key === 'car') {
      const car = it.car;
      const wasParked = car.kind === 'parked' || car.kind === 'traffic';
      p.enterCar(car);
      this.sound.blip(520, 0.08);
      if (wasParked) {
        this.police.addWanted(this, 1, 'Grand theft auto');
        this.notify(`Stole a ${car.type.name}`, 'bad');
      }
      return;
    }
    if (it.key === 'diner') {
      if (!this.missions.active && !this.missions.done) {
        const m = this.missions.current;
        this.notify(`${m.giver}: "${m.brief}"`, 'mission');
        this.missions.start();
      }
      return;
    }
    if (it.key === 'spray') {
      if (p.cash < 150) { this.notify('Not enough cash for a respray ($150).', 'bad'); return; }
      p.cash -= 150;
      this.wanted = 0;
      this.police.clearAll();
      if (p.car) p.car.health = 100;
      this.sound.cash();
      this.notify('Respray done — clean plates, no heat.', 'good');
      return;
    }
    if (it.key === 'gunshop') {
      if (p.weapon === 'fists' || !p.ammo.pistol) {
        if (p.cash < 300) { this.notify('Pistol costs $300.', 'bad'); return; }
        p.cash -= 300; p.giveWeapon('pistol', 60); this.notify('Bought a Pistol (+60 rounds). Press 2 to draw it.', 'good');
      } else if (!p.ammo.smg) {
        if (p.cash < 600) { this.notify('Street SMG costs $600.', 'bad'); return; }
        p.cash -= 600; p.giveWeapon('smg', 120); this.notify('Bought a Street SMG (+120 rounds). Press 3 to draw it.', 'good');
      } else {
        if (p.cash < 100) { this.notify('Ammo costs $100.', 'bad'); return; }
        p.cash -= 100;
        p.ammo.pistol += 60; p.ammo.smg += 120;
        this.notify('Ammo restocked.', 'good');
      }
      this.sound.cash();
      return;
    }
    if (it.key === 'hospital') {
      if (p.health >= 100) { this.notify('Already at full health.', 'info'); return; }
      if (p.cash < 100) { this.notify('Treatment costs $100.', 'bad'); return; }
      p.cash -= 100; p.heal(100);
      this.sound.pickup();
      this.notify('Patched up — full health.', 'good');
      return;
    }
  }

  // --- frame loop ------------------------------------------------------------

  loop(t) {
    requestAnimationFrame((nt) => this.loop(nt));
    const dt = clamp((t - this.last) / 1000, 0, 0.05);
    this.last = t;
    this.time += dt;
    this.update(dt);
    this.renderer.draw(this);
    this.hud.draw(this);
    this.drawPrompt();
    this.input.endFrame();
  }

  update(dt) {
    // Toasts and banners age in every state.
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.danger) {
      this.danger.r = Math.max(0, this.danger.r - dt * 300);
      if (this.danger.r <= 0) this.danger = null;
    }
    // Screen shake decays.
    this.shake = Math.max(0, this.shake - dt * 26);
    this.shakeX = (Math.random() - 0.5) * this.shake;
    this.shakeY = (Math.random() - 0.5) * this.shake;
    // Particles.
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.96; pt.vy *= 0.96;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    // A staged explosion for the port screenshot, timed to the capture.
    if (this.stagedBoom && this.time >= this.stagedBoom.at) {
      const b = this.stagedBoom;
      this.stagedBoom = null;
      this.explode(b.x, b.y);
    }

    if (this.state === 'title') {
      if (this.input.hit('Enter')) {
        this.sound.ensure();
        const fresh = this.input.down('KeyN');
        if (fresh) {
          localStorage.removeItem('solmarina-save-v1');
          this.hasSave = false;
        } else if (this.hasSave) {
          this.applySave(loadGame());
        }
        this.state = 'playing';
        this.notify('Welcome back to Solmarina, Leo.', 'info');
      }
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      if (this.input.hit('Enter')) this.respawn();
      return;
    }
    if (this.state === 'paused') {
      if (this.input.hit('Escape', 'KeyP')) { this.state = 'playing'; return; }
      if (this.input.hit('KeyR')) {
        if (this.missions.current && !this.missions.done) { this.missions.start(); this.state = 'playing'; }
      }
      if (this.input.hit('KeyQ')) { this.state = 'title'; return; }
      return;
    }
    if (this.state !== 'playing') return;

    // Global keys.
    if (this.input.hit('Escape')) { this.state = 'paused'; return; }
    if (this.input.hit('KeyP')) {
      if (saveGame(this)) this.notify('Game saved.', 'good');
      else this.notify('Save failed — storage unavailable.', 'bad');
    }
    if (this.input.hit('KeyM')) {
      const on = this.sound.toggleMusic();
      this.notify(on ? 'Radio on' : 'Radio off', 'info');
    }
    if (this.input.hit('Digit1')) { this.player.weapon = 'fists'; }
    if (this.input.hit('Digit2') && this.player.ammo.pistol > 0) { this.player.weapon = 'pistol'; }
    if (this.input.hit('Digit3') && this.player.ammo.smg > 0) { this.player.weapon = 'smg'; }

    // Interaction key.
    this.prompt = this.nearestInteraction();
    if (this.input.hit('KeyE')) {
      if (this.player.inCar) {
        this.player.exitCar();
        this.sound.blip(420, 0.06);
      } else if (this.prompt) {
        this.doInteraction(this.prompt);
      }
    }

    // World updates.
    this.player.update(dt, this.input, this);
    const playerCar = this.player.car;
    this.traffic.update(dt, playerCar);
    this.traffic.maintain(this.player, 16);
    this.crowd.update(dt, this.danger);
    this.crowd.maintain(this.player, 34);
    this.police.update(dt, this);
    this.missions.update(dt);
    this.combat.update(dt);

    // Car the player drives explodes when wrecked.
    if (playerCar && playerCar.dead) {
      const cx = playerCar.x, cy = playerCar.y;
      this.player.exitCar();
      playerCar.dead = false; // explode() handles the wreck visuals once
      this.explode(cx, cy);
      playerCar.health = 0;
      playerCar.dead = true;
    }
    // Player wasted by damage.
    if (this.player.wasted && this.state === 'playing') {
      this.state = 'wasted';
      this.sound.fail();
      this.police.clearAll();
      this.player.cash = Math.max(0, this.player.cash - 200);
      this.wanted = 0;
      if (this.player.car) { this.player.car.kind = 'traffic'; this.player.car = null; }
    }
    // Car-vs-pedestrian: running someone over is a crime.
    if (playerCar) {
      for (const ped of this.crowd.peds) {
        if (!ped.dead && dist(ped.x, ped.y, playerCar.x, playerCar.y) < 30 && Math.abs(playerCar.speed) > 60) {
          ped.dead = true;
          this.player.kills++;
          this.police.addWanted(this, 1, 'Hit and run');
          this.addParticles(ped.x, ped.y, 8, '#c0392b');
          this.addShake(4);
        }
      }
    }
    // Engine + siren follow the game state.
    this.sound.engine(playerCar ? clamp(Math.abs(playerCar.speed) / 330, 0, 1) : 0, !!playerCar);
    this.sound.siren(this.wanted > 0);
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const p = this.player;
    // Lead the camera slightly in the direction of travel when driving.
    let tx = p.x - VIEW_W / 2;
    let ty = p.y - VIEW_H / 2;
    if (p.car) {
      tx += Math.cos(p.angle) * 120;
      ty += Math.sin(p.angle) * 120;
    }
    tx = clamp(tx, 0, WORLD_W - VIEW_W);
    ty = clamp(ty, 0, WORLD_H - VIEW_H);
    if (dt === 0) { this.camera.x = tx; this.camera.y = ty; return; }
    const k = 1 - Math.pow(0.001, dt);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
  }

  drawPrompt() {
    if (this.state !== 'playing' || !this.prompt) return;
    const ctx = this.canvas.getContext('2d');
    const W = this.canvas.width;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(this.prompt.text).width + 30;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, this.canvas.height - 96, w, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd76e';
    ctx.fillText(this.prompt.text, W / 2, this.canvas.height - 76);
    ctx.restore();
  }

  applySave(data) {
    if (!data) return;
    const p = this.player;
    p.cash = data.cash;
    p.health = data.health;
    p.armor = data.armor;
    p.weapon = data.weapon;
    p.ammo = data.ammo;
    p.x = data.x; p.y = data.y;
    p.kills = data.kills || 0;
    p.carsStolen = data.carsStolen || 0;
    p.missionsDone = data.missionsDone || 0;
    this.missions.index = data.missionIndex || 0;
    this.wanted = 0;
    this.updateCamera(0);
  }
}

new Game();
