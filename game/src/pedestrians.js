// pedestrians.js — ambient walkers + fleeing crowds. Freshly authored.
import { G } from './state.js';
import { rand, randi, pick, dist } from './utils.js';
import { collideBuildings, isWater } from './city.js';

const SKINS = ['#f2c98a', '#8a5a3b', '#e8b48a', '#6a4a2f'];
const SHIRTS = ['#e63946', '#0e7c86', '#ffc300', '#ff5da2', '#7b2fbe', '#3fae5a', '#f5f0ff'];
export function spawnPeds(n) {
  G.peds = [];
  for (let i = 0; i < n; i++) {
    G.peds.push({
      x: rand(300, 2500), y: rand(60, 1860), angle: rand(0, Math.PI * 2),
      skin: pick(SKINS), shirt: pick(SHIRTS), speed: rand(0.4, 0.9),
      panic: 0, t: randi(0, 200),
    });
  }
}
export function updatePeds() {
  const p = G.player;
  for (const ped of G.peds) {
    ped.t += 1;
    const d = dist(ped.x, ped.y, p.x, p.y);
    if (G.wanted >= 2 && d < 120) ped.panic = 60;
    if (ped.panic > 0) {
      ped.panic -= 1;
      ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.speed = 1.6;
    } else {
      ped.speed = 0.6;
      if (ped.t % 180 === 0) ped.angle = rand(0, Math.PI * 2);
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed;
    if (!collideBuildings(nx, ny, 5) && !isWater(nx, ny)) { ped.x = nx; ped.y = ny; }
    else ped.angle += Math.PI / 2;
  }
  if (G.peds.length < 16 && Math.random() < 0.01) {
    G.peds.push({ x: p.x + rand(-200, 200), y: p.y + rand(-150, 150), angle: rand(0, 6), skin: pick(SKINS), shirt: pick(SHIRTS), speed: 0.6, panic: 0, t: 0 });
  }
}
