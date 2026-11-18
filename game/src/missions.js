// missions.js — 10-mission story arc from fixer Ada Kline. Freshly authored.
import { G } from './state.js';
import { dist } from './utils.js';
import { LANDMARKS } from './city.js';
import { showBanner, addCash, showMessage } from './player.js';
import { spawnEnemy } from './combat.js';
import { addWanted } from './police.js';
import { sfx } from './audio.js';

export const CREW = [
  { name: 'ADA KLINE', role: 'Fixer', color: '#ff5da2', bio: 'Runs Solmarina from a booth at Mama Rosa\u2019s.' },
  { name: 'RICO', role: 'Driver', color: '#0e7c86', bio: 'Ex-stunt driver. Never lost a tail.' },
  { name: 'MARISOL', role: 'Hacker', color: '#7b2fbe', bio: 'Cracks anything with a blinking light.' },
  { name: 'BIG T', role: 'Muscle', color: '#ffc300', bio: 'Carries the heavy things. And people.' },
];

export const MISSIONS = [
  { id: 0, name: 'Welcome to Solmarina', payout: 500, desc: 'Ada wants to meet you. Drive to Mama Rosa\u2019s Diner and say hello.', type: 'goto', x: LANDMARKS.diner.x, y: LANDMARKS.diner.y, r: 40, brief: 'ADA: "New face. I like new faces. Come see me at the diner, kid."' },
  { id: 1, name: 'Wheels Up', payout: 800, desc: 'Steal any car and bring it to Rosa\u2019s Garage. Any car. Don\u2019t ask.', type: 'deliver', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, r: 46, needCar: true, brief: 'RICO: "Boss needs wheels. Jack something pretty and bring it to the garage."' },
  { id: 2, name: 'Beachfront Brawl', payout: 1200, desc: 'Clear the thugs off the pier — 4 of them, fists or fire.', type: 'kill', count: 4, x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, brief: 'BIG T: "Pier rats are taxing our runners. Go remind them who owns the beach."' },
  { id: 3, name: 'Harbour Heist', payout: 5000, desc: 'Hit the East Harbour warehouse. Grab the stash, then lose the cops.', type: 'collect', x: 900, y: 1450, r: 36, brief: 'ADA: "A crate of untaxed gold watches sits in the harbour. Take it. Don\u2019t get caught."' },
  { id: 4, name: 'Getaway Driver', payout: 1500, desc: 'Marisol is hot. Pick her up at the marina and drop her at the safehouse — fast.', type: 'deliver', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, r: 40, needCar: true, brief: 'MARISOL: "I tripped an alarm. Pick me up at the marina — and drive like you mean it."' },
  { id: 5, name: 'Neon Nights', payout: 2000, desc: 'Collect 3 stashes hidden around Neon Mile before sunrise.', type: 'collect3', x: 1100, y: 300, r: 200, brief: 'ADA: "Three dead drops on the Mile. Collect them all. The night is young."' },
  { id: 6, name: 'High Roller', payout: 6000, desc: 'Rob Casino Lumen\u2019s vault. Fight through 5 guards, grab the cash, run.', type: 'kill', count: 5, x: LANDMARKS.casino.x, y: LANDMARKS.casino.y, brief: 'ADA: "The Lumen vault holds a week of high-roller cash. Five guards. One vault. Go."' },
  { id: 7, name: 'Skyhook', payout: 2500, desc: 'Steal the Seahawk from the Harbour Helipad and fly it over the causeway.', type: 'fly', x: 130, y: 920, r: 60, brief: 'RICO: "Ever flown? No? Perfect. Steal the Seahawk and buzz the causeway."' },
  { id: 8, name: 'Heat Wave', payout: 3000, desc: 'Survive a 4-star wanted level, then clear your heat at the Sunset Spray Shop.', type: 'escape', x: LANDMARKS.respray.x, y: LANDMARKS.respray.y, r: 40, brief: 'ADA: "The whole PD is on us. Survive the heat, then get resprayed. Stay alive."' },
  { id: 9, name: 'Golden Anchor', payout: 10000, desc: 'The finale: storm the Golden Anchor yacht at Pelican Marina, take the ledger, escape by sea air.', type: 'kill', count: 6, x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, brief: 'ADA: "One last job. The Golden Anchor yacht. The ledger ends this. All of us, together."' },
];

