// save.js — localStorage save/load. Freshly authored.
import { G } from './state.js';
import { showMessage } from './player.js';
export const SAVE_KEY = 'solmarina-save-v3';

export function saveGame() {
  try {
    const data = {
      cash: G.cash, rep: G.rep, health: G.health, armour: G.armour,
      day: G.day, clockMin: G.clockMin, weapons: G.weapons,
      missionsDone: G.missionsDone, missionIndex: G.missionIndex,
      stats: G.stats, garage: G.garage,
      px: G.player.x, py: G.player.y,
      stashesTaken: G.stashes.filter((s) => s.taken).length,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    showMessage('Progress saved — Day ' + G.day);
    return true;
  } catch { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    G.cash = d.cash; G.rep = d.rep; G.health = d.health; G.armour = d.armour;
    G.day = d.day; G.clockMin = d.clockMin; G.weapons = d.weapons;
    G.missionsDone = d.missionsDone; G.missionIndex = d.missionIndex;
    G.stats = d.stats; G.garage = d.garage || [];
    G.player.x = d.px; G.player.y = d.py;
    G.mission = null;
    return true;
  } catch { return false; }
}
export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
