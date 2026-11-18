// heli.js — the flyable player helicopter (enter / fly / exit). Freshly authored.
import { G } from './state.js';
import { clamp, dist, rand } from './utils.js';
import { keys } from './input.js';
import { showMessage, addPopup } from './player.js';
import { LANDMARKS } from './city.js';

export function ensurePlayerHeli() {
  if (!G.heli) {
    G.heli = { x: LANDMARKS.helipad.x, y: LANDMARKS.helipad.y + 30, z: 0, angle: -Math.PI / 2, speed: 0, rotor: 0, name: 'Seahawk' };
  }
  return G.heli;
}
export function tryEnterHeli() {
  const p = G.player;
  if (!p.onFoot) return false;
  const h = ensurePlayerHeli();
  if (h.z > 2) return false;
  if (dist(p.x, p.y, h.x, h.y) > 40) return false;
  p.heli = h; p.onFoot = false; p.x = h.x; p.y = h.y;
  showMessage('You climb into the Seahawk — Space to climb, C to descend');
  return true;
}
export function exitHeli() {
  const p = G.player;
  if (!p.heli) return;
  const h = p.heli;
  if (h.z > 4) { showMessage('Too high to jump out! Descend first (C)'); return; }
  h.z = 0; h.speed = 0;
  p.x = h.x + 26; p.y = h.y + 14; p.onFoot = true; p.heli = null;
  showMessage('You hop out of the Seahawk');
}
export function updateHeli() {
  const p = G.player;
  if (!p.heli) return;
  const h = p.heli;
  h.rotor += 0.5;
  if (keys[' ']) h.z = clamp(h.z + 0.9, 0, 120);
  if (keys['c']) h.z = clamp(h.z - 0.9, 0, 120);
  const fwd = (keys['w'] || keys['arrowup']) ? 1 : 0;
  const back = (keys['s'] || keys['arrowdown']) ? -0.5 : 0;
  const steer = ((keys['a'] || keys['arrowleft']) ? -1 : 0) + ((keys['d'] || keys['arrowright']) ? 1 : 0);
  const target = h.z > 4 ? 3.2 : 0;
  h.speed += ((fwd + back) * (h.z > 4 ? 0.12 : 0) - h.speed * 0.03);
  h.speed = clamp(h.speed, -1.5, 4.2);
  h.angle += steer * 0.035 * (Math.abs(h.speed) > 0.1 ? 1 : 0.4);
  h.x = clamp(h.x + Math.cos(h.angle) * h.speed, 10, 2550);
  h.y = clamp(h.y + Math.sin(h.angle) * h.speed, 10, 1910);
  p.x = h.x; p.y = h.y; p.angle = h.angle; p.speed = h.speed;
  G.stats.distance += Math.abs(h.speed);
  if (h.z > 60 && Math.random() < 0.005) addPopup(h.x, h.y - 20, 'SKY HIGH', '#7CFC00');
}
