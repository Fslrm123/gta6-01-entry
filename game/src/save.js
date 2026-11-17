// save.js — save and load for Solmarina, kept in localStorage under one
// key. Saves cash, health, armor, weapons, mission progress, position and
// lifetime stats. Never touches anything else.

const KEY = 'solmarina-save-v1';

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      version: 1,
      cash: p.cash,
      health: p.health,
      armor: p.armor,
      weapon: p.weapon,
      ammo: p.ammo,
      x: p.x, y: p.y,
      missionIndex: game.missions.index,
      kills: p.kills,
      carsStolen: p.carsStolen,
      missionsDone: p.missionsDone,
      wanted: game.wanted,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
