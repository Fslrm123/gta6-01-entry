// state.js — the single mutable game state object G. Freshly authored.
export const WORLD_W = 2560;
export const WORLD_H = 1920;

export function createState() {
  return {
    screen: 'title', // title | play | pause | shop | dialogue | dead | win
    paused: false,
    time: 0,            // frames elapsed
    clockMin: 8 * 60 + 12, // 08:12 day 1
    day: 1,
    cash: 250,
    rep: 0,
    health: 100,
    armour: 0,
    wanted: 0,          // 0..5 float
    heat: 0,
    weapon: 0,          // 0 fists, 1 pistol, 2 smg
    weapons: [
      { name: 'FISTS', ammo: Infinity, owned: true },
      { name: 'PISTOL', ammo: 24, owned: true },
      { name: 'SMG', ammo: 0, owned: false },
    ],
    player: { x: 1280, y: 1500, angle: -Math.PI / 2, speed: 0, onFoot: true, car: null, heli: null, moving: false, sprint: false },
    cars: [], peds: [], cops: [], bullets: [], enemies: [], popups: [], particles: [],
    heli: null,         // player heli entity when it exists in world
    policeHeli: null,
    traffic: [],
    missionsDone: [],   // ids completed
    missionIndex: 0,    // current mission id (0-based)
    mission: null,      // active mission runtime
    stashes: [],        // {x,y,taken}
    stats: { carsStolen: 0, copsLost: 0, kills: 0, missions: 0, shots: 0, nearMiss: 0, drift: 0, distance: 0 },
    radio: 0, radioOn: true, muted: false,
    cam: { x: 1280, y: 1500 },
    banner: null,       // {text, sub, t}
    dialogue: null,     // {speaker, text, portrait, onDone}
    shop: null,         // {kind, items}
    shopMsg: '',
    message: '', messageT: 0,
    resprayFree: false,
    garage: [],
    nos: 100,
    carCondition: 100,
    objectiveFlash: 0,
    seed: 1,
    testMode: false,
  };
}
export const G = createState();
export function resetState() {
  const fresh = createState();
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, fresh);
}
