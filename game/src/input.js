// input.js — keyboard + mouse state. Freshly authored.
export const keys = {};
export const mouse = { x: 240, y: 135, down: false, clicked: false };
export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * 480;
    mouse.y = (e.clientY - r.top) / r.height * 270;
  });
  canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('click', () => canvas.focus());
}
export const pressed = (k) => !!keys[k];
export function edgePressed(k) {
  if (keys[k] && !keys['_' + k]) { keys['_' + k] = true; return true; }
  if (!keys[k]) keys['_' + k] = false;
  return false;
}
