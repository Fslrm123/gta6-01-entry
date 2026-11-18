// main.js — Solmarina bootstrap: canvas setup, keyboard/mouse input, the
// game loop, scene selection (?scene=heli|title|heist|map&seed=N) and the
// window.SOL test API used by the automated play-test.
import { createGame, update, tryEnterVehicle, exitHeli, shoot, shopBuy, doRespray, saveGame, loadGame, startMission, addWanted, say } from './game.js';
import { renderWorld, renderHUD, renderTitle, renderPause, VW, VH } from './render.js';
import { PLACES } from './city.js';
import { MISSIONS } from './missions.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const scene = params.get('scene');
const game = createGame(seed, scene);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Off-screen 480x270 pixel buffer, upscaled nearest-neighbour.
const buf = document.createElement('canvas');
buf.width = VW;
buf.height = VH;
const bctx = buf.getContext('2d');
bctx.imageSmoothingEnabled = false;

const input = {
  up: false, down: false, left: false, right: false,
  shift: false, climb: false, descend: false,
};

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'shift', ShiftRight: 'shift',
  Space: 'climb', KeyC: 'descend',
};

let mouseX = VW / 2, mouseY = VH / 2;
let mouseDown = false;

function worldMouse() {
  // Buffer is scaled to the canvas CSS size; convert mouse to world coords.
  const rect = canvas.getBoundingClientRect();
  const sx = (mouseX / rect.width) * VW;
  const sy = (mouseY / rect.height) * VH;
  const camX = Math.max(0, Math.min(2400 - VW, game.cam.x - VW / 2));
  const camY = Math.max(0, Math.min(1800 - VH, game.cam.y - VH / 2));
  return { x: camX + sx, y: camY + sy };
}

function nearPlace(pl, r = 55) {
  return Math.hypot(game.player.x - pl.x, game.player.y - pl.y) < r;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  const k = KEYMAP[e.code];
  if (k) input[k] = true;
  if (e.repeat) return;
  game.radio.ensure();
  if (e.code === 'Enter' && game.title) {
    game.title = false;
    startMission(game, game.missionIndex);
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.title) return;
    if (game.shop) { game.shop = null; return; }
    game.paused = !game.paused;
    return;
  }
  if (game.title || game.paused) return;
  if (e.code === 'KeyE') {
    if (game.shop) { game.shop = null; return; }
    if (game.player.inHeli) { exitHeli(game); return; }
    if (nearPlace(PLACES.gunshop)) { game.shop = 'gun'; return; }
    if (nearPlace(PLACES.market)) { game.shop = 'market'; return; }
    if (nearPlace(PLACES.respray)) { doRespray(game); return; }
    tryEnterVehicle(game);
    return;
  }
  if (e.code === 'KeyR') { game.radio.cycle(); return; }
  if (e.code === 'KeyM') { game.radio.toggleMute(); return; }
  if (e.code === 'KeyS' && e.shiftKey) { saveGame(game); return; }
  if (e.code === 'KeyL') { loadGame(game); return; }
  if (game.shop && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
    shopBuy(game, parseInt(e.code.slice(-1), 10) - 1);
    return;
  }
  if (e.code === 'Digit1') { game.weapon = 0; return; }
  if (e.code === 'Digit2') { game.weapon = 1; return; }
  if (e.code === 'Digit3') { game.weapon = 2; return; }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
});
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  const w = worldMouse();
  shoot(game, w.x, w.y);
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('blur', () => {
  for (const k of Object.keys(input)) input[k] = false;
  mouseDown = false;
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mouseDown && !game.title && !game.paused && !game.shop) {
    const w = worldMouse();
    shoot(game, w.x, w.y);
  }
  update(game, input, dt);
  bctx.clearRect(0, 0, VW, VH);
  if (game.title) {
    renderTitle(bctx, game);
  } else {
    renderWorld(bctx, game);
    renderHUD(bctx, game);
    if (game.paused) renderPause(bctx, game);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- test API ---------------------------------------------------------------
window.SOL = {
  game, input, MISSIONS, PLACES,
  state: () => ({
    title: game.title, paused: game.paused, shop: game.shop,
    cash: game.cash, health: game.health, armour: game.armour, wanted: game.wanted,
    x: game.player.x, y: game.player.y,
    onFoot: game.player.onFoot, inHeli: game.player.inHeli,
    vehicle: !!game.player.vehicle, heliAlt: game.heli.alt,
    weapon: game.weapon, ammo: game.weapons.map(w => w.ammo), owned: game.weapons.map(w => w.owned),
    missionIndex: game.missionIndex, missionStep: game.missionStep, stepCount: game.stepCount,
    missionPassed: game.missionPassed, storyDone: game.storyDone,
    cops: game.cops.length, policeHeli: game.policeHeli.active,
    cars: game.cars.length, pedsAlive: game.peds.filter(p => p.alive).length,
    rivalsAlive: game.rivals.filter(r => r.alive).length,
    pickupsLeft: game.pickups.filter(p => !p.taken).length,
    bullets: game.bullets.length,
    stats: { ...game.stats },
    stashesTaken: game.stashes.filter(s => s.taken).length,
    wasted: game.wasted, dialogue: game.dialogue.length,
    radio: game.radio.name(),
  }),
  step: () => {
    const m = MISSIONS[game.missionIndex];
    return m ? m.steps[game.missionStep] : null;
  },
  teleport: (x, y) => {
    if (game.player.vehicle) { game.player.vehicle.x = x; game.player.vehicle.y = y; }
    if (game.player.inHeli) { game.heli.x = x; game.heli.y = y; }
    game.player.x = x; game.player.y = y;
    game.cam.x = x; game.cam.y = y;
  },
  setWanted: (n) => { game.wanted = n; game.crimeT = 0; },
  giveCash: (n) => { game.cash += n; },
  startMission: (i) => startMission(game, i),
  enterVehicle: () => tryEnterVehicle(game),
  exitHeli: () => exitHeli(game),
  shootAt: (x, y) => shoot(game, x, y),
  buy: (i) => shopBuy(game, i),
  respray: () => doRespray(game),
  save: () => saveGame(game),
  load: () => loadGame(game),
  addWanted: (n) => addWanted(game, n),
  say: (s, t) => say(game, s, t),
  openShop: (kind) => { game.shop = kind; },
  closeShop: () => { game.shop = null; },
  setPaused: (v) => { game.paused = v; },
  setTitle: (v) => { game.title = v; },
  key: (code, down) => {
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true });
    window.dispatchEvent(ev);
  },
  clickAt: (x, y) => {
    const w = { x, y };
    shoot(game, w.x, w.y);
  },
};
