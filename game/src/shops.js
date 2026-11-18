// shops.js — gun shop, market, respray, safehouse, garage. Freshly authored.
import { G } from './state.js';
import { showMessage, addCash } from './player.js';
import { clearHeat } from './police.js';
import { sfx } from './audio.js';

export const GUN_ITEMS = [
  { name: 'PISTOL AMMO x24', price: 60, apply: () => { G.weapons[1].ammo += 24; } },
  { name: 'SMG', price: 800, apply: () => { G.weapons[2].owned = true; G.weapons[2].ammo += 60; } },
  { name: 'SMG AMMO x60', price: 150, apply: () => { if (G.weapons[2].owned) G.weapons[2].ammo += 60; } },
  { name: 'BODY ARMOUR', price: 200, apply: () => { G.armour = 100; } },
];
export const MARKET_ITEMS = [
  { name: 'SNACK — heal 25', price: 15, apply: () => { G.health = Math.min(100, G.health + 25); } },
  { name: 'MEDKIT — full heal', price: 60, apply: () => { G.health = 100; } },
  { name: 'ARMOUR PLATE', price: 120, apply: () => { G.armour = Math.min(100, G.armour + 50); } },
  { name: 'NOS REFILL', price: 80, apply: () => { if (G.player.car) G.player.car.nos = 100; G.nos = 100; } },
];
export function openShop(kind) {
  const items = kind === 'gun' ? GUN_ITEMS : MARKET_ITEMS;
  G.shop = { kind, items, sel: 0 };
  G.screen = 'shop';
  G.shopMsg = kind === 'gun' ? 'IRONWORKS GUN SHOP — "No refunds. No questions."' : 'COASTAL MARKET — "Fresh snacks, fresh armour."';
}
export function buySelected() {
  if (!G.shop) return false;
  const item = G.shop.items[G.shop.sel];
  if (!item) return false;
  if (item.name.startsWith('SMG AMMO') && !G.weapons[2].owned) { G.shopMsg = 'You need the SMG first!'; sfx.error(); return false; }
  if (G.cash < item.price) { G.shopMsg = 'Not enough cash — $' + item.price + ' needed.'; sfx.error(); return false; }
  G.cash -= item.price;
  item.apply();
  G.shopMsg = 'Bought: ' + item.name + ' (-$' + item.price + ')';
  sfx.pickup();
  return true;
}
export function useRespray() {
  // works from inside the car, or standing next to your parked car
  let car = G.player.car;
  if (!car) {
    let bd = 60;
    for (const c of G.cars) {
      const d = Math.hypot(c.x - G.player.x, c.y - G.player.y);
      if (d < bd) { bd = d; car = c; }
    }
  }
  if (!car) { showMessage('Respray needs a car — bring one here'); return false; }
  if (G.cash < 100 && G.wanted > 0) { showMessage('Respray costs $100 — not enough cash'); return false; }
  if (G.wanted > 0) G.cash -= 100;
  car.condition = 100; G.carCondition = 100;
  const colors = ['#e63946', '#ffc300', '#0e7c86', '#ff5da2', '#7b2fbe'];
  car.color = colors[Math.floor(Math.random() * colors.length)];
  clearHeat();
  showMessage('Respray complete — fresh paint, clean slate');
  sfx.pickup();
  return true;
}
export function useSafehouse() {
  G.health = 100; G.armour = Math.min(100, G.armour + 25);
  showMessage('Safehouse — rested, health restored. Progress saved.');
  saveGame();
}
export function useGarage() {
  if (!G.player.car) { showMessage('Garage stores the car you are driving'); return false; }
  G.garage.push({ name: G.player.car.name, color: G.player.car.color, condition: G.player.car.condition });
  showMessage('Stored the ' + G.player.car.name + ' in Rosa\u2019s Garage (' + G.garage.length + ' stored)');
  return true;
}
import { saveGame } from './save.js';
