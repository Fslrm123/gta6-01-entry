// main.js — game loop, screens, interactions, screenshot scenes, debug API. Freshly authored.
import { G, resetState } from './state.js';
import { initInput, keys, mouse, edgePressed } from './input.js';
import { ensureAudio, beep } from './audio.js';
import { updatePlayer, spawnPlayer, respawn, showMessage, showBanner, hurtPlayer } from './player.js';
import { spawnTraffic, updateTraffic, updateDriving, tryEnterCar, exitCar, nearestCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updateWanted, updateCops, wantedStars } from './police.js';
import { ensurePlayerHeli, tryEnterHeli, exitHeli, updateHeli } from './heli.js';
import { updateBullets, updateEnemies, tryAttack, switchWeapon, spawnEnemy } from './combat.js';
import { startMission, updateMission, currentMission, debugCompleteMission, MISSIONS } from './missions.js';
import { openShop, buySelected, useRespray, useSafehouse, useGarage } from './shops.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { LANDMARKS } from './city.js';
import { dist, clamp } from './utils.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawShop, drawDialogue, drawDead, drawWin } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
initInput(canvas);

function seedWorld() {
  spawnTraffic(14);
  spawnPeds(18);
  ensurePlayerHeli();
  G.stashes = [
    { x: 700, y: 500, value: 300, taken: false },
    { x: 1500, y: 1100, value: 500, taken: false },
    { x: 2200, y: 400, value: 750, taken: false },
    { x: 500, y: 1700, value: 400, taken: false },
    { x: 1800, y: 1700, value: 600, taken: false },
  ];
  spawnPlayer(1280, 1500);
}
seedWorld();

function nearestLandmark(maxD) {
  let best = null, bd = maxD;
  for (const [key, lm] of Object.entries(LANDMARKS)) {
    const d = dist(G.player.x, G.player.y, lm.x, lm.y);
    if (d < bd) { bd = d; best = { key, lm }; }
  }
  return best;
}
function doInteract() {
  const p = G.player;
  if (p.heli) { exitHeli(); return; }
  if (p.car) { exitCar(); return; }
  if (tryEnterHeli()) return;
  const lm = nearestLandmark(46);
  if (lm) {
    if (lm.key === 'gunshop') { openShop('gun'); return; }
    if (lm.key === 'market') { openShop('market'); return; }
    if (lm.key === 'respray') { useRespray(); return; }
    if (lm.key === 'safehouse') { useSafehouse(); return; }
    if (lm.key === 'garage') { useGarage(); return; }
  }
  if (tryEnterCar()) return;
  // start next mission
  if (!G.mission && G.missionIndex < 10) { startMission(G.missionIndex); return; }
  showMessage('Nothing to do here — find the yellow marker');
}

function updatePlay() {
  G.time += 1;
  G.clockMin += 0.04;
  if (G.clockMin >= 1440) { G.clockMin -= 1440; G.day += 1; }
  updatePlayer();
  updateDriving();
  updateHeli();
  updateTraffic();
  updatePeds();
  updateWanted();
  updateCops();
  updateBullets();
  updateEnemies();
  updateMission();
  for (const pop of G.popups) pop.t -= 1;
  G.popups = G.popups.filter((x) => x.t > 0);
  if (G.messageT > 0) G.messageT -= 1;
  if (G.banner && G.banner.t > 0) G.banner.t -= 1;
  if (mouse.clicked) { tryAttack(); mouse.clicked = false; }
  if (edgePressed('f')) tryAttack();
  if (edgePressed('1')) switchWeapon(0);
  if (edgePressed('2')) switchWeapon(1);
  if (edgePressed('3')) switchWeapon(2);
  if (edgePressed('e')) doInteract();
  if (edgePressed('b')) {
    const lm = nearestLandmark(60);
    if (lm && lm.key === 'gunshop') openShop('gun');
    else if (lm && lm.key === 'market') openShop('market');
    else showMessage('No shop nearby — look for the $ and M signs');
  }
  if (edgePressed('p')) saveGame();
  if (edgePressed('m')) { G.radioOn = !G.radioOn; G.radio = (G.radio + 1) % 4; }
  if (edgePressed('l')) G.muted = !G.muted;
  if (edgePressed('escape')) { G.screen = 'pause'; }
  // camera follow
  G.cam.x = clamp(G.player.x, 240, 2560 - 240);
  G.cam.y = clamp(G.player.y, 135, 1920 - 135);
}

