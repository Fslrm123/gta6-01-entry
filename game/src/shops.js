// shops.js — the shops of Solmarina. Spend earned cash on guns, ammo,
// armor and health. Two shops, both marked on the minimap with a green $:
// Ironworks Gun Shop by the harbour road, and Coastal Market uptown.
// Walk up, press E, buy with number keys 1-6, E or Esc to leave. The shop
// pauses the world while it is open — no drive-bys while you browse.

import { LANDMARKS } from './city.js';

export const SHOP_DEFS = [
  {
    id: 'gunshop',
    name: 'Ironworks Gun Shop',
    short: 'Gun Shop',
    x: LANDMARKS.gunshop.x,
    y: LANDMARKS.gunshop.y,
    blurb: 'Guns, ammo and vests. No questions, cash only.',
    items: [
      { id: 'pistol', name: 'Pistol', price: 300, desc: 'Reliable sidearm' },
      { id: 'pistol-ammo', name: 'Pistol ammo ×60', price: 50, desc: 'A box of 9mm' },
      { id: 'smg', name: 'Street SMG', price: 800, desc: 'Fast fire' },
      { id: 'smg-ammo', name: 'SMG ammo ×120', price: 80, desc: 'Two fat mags' },
      { id: 'armor', name: 'Kevlar vest +50', price: 150, desc: 'Soaks bullets first' },
      { id: 'health', name: 'Medkit +50 HP', price: 100, desc: 'Patch up on the spot' },
    ],
  },
  {
    id: 'market',
    name: 'Coastal Market',
    short: 'Market',
    x: LANDMARKS.market.x,
    y: LANDMARKS.market.y,
    blurb: 'Snacks, vests and loose ammo under the awning.',
    items: [
      { id: 'health', name: 'Snacks +50 HP', price: 80, desc: "Rosa's empanadas" },
      { id: 'armor', name: 'Kevlar vest +50', price: 120, desc: 'Light vest' },
      { id: 'pistol-ammo', name: 'Pistol ammo ×60', price: 60, desc: 'Loose rounds' },
      { id: 'smg-ammo', name: 'SMG ammo ×120', price: 90, desc: 'Warm and cheap' },
    ],
  },
];

export class Shops {
  constructor(game) {
    this.game = game;
    this.openShop = null; // the SHOP_DEF currently open, or null
    this.selected = 0; // highlighted item in the open shop
  }

  get isOpen() { return this.openShop !== null; }

  open(def) {
    this.openShop = def;
    this.game.sound.pickup();
  }

  close() {
    this.openShop = null;
  }

  // Buy item number `n` (0-based) from the open shop.
  buy(n) {
    const game = this.game;
    const def = this.openShop;
    if (!def) return;
    const item = def.items[n];
    if (!item) return;
    const p = game.player;
    if (p.cash < item.price) {
      game.notify(`Need $${item.price} for ${item.name} — you have $${p.cash}.`, 'bad');
      return;
    }
    p.cash -= item.price;
    if (item.id === 'pistol') p.giveWeapon('pistol', 60);
    else if (item.id === 'smg') p.giveWeapon('smg', 120);
    else if (item.id === 'pistol-ammo') { p.giveWeapon('pistol', 0); p.ammo.pistol = (p.ammo.pistol || 0) + 60; }
    else if (item.id === 'smg-ammo') { p.giveWeapon('smg', 0); p.ammo.smg = (p.ammo.smg || 0) + 120; }
    else if (item.id === 'armor') p.armor = Math.min(100, p.armor + 50);
    else if (item.id === 'health') p.heal(50);
    game.sound.cash();
    game.notify(`Bought ${item.name} (-$${item.price})`, 'good');
  }
}
