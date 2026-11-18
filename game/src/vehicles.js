// vehicles.js — traffic, driving physics, carjacking, NOS, damage. Freshly authored.
import { G } from './state.js';
import { clamp, dist, rand, randi, pick, angDiff, CAR_COLORS, CAR_NAMES } from './utils.js';
import { ROADS_X, ROADS_Y, collideBuildings, isWater, districtAt } from './city.js';
import { keys } from './input.js';
import { addPopup, showMessage } from './player.js';
import { sfx } from './audio.js';

export function makeCar(x, y, angle, opts = {}) {
  const i = randi(0, CAR_NAMES.length - 1);
  return {
    x, y, angle, speed: 0, color: opts.color || CAR_COLORS[i], name: opts.name || CAR_NAMES[i],
    condition: opts.condition ?? 100, driver: opts.driver !== false, police: !!opts.police,
    nos: 100, id: Math.random().toString(36).slice(2, 8),
  };
}
export function spawnTraffic(n) {
  G.traffic = [];
  for (let i = 0; i < n; i++) {
    const horizontal = Math.random() < 0.5;
    const x = horizontal ? rand(300, 2500) : pick(ROADS_X);
    const y = horizontal ? pick(ROADS_Y) : rand(300, 1850);
    G.traffic.push(makeCar(x, y, horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)));
  }
}
export function nearestCar(x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of [...G.traffic, ...G.cars]) {
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
// Attempt to steal/enter the nearest car. Returns true on success.
export function tryEnterCar() {
  const p = G.player;
  if (!p.onFoot) return false;
  const car = nearestCar(p.x, p.y, 34);
  if (!car) return false;
  const wasParked = !car.driver;
  // remove from its list
  G.traffic = G.traffic.filter((c) => c !== car);
  G.cars = G.cars.filter((c) => c !== car);
  p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (car.driver) {
    G.stats.carsStolen += 1;
    addPopup(car.x, car.y - 16, 'CARJACKED!', '#ff5da2');
    G.wanted = Math.min(5, G.wanted + 1);
    showMessage('You jacked the ' + car.name + ' — wanted +1 star');
    sfx.siren();
  } else {
    showMessage('You hop into the ' + car.name);
  }
  return true;
}
export function exitCar() {
  const p = G.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.speed = 0; car.driver = false;
  G.cars.push(car);
  p.x = car.x + 22; p.y = car.y + 10; p.onFoot = true; p.car = null;
  G.carCondition = car.condition;
}
export function updateDriving() {
  const p = G.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  const accel = (keys['w'] || keys['arrowup']) ? 0.22 : 0;
  const brake = (keys['s'] || keys['arrowdown']) ? -0.3 : 0;
  const handbrake = keys[' '];
  if (accel) car.speed = Math.min(car.speed + accel, 7.2);
  else if (brake) car.speed = Math.max(car.speed - 0.35, -2.5);
  else car.speed *= 0.985;
  if (handbrake) { car.speed *= 0.94; if (Math.abs(car.speed) > 3 && Math.random() < 0.1) { G.stats.drift += 1; addPopup(car.x, car.y - 14, 'DRIFT +$5', '#7CFC00'); G.cash += 5; } }
  // NOS boost
  if (keys['shift'] && car.nos > 0 && car.speed > 2) { car.speed = Math.min(car.speed + 0.25, 10.5); car.nos -= 0.8; }
  else if (car.nos < 100) car.nos += 0.1;
  const steer = ((keys['a'] || keys['arrowleft']) ? -1 : 0) + ((keys['d'] || keys['arrowright']) ? 1 : 0);
  if (Math.abs(car.speed) > 0.2) car.angle += steer * 0.045 * Math.sign(car.speed) * (1 + Math.abs(car.speed) / 14);
  const nx = car.x + Math.cos(car.angle) * car.speed;
  const ny = car.y + Math.sin(car.angle) * car.speed;
  const hit = collideBuildings(nx, ny, 14);
  if (hit || isWater(nx, ny)) {
    car.speed *= -0.25; car.condition = Math.max(0, car.condition - 4);
    addPopup(car.x, car.y - 14, '-$' + 4 + ' DAMAGE', '#e63946');
    if (Math.random() < 0.3) sfx.punch();
  } else { car.x = nx; car.y = ny; }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  G.stats.distance += Math.abs(car.speed);
  G.carCondition = car.condition; G.nos = car.nos;
  // near-miss with traffic
  for (const t of G.traffic) {
    if (dist(car.x, car.y, t.x, t.y) < 30 && Math.abs(car.speed) > 5 && !t._near) {
      t._near = true; G.stats.nearMiss += 1; G.cash += 10;
      addPopup(car.x, car.y - 16, 'NEAR MISS +$10', '#7CFC00');
    } else if (dist(car.x, car.y, t.x, t.y) > 60) t._near = false;
  }
}
export function updateTraffic() {
  for (const t of G.traffic) {
    const targetSpeed = 1.6;
    t.speed = targetSpeed;
    const nx = t.x + Math.cos(t.angle) * t.speed;
    const ny = t.y + Math.sin(t.angle) * t.speed;
    if (collideBuildings(nx, ny, 12) || isWater(nx, ny) || nx < 280 || nx > 2540 || ny < 20 || ny > 1900) {
      t.angle += Math.PI / 2; // turn at block end
    } else { t.x = nx; t.y = ny; }
  }
  // keep traffic topped up near the player
  if (G.traffic.length < 10 && Math.random() < 0.02) {
    const rx = pick(ROADS_X), ry = pick(ROADS_Y);
    G.traffic.push(makeCar(rx + rand(-40, 40), ry + rand(-10, 10), Math.random() < 0.5 ? 0 : Math.PI / 2));
  }
}
export function carName() { return G.player.car ? G.player.car.name : 'ON FOOT'; }