function render() {
  ctx.clearRect(0, 0, 480, 270);
  if (G.screen === 'title') { drawTitle(ctx); return; }
  drawWorld(ctx);
  if (G.screen === 'play' || G.screen === 'dialogue') drawHUD(ctx);
  if (G.screen === 'dialogue') drawDialogue(ctx);
  else if (G.screen === 'pause') drawPause(ctx);
  else if (G.screen === 'shop') drawShop(ctx);
  else if (G.screen === 'dead') drawDead(ctx);
  else if (G.screen === 'win') drawWin(ctx);
  if (G.stagedDialogue) drawDialogue(ctx);
}

function loop() {
  try {
    if (G.screen === 'play') updatePlay();
    else if (G.screen === 'title') {
      if (edgePressed('enter')) {
        ensureAudio();
        if (hasSave() && G.missionsDone.length === 0) loadGame();
        G.screen = 'play';
        if (!G.mission && G.missionIndex < 10 && G.missionsDone.length === 0) startMission(0);
        else if (!G.mission && G.missionIndex < 10) showMessage('Welcome back — mission ' + (G.missionIndex + 1) + ' awaits');
      }
    } else if (G.screen === 'dialogue') {
      if (edgePressed('enter') || edgePressed('e')) {
        const d = G.dialogue; G.dialogue = null;
        G.screen = 'play';
        if (d && d.onDone) d.onDone();
      }
    } else if (G.screen === 'pause') {
      if (edgePressed('escape') || edgePressed('enter')) G.screen = 'play';
      if (edgePressed('p')) saveGame();
    } else if (G.screen === 'shop') {
      if (edgePressed('escape')) { G.screen = 'play'; G.shop = null; }
      if (edgePressed('arrowup') || edgePressed('w')) { G.shop.sel = (G.shop.sel + G.shop.items.length - 1) % G.shop.items.length; }
      if (edgePressed('arrowdown') || edgePressed('s')) { G.shop.sel = (G.shop.sel + 1) % G.shop.items.length; }
      if (edgePressed('enter')) buySelected();
    } else if (G.screen === 'dead') {
      if (edgePressed('enter')) respawn();
    } else if (G.screen === 'win') {
      if (edgePressed('enter')) { G.screen = 'play'; G.mission = null; }
    }
  } catch (err) {
    console.error('LOOP ERROR', err && err.message);
  }
  render();
  requestAnimationFrame(loop);
}

