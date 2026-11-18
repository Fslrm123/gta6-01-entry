// police.js — wanted system, cop cars, officers, roadblocks, police heli. Freshly authored.
import { G } from './state.js';
import { clamp, dist, rand, angDiff, pick } from './utils.js';
import { makeCar } from './vehicles.js';
import { hurtPlayer, addPopup, showMessage } from './player.js';
import { sfx } from './audio.js';

const UNIT_NAMES = ['UNIT 12', 'UNIT 27', 'UNIT 04', 'UNIT 31', 'UNIT 58', 'UNIT 09'];
export function wantedStars() { return Math.floor(G.wanted + 0.0001); }
export function addWanted(n, why) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  if (n > 0) showMessage('Wanted level rising' + (why ? ' — ' + why : ''));
}
export function updateWanted(dt) {
  // decay slowly when no crime recently
  if (G.wanted > 0 && Math.random() < 0.0012) G.wanted = Math.max(0, G.wanted - 0.05);
  const stars = wantedStars();
  const wantCops = stars === 0 ? 0 : stars <= 1 ? 1 : stars <= 2 ? 2 : stars <= 3 ? 3 : 4;
  while (G.cops.length < wantCops) spawnCop();
  while (G.cops.length > wantCops) G.cops.pop();
  // police heli at wanted >= 4
  if (stars >= 4 && !G.policeHeli) {
    G.policeHeli = { x: G.player.x + 160, y: G.player.y - 200, z: 90, angle: 0, name: 'PD AIR-1', unit: 'AIR-1' };
    showMessage('PD AIR-1 helicopter is on you — lose the heat!');
    sfx.siren();
  }
  if (stars < 4 && G.policeHeli) { G.policeHeli = null; G.stats.copsLost += 1; }
  if (G.policeHeli) {
    const h = G.policeHeli;
    const a = Math.atan2(G.player.y - h.y, G.player.x - h.x);
    h.angle += angDiff(h.angle, a) * 0.03;
    h.x += Math.cos(h.angle) * 1.8; h.y += Math.sin(h.angle) * 1.8;
    h.z = 90 + Math.sin(G.time / 30) * 6;
  }
}
function spawnCop() {
  const p = G.player;
  const a = rand(0, Math.PI * 2);
  const x = clamp(p.x + Math.cos(a) * 260, 300, 2500);
  const y = clamp(p.y + Math.sin(a) * 200, 40, 1880);
  const car = makeCar(x, y, 0, { color: '#1a1a2e', name: 'Interceptor', police: true, driver: true });
  car.unit = pick(UNIT_NAMES);
  G.cops.push(car);
}
export function updateCops() {
  const p = G.player;
  for (const cop of G.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += angDiff(cop.angle, a) * 0.06;
    const sp = d > 260 ? 4.6 : d > 90 ? 3.6 : 1.6;
    cop.speed = sp;
    cop.x += Math.cos(cop.angle) * sp;
    cop.y += Math.sin(cop.angle) * sp;
    // ramming: damage player on contact (with cooldown so it is survivable)
    if (d < 26) {
      cop.speed *= 0.4;
      cop._ramT = (cop._ramT || 0) - 1;
      if (cop._ramT <= 0) {
        cop._ramT = 45;
        if (p.onFoot) hurtPlayer(4);
        else if (p.car) { p.car.condition = Math.max(0, p.car.condition - 1.5); if (Math.random() < 0.05) addPopup(p.x, p.y - 14, 'RAMMED!', '#e63946'); }
        if (Math.random() < 0.5) sfx.punch();
      }
    }
  }
  // bust: on foot, cop very close for a while at high wanted
  if (wantedStars() >= 3 && p.onFoot) {
    for (const cop of G.cops) {
      if (dist(cop.x, cop.y, p.x, p.y) < 20 && Math.random() < 0.01) {
        G.cash = Math.max(0, G.cash - 100);
        G.wanted = 0; G.cops = []; G.policeHeli = null;
        showMessage('BUSTED! $100 fine — the crew bailed you out');
        p.x = 420; p.y = 1420;
      }
    }
  }
}
export function clearHeat() {
  G.wanted = 0; G.cops = []; G.policeHeli = null; G.stats.copsLost += 1;
  showMessage('Heat cleared — you are clean, for now');
}
export function policePanel() {
  const units = G.cops.map((c) => ({ unit: c.unit || 'UNIT', d: Math.round(dist(c.x, c.y, G.player.x, G.player.y)) }));
  if (G.policeHeli) units.unshift({ unit: 'AIR-1', d: Math.round(dist(G.policeHeli.x, G.policeHeli.y, G.player.x, G.player.y)) });
  return units.slice(0, 4);
}
