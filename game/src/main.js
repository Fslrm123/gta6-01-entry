// main.js — Solmarina: the game object that ties every module together.
// Owns the loop, the camera, the world state (cash, wanted level, toasts,
// particles), the player's interactions with the city (stealing cars, the
// spray shop, Ada's diner) and the staged scenes used for screenshots.
// Everything the other modules call back into lives here.

import { Input } from './input.js';
import { Sound } from './audio.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { Player } from './player.js';
import { Traffic, Car, CAR_TYPES } from './vehicles.js';
import { Police } from './police.js';
import { Crowd } from './pedestrians.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { CITY, WORLD_W, WORLD_H, LANDMARKS } from './city.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { clamp, dist } from './utils.js';

const SAVE_FINE = 200; // cash the PD keeps after a bust or a hospital trip
const RESPRAY_PRICE = 150;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.sound = new Sound();
    this.renderer = new Renderer(canvas);
    this.hud = new HUD(canvas);
    this.player = new Player(LANDMARKS.diner.x, 1980);
    this.traffic = new Traffic();
    this.police = new Police();
    this.crowd = new Crowd();
    this.combat = new Combat(this);
    this.missions = new Missions(this);

    // Re-exported so missions.js can build the marked car for Hot Wheels.
    this.CarClass = Car;
    this.CarTypes = CAR_TYPES;

    this.state = 'title'; // title | playing | paused | busted | wasted
    this.time = 0;
    this.wanted = 0;
    this.camera = { x: 0, y: 0 };
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeMag = 0;
    this.toasts = [];
    this.banner = null;
    this.particles = [];
    this.autoDrive = false; // staged driving scenes steer themselves
    this.demoFire = false; // staged shootout scenes fire at the nearest foe
    this.demoFireCd = 0;
    this.hasSave = hasSave();
    this.lastTime = 0;
    this.prevMissionActive = false;
    this.prevMissionIndex = 0;
    this.nextMissionIn = 0;
    this.lastShotAt = -10;

    this.traffic.spawnInitial(18, { x: this.player.x, y: this.player.y });
    this.crowd.spawnInitial(34, { x: this.player.x, y: this.player.y });
    this.applyScene(new URLSearchParams(window.location.search).get('scene'));
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
    window.__solmarina = this;
  }

  // --- setup ---------------------------------------------------------------

  fitCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Staged scenes (?scene=chase|shootout|downtown|port) put the game straight
  // into a photogenic moment so screenshots show several systems at once.
  // No scene: the title screen shows and the player starts normally.
  applyScene(scene) {
    if (!scene) return;
    const p = this.player;
    this.state = 'playing';
    this.missions.index = 0;
    if (scene === 'chase' || scene === 'downtown') {
      const spot = scene === 'chase'
        ? { x: 2600, y: 1140, angle: 0, type: CAR_TYPES[1] }
        : { x: 3000, y: 720, angle: 0, type: CAR_TYPES[0] };
      const car = new Car(spot.x, spot.y, spot.angle, spot.type, '#e84a4a', 'player');
      this.traffic.cars.push(car);
      p.enterCar(car);
      this.wanted = scene === 'chase' ? 3 : 1;
      this.autoDrive = true;
      this.missions.start();
      // Park cruisers just behind the player, on the same avenue, so the
      // frame shows the chase instead of an empty road behind. The police
      // update keeps them (they count toward the wanted level's units) and
      // they close in at their own top speed without ramming yet.
      const cruiserSpots = scene === 'chase'
        ? [[spot.x - 320, spot.y], [spot.x - 470, spot.y + 84]]
        : [[spot.x - 360, spot.y + 44]];
      for (const [cx, cy] of cruiserSpots) {
        const cruiser = new Car(cx, cy, 0, CAR_TYPES[1], '#1c2733', 'police');
        cruiser.speed = 280;
        this.police.cruisers.push(cruiser);
      }
    } else if (scene === 'shootout') {
      p.x = 4660; p.y = 2560;
      p.giveWeapon('pistol', 120);
      this.wanted = 2;
      this.missions.index = 2;
      this.missions.start();
      this.demoFire = true;
    } else if (scene === 'port') {
      p.x = 4700; p.y = 2660;
      p.giveWeapon('smg', 120);
      this.wanted = 2;
      this.missions.index = 2;
      this.missions.start();
      this.demoFire = true;
    }
    this.snapCamera();
  }

  snapCamera() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.camera.x = clamp(this.player.x - W / 2, 0, Math.max(0, WORLD_W - W));
    this.camera.y = clamp(this.player.y - H / 2, 0, Math.max(0, WORLD_H - H));
  }

  // --- starting / stopping -------------------------------------------------

  start() {
    this.lastTime = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
      this.lastTime = now;
      this.handleGlobalKeys();
      if (this.state === 'playing') this.update(dt);
      this.time += dt;
      this.renderer.draw(this);
      this.hud.draw(this);
      this.input.endFrame();
      if (!window.__solmarinaReady) window.__solmarinaReady = true;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  startGame(fresh) {
    if (fresh) {
      this.player = new Player(LANDMARKS.diner.x, 1980);
      this.wanted = 0;
      this.missions = new Missions(this);
      this.police.clearAll();
      this.combat = new Combat(this);
      this.toasts = [];
      this.banner = null;
      this.particles = [];
      this.autoDrive = false;
      this.demoFire = false;
    } else if (this.hasSave) {
      this.applySave(loadGame());
    }
    this.state = 'playing';
    this.sound.ensure();
    this.snapCamera();
    this.notify('Welcome to Solmarina — Ada is waiting at the diner.', 'info');
    if (!this.missions.started) this.missions.start();
  }

  applySave(data) {
    if (!data) return;
    const p = this.player;
    p.cash = data.cash ?? p.cash;
    p.health = data.health ?? 100;
    p.armor = data.armor ?? 0;
    p.x = data.x ?? p.x;
    p.y = data.y ?? p.y;
    p.kills = data.kills ?? 0;
    p.carsStolen = data.carsStolen ?? 0;
    p.missionsDone = data.missionsDone ?? 0;
    if (data.weapon && data.weapon !== 'fists') {
      p.giveWeapon(data.weapon, 0);
      if (data.ammo) p.ammo = data.ammo;
    }
    this.missions.index = data.missionIndex ?? 0;
    this.wanted = data.wanted ?? 0;
  }

  // --- per-frame update ----------------------------------------------------

  update(dt) {
    this.handleInteract();
    this.player.update(dt, this.input, this);
    this.checkPlayerCarWreck();
    this.traffic.update(dt, this.player.car);
    this.traffic.maintain({ x: this.player.x, y: this.player.y });
    const danger = this.player.inCar && Math.abs(this.player.car.speed) > 160
      ? { x: this.player.x, y: this.player.y, r: 260 }
      : null;
    this.crowd.update(dt, danger);
    this.crowd.maintain({ x: this.player.x, y: this.player.y });
    this.police.update(dt, this);
    this.combat.update(dt);
    this.missions.update(dt);
    this.updateMissionAutoStart(dt);
    this.updateDemoFire(dt);
    this.updateParticles(dt);
    this.updateToasts(dt);
    this.updateBanner(dt);
    this.updateCamera(dt);
    this.shakeMag = Math.max(0, this.shakeMag - dt * 26);
    this.shakeX = (Math.random() - 0.5) * this.shakeMag;
    this.shakeY = (Math.random() - 0.5) * this.shakeMag;
    this.sound.engine(this.player.inCar ? Math.abs(this.player.car.speed) / 400 : 0, this.player.inCar);
    this.sound.siren(this.wanted > 0);
    if (this.player.wasted) this.onWasted();
  }

  handleGlobalKeys() {
    const input = this.input;
    if (this.state === 'title') {
      if (input.hit('Enter')) this.startGame(false);
      if (input.hit('KeyN')) this.startGame(true);
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      if (input.hit('Enter')) this.respawnAfterArrest();
      return;
    }
    if (input.hit('Escape')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      return;
    }
    if (this.state === 'paused') {
      if (input.hit('KeyR')) {
        this.state = 'playing';
        this.missions.retry();
      }
      if (input.hit('KeyQ')) {
        this.state = 'title';
        this.hasSave = hasSave();
      }
      return;
    }
    if (input.hit('KeyP')) {
      const ok = saveGame(this);
      this.notify(ok ? 'Game saved.' : 'Save failed.', ok ? 'good' : 'bad');
    }
    if (input.hit('KeyM')) {
      const on = this.sound.toggleMusic();
      this.notify(on ? 'Radio on.' : 'Radio off.', 'info');
    }
    if (input.hit('Digit1')) this.switchWeapon('fists');
    if (input.hit('Digit2')) this.switchWeapon('pistol');
    if (input.hit('Digit3')) this.switchWeapon('smg');
  }

  switchWeapon(name) {
    const p = this.player;
    if (name === 'fists') { p.weapon = 'fists'; return; }
    if ((p.ammo[name] ?? 0) > 0 || p.weapon === name) p.weapon = name;
    else this.notify(`No ${name} ammo — find a pickup.`, 'info');
  }

  // E: get in / out of a car, use the spray shop, or take Ada's next job.
  handleInteract() {
    if (!this.input.hit('KeyE')) return;
    const p = this.player;
    if (p.inCar) {
      p.exitCar();
      return;
    }
    const near = this.traffic.nearest(p.x, p.y, 95);
    if (near) {
      const wasParked = near.kind === 'parked' || near.kind === 'traffic';
      p.enterCar(near);
      this.sound.pickup();
      if (wasParked) {
        this.police.addWanted(this, 1, 'Grand theft auto');
        this.notify(`Stole a ${near.type.name} — the PD noticed.`, 'bad');
      }
      return;
    }
    if (dist(p.x, p.y, LANDMARKS.spray.x, LANDMARKS.spray.y) < 130) {
      if (this.wanted > 0 && p.cash >= RESPRAY_PRICE) {
        p.cash -= RESPRAY_PRICE;
        this.wanted = 0;
        this.police.clearAll();
        this.sound.cash();
        this.notify(`Respray done — clean plates, no heat. (-$${RESPRAY_PRICE})`, 'good');
      } else if (this.wanted > 0) {
        this.notify(`Respray costs $${RESPRAY_PRICE} — you are short.`, 'bad');
      } else {
        this.notify('No heat to lose — you are clean.', 'info');
      }
      return;
    }
    if (dist(p.x, p.y, LANDMARKS.diner.x, LANDMARKS.diner.y) < 150) {
      if (!this.missions.active && !this.missions.done) {
        this.missions.start();
      }
    }
  }

  // A mission that just finished queues the next one; a failed mission waits
  // for the player to come back to Ada at the diner.
  updateMissionAutoStart(dt) {
    const m = this.missions;
    if (this.prevMissionActive && !m.active && m.index !== this.prevMissionIndex && !m.done) {
      this.nextMissionIn = 3;
    }
    if (!m.active && !m.done && m.started && this.nextMissionIn > 0) {
      this.nextMissionIn -= dt;
      if (this.nextMissionIn <= 0) m.start();
    }
    this.prevMissionActive = m.active;
    this.prevMissionIndex = m.index;
  }

  // Staged shootout scenes keep firing at the nearest foe so the frame
  // always shows tracers, muzzle flash and the fight.
  updateDemoFire(dt) {
    if (!this.demoFire || this.player.inCar) return;
    this.demoFireCd -= dt;
    if (this.demoFireCd > 0) return;
    const foes = this.missions.enemies.filter((e) => !e.dead);
    if (!foes.length) { this.demoFireCd = 0.5; return; }
    let best = foes[0];
    let bd = Infinity;
    for (const e of foes) {
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    this.player.angle = Math.atan2(best.y - this.player.y, best.x - this.player.x);
    if (this.player.weapon !== 'fists' && (this.player.ammo[this.player.weapon] ?? 0) > 0) {
      this.player.ammo[this.player.weapon]--;
      this.player.shotsFired++;
      this.playerAttack(this.player);
    }
    this.demoFireCd = 0.45;
  }

  // When the player's ride is wrecked it blows up exactly once, then the
  // player is thrown clear onto the street.
  checkPlayerCarWreck() {
    const car = this.player.car;
    if (!car || !car.dead || car.wreckBlown) return;
    car.wreckBlown = true;
    this.player.exitCar();
    this.explode(car.x, car.y);
    this.notify('Your car blew up!', 'bad');
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.2, dt);
      pt.vy *= Math.pow(0.2, dt);
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  updateToasts(dt) {
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
  }

  updateBanner(dt) {
    if (!this.banner) return;
    this.banner.life -= dt;
    if (this.banner.life <= 0) this.banner = null;
  }

  updateCamera(dt) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const p = this.player;
    const look = p.inCar ? 130 : 60;
    const tx = clamp(p.x + Math.cos(p.angle) * look - W / 2, 0, Math.max(0, WORLD_W - W));
    const ty = clamp(p.y + Math.sin(p.angle) * look - H / 2, 0, Math.max(0, WORLD_H - H));
    const k = 1 - Math.pow(0.001, dt);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
  }

  // --- callbacks used by the other modules ---------------------------------

  notify(text, kind = 'info') {
    this.toasts.push({ text, kind, life: 4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  flashBanner(text) {
    this.banner = { text, life: 2.6 };
  }

  addShake(amount) {
    this.shakeMag = Math.min(16, this.shakeMag + amount);
  }

  addParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
        size: 2 + Math.random() * 4, color,
      });
    }
  }

  addCash(amount, message) {
    this.player.cash += amount;
    if (message) this.notify(message, 'good');
  }

  explode(x, y) {
    this.combat.explodeAt(x, y);
  }

  playerAttack(player) {
    this.lastShotAt = this.time;
    this.combat.playerAttack(player);
  }

  onBusted() {
    const fine = Math.min(SAVE_FINE, this.player.cash);
    this.player.cash -= fine;
    this.finishArrest('busted', `Busted — the PD kept $${fine}.`);
  }

  onWasted() {
    const fine = Math.min(SAVE_FINE, this.player.cash);
    this.player.cash -= fine;
    this.player.wasted = false;
    this.finishArrest('wasted', `Wasted — the hospital kept $${fine}.`);
  }

  finishArrest(state, message) {
    this.wanted = 0;
    this.police.clearAll();
    this.player.health = 100;
    this.player.armor = 0;
    if (this.player.car) this.player.exitCar();
    this.player.x = 1300;
    this.player.y = 980;
    this.state = state;
    this.sound.fail();
    this.notify(message, 'bad');
    this.snapCamera();
  }

  respawnAfterArrest() {
    this.player.busted = false;
    this.player.wasted = false;
    this.state = 'playing';
    this.snapCamera();
  }
}

// --- boot ------------------------------------------------------------------

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