// ---------- screenshot scene staging (?scene=...) ----------
function stageScene(scene) {
  const q = new URLSearchParams(location.search);
  const seed = Number(q.get('seed') || 1);
  G.testMode = true;
  if (scene === 'heli') {
    G.screen = 'play';
    G.cash = 48250; G.rep = 64; G.health = 82; G.armour = 45;
    G.wanted = 4.6; G.day = 3; G.clockMin = 18 * 60 + 47;
    G.weapons[2].owned = true; G.weapons[2].ammo = 120; G.weapons[1].ammo = 48; G.weapon = 2;
    G.missionIndex = 6; G.missionsDone = [0, 1, 2, 3, 4, 5];
    startMission(6); G.dialogue = null; G.screen = 'play';
    const h = ensurePlayerHeli();
    h.x = 400; h.y = 920; h.z = 62; h.angle = 0; h.speed = 3.0; h.rotor = 1;
    G.player.heli = h; G.player.onFoot = false; G.player.x = h.x; G.player.y = h.y;
    G.nos = 72; G.carCondition = 88;
    updateWanted(); // spawns PD AIR-1 + cops
    G.policeHeli = G.policeHeli || { x: 560, y: 800, z: 90, angle: 0, name: 'PD AIR-1', unit: 'AIR-1' };
    G.banner = { text: 'MISSION 7/10 — HIGH ROLLER', sub: 'Escape the PD dragnet — lose AIR-1 over the causeway', t: 18 };
    showMessage('AIR-1 is painting you with the searchlight — break line of sight!');
  } else if (scene === 'title') {
    G.screen = 'title';
    G.missionsDone = [0, 1, 2, 3, 4]; G.cash = 12480; G.rep = 41;
  } else if (scene === 'heist') {
    G.screen = 'play';
    G.cash = 8930; G.health = 76; G.armour = 60; G.wanted = 3.2; G.day = 2; G.clockMin = 21 * 60 + 5;
    G.weapons[2].owned = true; G.weapons[2].ammo = 96; G.weapons[1].ammo = 30; G.weapon = 2;
    G.missionIndex = 6; G.missionsDone = [0, 1, 2, 3, 4, 5];
    startMission(6); G.dialogue = null; G.screen = 'play';
    spawnPlayer(LANDMARKS.casino.x - 60, LANDMARKS.casino.y + 40);
    spawnEnemy(LANDMARKS.casino.x + 20, LANDMARKS.casino.y - 10, 50, 'GUARD');
    spawnEnemy(LANDMARKS.casino.x + 70, LANDMARKS.casino.y + 30, 50, 'GUARD');
    spawnEnemy(LANDMARKS.casino.x - 10, LANDMARKS.casino.y + 60, 50, 'GUARD');
    if (G.enemies[0]) G.enemies[0].hp = 22;
    G.popups.push({ x: G.player.x + 30, y: G.player.y - 20, text: '-25', color: '#ffd23f', t: 60 });
    G.popups.push({ x: G.player.x + 60, y: G.player.y - 30, text: '-12', color: '#ffd23f', t: 50 });
    G.dialogue = { speaker: 'ADA KLINE', text: 'Vault\u2019s through the back, kid. Five guards between you and the money. Make it loud.', portrait: 0, onDone: null };
    G.stagedDialogue = true;
    updateWanted();
  } else if (scene === 'map') {
    G.screen = 'pause';
    G.cash = 21400; G.rep = 52; G.day = 4; G.clockMin = 12 * 60 + 30;
    G.missionsDone = [0, 1, 2, 3, 4, 5];
    G.missionIndex = 6;
    G.stats = { carsStolen: 11, copsLost: 7, kills: 19, missions: 6, shots: 214, nearMiss: 9, drift: 14, distance: 48200 };
    G.garage = [{ name: 'Comet GT', color: '#ffc300', condition: 92 }];
    G.stashes.forEach((s, i) => { if (i < 3) s.taken = true; });
    G.player.x = 1130; G.player.y = 820;
  }
  document.documentElement.setAttribute('data-shot-ready', '1');
}

// debug / test API
window.__solmarina = {
  G, startMission, debugCompleteMission, saveGame, loadGame, hurtPlayer,
  version: 'solmarina-round3',
  state: () => ({
    screen: G.screen, cash: G.cash, health: G.health, armour: G.armour,
    wanted: G.wanted, missionsDone: [...G.missionsDone], missionIndex: G.missionIndex,
    weapon: G.weapon, weapons: G.weapons.map((w) => ({ name: w.name, ammo: w.ammo, owned: w.owned })),
    player: { x: G.player.x, y: G.player.y, onFoot: G.player.onFoot, car: !!G.player.car, heli: !!G.player.heli },
    cops: G.cops.length, policeHeli: !!G.policeHeli, enemies: G.enemies.length,
    stats: { ...G.stats }, hasHeli: !!G.heli,
  }),
};

const scene = new URLSearchParams(location.search).get('scene');
if (scene) {
  // stage after first paint so the world exists
  requestAnimationFrame(() => requestAnimationFrame(() => stageScene(scene)));
} else {
  document.documentElement.setAttribute('data-shot-ready', '1');
}
requestAnimationFrame(loop);
