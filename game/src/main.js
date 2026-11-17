// main.js — Solmarina: the game object that ties every module together.
// Owns the loop, the camera, the world state (wanted level, toasts,
// particles), the player's interactions with the city (stealing cars and
// helicopters, the spray shop, the two shops, Ada's diner) and the staged
// scenes used for screenshots. Everything the other modules call back into
// lives here.
//
// PIXEL ART: the world renders into a 480x270 buffer (Renderer) and the HUD
// draws into the same buffer; one nearest-neighbour blit puts it on the
// screen. The camera therefore shows 960x540 world units, and the mouse
// aim converts through screenToWorld().

import { Input } from './input.js';
import { Sound } from './audio.js';
import { Renderer, VIEW_W, VIEW_H } from './render.js';
import { HUD } from './hud.js';
import { Player } from './player.js';
import { Traffic, Car, CAR_TYPES } from './vehicles.js';
import { Police } from './police.js';
import { Crowd } from './pedestrians.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Heli } from './heli.js';
import { Shops, SHOP_DEFS } from './shops.js';
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
    this.hud = new HUD(this.renderer.buf);
    this.player = new Player(LANDMARKS.diner.x, 1980);
    this.traffic = new Traffic();
    this.police = new Police();
    this.crowd = new Crowd();
    this.combat = new Combat(this);
    this.missions = new Missions(this);
    this.shops = new Shops(this);
    this.helis = [new Heli(LANDMARKS.helipad.x, LANDMARKS.helipad.y, 0, 'parked')];

    // Re-exported so missions.js can build the marked car for Hot Wheels.
    this.CarClass = Car;
    this.CarTypes = CAR_TYPES;

    this.state = 'title'; // title | playing | paused | gameover
    this.overText = { title: '', sub: '' };
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
    this.autoFly = false; // staged heli scenes fly themselves
    this.demoFire = false; // staged shootout scenes fire at the nearest foe
    this.demoFireCd = 0;
    this.hasSave = hasSave();
    this.muted = false;
    this.shopPrompt = null; // the shop def near the player, or null
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

  // Screen (canvas) pixels -> world units, through the 960x540 pixel view.
  screenToWorld(sx, sy) {
    return {
      x: this.camera.x + sx * (VIEW_W / this.canvas.width),
      y: this.camera.y + sy * (VIEW_H / this.canvas.height),
    };
  }

  // Staged scenes (?scene=heli|heist|shop|chase) put the game straight into
  // a photogenic moment so screenshots show several systems at once.
  // No scene: the title screen shows and the player starts normally.
  applyScene(scene) {
    if (!scene) return;
    const p = this.player;
    this.state = 'playing';
    this.missions.index = 0;
    if (scene === 'chase') {
      const car = new Car(2600, 1140, 0, CAR_TYPES[1], '#e84a4a', 'player');
      this.traffic.cars.push(car);
      p.enterCar(car);
      this.wanted = 3;
      this.autoDrive = true;
      this.missions.start();
      for (const [cx, cy] of [[2280, 1140], [2130, 1224]]) {
        const cruiser = new Car(cx, cy, 0, CAR_TYPES[1], '#1c2733', 'police');
        cruiser.speed = 280;
        this.police.cruisers.push(cruiser);
      }
    } else if (scene === 'heli') {
      // Leo already in the air over the beach, the PD heli closing in.
      const heli = this.helis[0];
      heli.x = 3600; heli.y = 3850; heli.angle = -Math.PI / 2;
      heli.alt = 0.7; heli.speed = 300;
      p.enterHeli(heli);
      this.wanted = 4;
      this.autoFly = true;
      this.missions.index = 5;
      this.missions.start();
    } else if (scene === 'heist') {
      p.x = 4660; p.y = 2560;
      p.giveWeapon('smg', 120);
      this.wanted = 4;
      this.missions.index = 6;
      this.missions.start();
      this.demoFire = true;
    } else if (scene === 'shop') {
      p.x = 3500; p.y = 2980;
      p.cash = 1500;
      this.missions.start();
      this.shops.open(SHOP_DEFS[0]);
    }
    this.snapCamera();
  }

  snapCamera() {
    this.camera.x = clamp(this.player.x - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W));
    this.camera.y = clamp(this.player.y - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
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
      this.renderer.drawWorld(this);
      this.hud.draw(this);
      this.renderer.present();
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
      this.shops = new Shops(this);
      this.helis = [new Heli(LANDMARKS.helipad.x, LANDMARKS.helipad.y, 0, 'parked')];
      this.toasts = [];
      this.banner = null;
      this.particles = [];
      this.autoDrive = false;
      this.autoFly = false;
      this.demoFire = false;
      this.shopPrompt = null;
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
    if (data.weapon) p.weapon = data.weapon;
    if (data.ammo) p.ammo = data.ammo;
    this.missions.index = data.missionIndex ?? 0;
    this.wanted = data.wanted ?? 0;
  }

  // --- per-frame update ----------------------------------------------------

  update(dt) {
    this.updateShopPrompt();
    // The shop pauses the world while it is open — no drive-bys while
    // you browse. Only toasts and the banner keep ticking.
    if (this.shops.isOpen) {
      this.updateToasts(dt);
      this.updateBanner(dt);
      return;
    }
    this.handleInteract();
    this.player.update(dt, this.input, this);
    this.checkPlayerCarWreck();
    this.checkPlayerHeliWreck();
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
    this.sound.rotor(this.player.alt);
    this.sound.siren(this.wanted > 0);
    if (this.player.wasted) this.onWasted();
  }

  updateShopPrompt() {
    const p = this.player;
    if (p.inCar || p.inHeli || this.shops.isOpen) {
      this.shopPrompt = null;
      return;
    }
    this.shopPrompt = SHOP_DEFS.find((s) => dist(p.x, p.y, s.x, s.y) < 110) || null;
  }

  handleGlobalKeys() {
    const input = this.input;
    if (this.state === 'title') {
      if (input.hit('Enter')) this.startGame(false);
      if (input.hit('KeyN')) this.startGame(true);
      return;
    }
    if (this.state === 'gameover') {
      if (input.hit('Enter')) this.respawnAfterArrest();
      return;
    }
    // Shop open: number keys buy, arrows pick, Enter buys, B/Esc closes.
    if (this.shops.isOpen) {
      const items = this.shops.openShop.items;
      if (input.hit('Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6')) {
        const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']
          .findIndex((c) => input.hit(c));
        this.shops.buy(n);
      }
      if (input.hit('ArrowDown')) this.shops.selected = (this.shops.selected + 1) % items.length;
      if (input.hit('ArrowUp')) this.shops.selected = (this.shops.selected - 1 + items.length) % items.length;
      if (input.hit('Enter')) this.shops.buy(this.shops.selected);
      if (input.hit('KeyB', 'Escape')) this.shops.close();
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
    if (input.hit('KeyL')) {
      this.muted = !this.muted;
      this.sound.setMuted(this.muted);
      this.notify(this.muted ? 'Sound muted.' : 'Sound on.', 'info');
    }
    if (input.hit('KeyB') && this.shopPrompt) {
      this.shops.open(this.shopPrompt);
      return;
    }
    if (input.hit('Digit1')) this.switchWeapon('fists');
    if (input.hit('Digit2')) this.switchWeapon('pistol');
    if (input.hit('Digit3')) this.switchWeapon('smg');
  }

  switchWeapon(name) {
    const p = this.player;
    if (name === 'fists') { p.weapon = 'fists'; return; }
    if ((p.ammo[name] ?? 0) > 0 || p.weapon === name) p.weapon = name;
    else this.notify(`No ${name} ammo — find a pickup or buy some.`, 'info');
  }

  // E: get out of a car/heli, climb into a car/heli, open a shop, use the
  // spray shop, or take Ada's next job at the diner.
  handleInteract() {
    if (!this.input.hit('KeyE')) return;
    const p = this.player;
    if (p.inHeli) {
      if (p.exitHeli()) this.notify('Out of the heli.', 'info');
      else this.notify('Too high to bail out — descend first.', 'bad');
      return;
    }
    if (p.inCar) {
      p.exitCar();
      return;
    }
    const heli = this.helis.find((h) => !h.dead && dist(p.x, p.y, h.x, h.y) < 80);
    if (heli) {
      p.enterHeli(heli);
      this.sound.pickup();
      this.police.addWanted(this, 1, 'Grand theft helicopter');
      this.notify('Stole the helicopter — the PD noticed.', 'bad');
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
    if (this.shopPrompt) {
      this.shops.open(this.shopPrompt);
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
    if (!this.demoFire || this.player.inCar || this.player.inHeli) return;
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

  // When the player's heli is shot down it blows up, and Leo falls out
  // where it went down — hurt, but alive if he had the health.
  checkPlayerHeliWreck() {
    const heli = this.player.heli;
    if (!heli || !heli.dead) return;
    this.explode(heli.x, heli.y);
    this.player.x = heli.x;
    this.player.y = heli.y;
    this.player.angle = heli.angle;
    this.player.heli = null;
    this.player.damage(45);
    this.notify('Your heli went down!', 'bad');
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
    const p = this.player;
    const look = p.inCar ? 130 : p.inHeli ? 100 : 60;
    const tx = clamp(p.x + Math.cos(p.angle) * look - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W));
    const ty = clamp(p.y + Math.sin(p.angle) * look - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
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
    this.finishArrest('BUSTED', `The PD kept $${fine}. Back on the street — do not get caught again.`);
  }

  onWasted() {
    const fine = Math.min(SAVE_FINE, this.player.cash);
    this.player.cash -= fine;
    this.player.wasted = false;
    this.finishArrest('WASTED', `The hospital kept $${fine}. Patched up and back on the street.`);
  }

  finishArrest(title, sub) {
    this.wanted = 0;
    this.police.clearAll();
    this.player.health = 100;
    this.player.armor = 0;
    if (this.player.car) this.player.exitCar();
    if (this.player.heli) this.player.heli = null;
    this.player.x = 1300;
    this.player.y = 980;
    this.overText = { title, sub };
    this.state = 'gameover';
    this.sound.fail();
    this.notify(`${title} — ${sub}`, 'bad');
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
