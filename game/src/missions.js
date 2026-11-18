// missions.js — the Ada Kline story arc: 10 missions, each a list of steps.
// Step types: goto (reach a point), collect (grab n pickups), kill (drop n
// rivals), carjack (steal any traffic car), heli (reach a point while flying),
// escape (reach a point while wanted). Payouts are paid on completion.
import { PLACES } from './city.js';

const P = PLACES;

export const MISSIONS = [
  {
    id: 0, name: 'First Errand', payout: 500,
    brief: ['ADA: Rico, you are new in Solmarina. Pick up my package at the market.', 'ADA: Bring it back to the safehouse. No cops, no noise.'],
    steps: [
      { type: 'goto', x: P.market.x, y: P.market.y, r: 60, text: 'Pick up the package at Marina Market' },
      { type: 'goto', x: P.safehouse.x, y: P.safehouse.y, r: 60, text: 'Deliver the package to the Safehouse' },
    ],
  },
  {
    id: 1, name: 'Harbour Heist', payout: 5000,
    brief: ['ADA: Three crates on the harbour docks. Grab them all.', 'ADA: The dock crew is paid off. Move fast and quiet.'],
    steps: [
      { type: 'collect', x: P.harbour.x, y: P.harbour.y, r: 90, count: 3, text: 'Collect 3 crates at the Harbour' },
      { type: 'escape', x: P.safehouse.x, y: P.safehouse.y, r: 70, text: 'Escape to the Safehouse' },
    ],
  },
  {
    id: 2, name: 'Getaway Driver', payout: 1200,
    brief: ['RICO: A clean ride is half the job. Jack a car off the street.', 'ADA: Then bring it to the garage. Do not scratch it.'],
    steps: [
      { type: 'carjack', text: 'Carjack a traffic car (walk up, press E)' },
      { type: 'goto', x: P.garage.x, y: P.garage.y, r: 70, text: 'Drive the stolen car to the Garage' },
    ],
  },
  {
    id: 3, name: 'High Roller', payout: 6000,
    brief: ['ADA: The Golden Anchor casino owes me. Take the chips.', 'MARISOL: Cameras looped for 90 seconds. Go.'],
    steps: [
      { type: 'goto', x: P.casino.x, y: P.casino.y, r: 60, text: 'Reach the Golden Anchor Casino' },
      { type: 'collect', x: P.casino.x, y: P.casino.y, r: 80, count: 2, text: 'Grab the 2 chip cases' },
      { type: 'goto', x: P.safehouse.x, y: P.safehouse.y, r: 60, text: 'Bring the chips to the Safehouse' },
    ],
  },
  {
    id: 4, name: 'Street Sweeper', payout: 2000,
    brief: ['ADA: The Vipers are muscling in on my blocks. Clear them out.', 'RIG: Three of them. Make it loud.'],
    steps: [
      { type: 'kill', count: 3, text: 'Take out 3 rival Vipers' },
    ],
  },
  {
    id: 5, name: 'Hot Pursuit', payout: 2500,
    brief: ['ADA: The PD is watching the plaza. Stir them up, then vanish.', 'MARISOL: Lose the heat at the respray. Spray & Go, west side.'],
    steps: [
      { type: 'goto', x: P.plaza.x, y: P.plaza.y, r: 80, text: 'Show up at Plaza Sol (heat rises)' },
      { type: 'escape', x: P.respray.x, y: P.respray.y, r: 70, text: 'Lose the heat at Spray & Go' },
    ],
  },
  {
    id: 6, name: 'Air Lift', payout: 4000,
    brief: ['ADA: The package is on a downtown roof. Only the Seahawk can reach it.', 'RICO: Heli pad is on the beach. Space climbs, C drops.'],
    steps: [
      { type: 'heli', x: 1300, y: 480, r: 70, text: 'Fly the Seahawk to the casino roof' },
      { type: 'heli', x: P.helipad.x, y: P.helipad.y, r: 80, text: 'Land back at the Heli Pad' },
    ],
  },
  {
    id: 7, name: 'Night Shift', payout: 3000,
    brief: ['ADA: Two drops before dawn. Beach first, then the harbour.', 'MARISOL: I will keep the PD radios quiet.'],
    steps: [
      { type: 'goto', x: P.beach.x, y: P.beach.y, r: 70, text: 'Drop 1: Sol Beach' },
      { type: 'goto', x: P.harbour.x, y: P.harbour.y, r: 70, text: 'Drop 2: Harbour Docks' },
    ],
  },
  {
    id: 8, name: 'The Setup', payout: 4500,
    brief: ['ADA: The Anchor job needs two harbour crates and a clean exit.', 'RIG: I will watch the docks. You grab and run.'],
    steps: [
      { type: 'collect', x: P.harbour.x, y: P.harbour.y, r: 90, count: 2, text: 'Collect 2 crates at the Harbour' },
      { type: 'escape', x: P.safehouse.x, y: P.safehouse.y, r: 70, text: 'Get back to the Safehouse' },
    ],
  },
  {
    id: 9, name: 'Golden Anchor', payout: 10000,
    brief: ['ADA: Tonight we take the Golden Anchor vault. Everything rides on this.', 'ADA: Grab the loot, lose the heat, come home rich.'],
    steps: [
      { type: 'goto', x: P.casino.x, y: P.casino.y, r: 60, text: 'Reach the Golden Anchor Casino' },
      { type: 'collect', x: P.casino.x, y: P.casino.y, r: 80, count: 3, text: 'Grab the 3 vault bags' },
      { type: 'escape', x: P.safehouse.x, y: P.safehouse.y, r: 70, text: 'Escape to the Safehouse' },
    ],
  },
];

export const CREW = [
  { name: 'Ada Kline', role: 'Fixer', skin: '#e8b88a', hair: '#2c1e3a', shirt: '#c94f4f', desc: 'Runs Solmarina from a phone booth.' },
  { name: 'Rico', role: 'Driver', skin: '#c98a5a', hair: '#14141c', shirt: '#4f7ec9', desc: 'Steals anything with wheels.' },
  { name: 'Marisol', role: 'Hacker', skin: '#f0c8a0', hair: '#c92828', shirt: '#58d858', desc: 'Loops cameras, silences radios.' },
  { name: 'Rig', role: 'Muscle', skin: '#8a5a3a', hair: '#3a2a1a', shirt: '#d8d832', desc: 'Solves problems with a bat.' },
];