export function currentMission() { return MISSIONS[G.missionIndex] || null; }
export function startMission(i) {
  const m = MISSIONS[i];
  if (!m) return;
  G.missionIndex = i;
  G.mission = { def: m, progress: 0, spawned: false, done: false, collected: 0, t: 0 };
  G.dialogue = { speaker: 'ADA KLINE', text: m.brief, portrait: 0, onDone: null };
  G.screen = 'dialogue';
  showMessage('MISSION ' + (i + 1) + '/10: ' + m.name);
}
export function missionObjectivePos() {
  const m = G.mission && G.mission.def;
  if (!m) return null;
  return { x: m.x, y: m.y, r: m.r || 40 };
}
export function updateMission() {
  const m = G.mission;
  if (!m || m.done) return;
  const d = m.def, p = G.player;
  m.t += 1;
  if (!m.spawned) {
    m.spawned = true;
    if (d.type === 'kill') {
      for (let i = 0; i < d.count; i++) spawnEnemy(d.x + (i % 3) * 40 - 40, d.y + Math.floor(i / 3) * 40 - 20, 50, 'GUARD');
      addWanted(1, 'mission heat');
    }
    if (d.type === 'collect3') {
      G.stashes.push(
        { x: 950, y: 220, value: 400, taken: false, mission: true },
        { x: 1250, y: 420, value: 400, taken: false, mission: true },
        { x: 1100, y: 520, value: 400, taken: false, mission: true },
      );
    }
  }
  let done = false;
  if (d.type === 'goto' || d.type === 'deliver') {
    if (dist(p.x, p.y, d.x, d.y) < (d.r || 40) && (!d.needCar || !p.onFoot)) done = true;
  } else if (d.type === 'kill') {
    m.progress = G.stats.kills - (m.killsAtStart ?? (m.killsAtStart = G.stats.kills));
    if (m.progress >= d.count) done = true;
  } else if (d.type === 'collect') {
    if (dist(p.x, p.y, d.x, d.y) < (d.r || 36)) done = true;
  } else if (d.type === 'collect3') {
    m.progress = G.stashes.filter((s) => s.mission && s.taken).length;
    if (m.progress >= 3) done = true;
  } else if (d.type === 'fly') {
    if (p.heli && p.heli.z > 20 && dist(p.x, p.y, d.x, d.y) < (d.r || 60)) done = true;
  } else if (d.type === 'escape') {
    if (m.t > 600 && G.wanted >= 4) m.escaped = true;
    if (m.escaped && dist(p.x, p.y, d.x, d.y) < (d.r || 40)) done = true;
  }
  if (done) completeMission();
}
export function completeMission() {
  const m = G.mission;
  if (!m || m.done) return;
  m.done = true;
  const d = m.def;
  G.missionsDone.push(d.id);
  G.stats.missions += 1;
  G.rep += 10;
  addCash(d.payout, d.name.toUpperCase());
  showBanner('MISSION PASSED', d.name + '  +$' + d.payout.toLocaleString('en-US') + '  +10 REP' + (G.missionIndex === 9 ? '  — SOLMARINA IS YOURS' : ''));
  sfx.mission();
  if (G.missionIndex === 9) {
    G.screen = 'win';
  } else {
    G.mission = null;
    G.missionIndex += 1;
    // auto-offer next mission via Ada dialogue after a beat
    setTimeout(() => {
      if (G.screen === 'play' && !G.mission) {
        const next = MISSIONS[G.missionIndex];
        if (next) {
          G.dialogue = { speaker: 'ADA KLINE', text: next.brief + ' (Press E at any time to start: ' + next.name + ')', portrait: 0, onDone: null };
          G.screen = 'dialogue';
        }
      }
    }, 1500);
  }
}
// Debug/test helper: complete the current mission through the real completion path.
export function debugCompleteMission() {
  if (!G.mission) startMission(G.missionIndex);
  if (G.mission && G.mission.def.type === 'kill') {
    for (const e of G.enemies) if (!e.dead) { e.hp = 0; e.dead = true; }
    G.stats.kills += G.mission.def.count;
  }
  completeMission();
}
export function percentComplete() {
  return Math.round((G.missionsDone.length / 10) * 100);
}
