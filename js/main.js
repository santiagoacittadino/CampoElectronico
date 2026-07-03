import { FieldRenderer } from './gl.js';
import { ElectricAudio } from './audio.js';

const canvas = document.getElementById('field');
const overlay = document.getElementById('overlay');
const styleToggle = document.getElementById('styleToggle');

const renderer = new FieldRenderer(canvas);
const audio = new ElectricAudio();

let styleTarget = 0;
let styleValue = 0;

styleToggle.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
});
styleToggle.addEventListener('click', () => {
  styleTarget = styleTarget > 0.5 ? 0 : 1;
  styleToggle.classList.toggle('active', styleTarget > 0.5);
});

const ATTACK_SPEED = 6.0;
const RELEASE_SPEED = 1.8;
const HUE_STEP = 0.618033988749895; // golden ratio conjugate for varied hues

let hueCursor = Math.random();
const activeTouches = new Map();
let lastTime = performance.now() / 1000;

function normalizedPos(clientX, clientY) {
  const x = clientX / window.innerWidth;
  const y = 1 - clientY / window.innerHeight;
  return { x, y };
}

function nextHue() {
  hueCursor = (hueCursor + HUE_STEP) % 1;
  return hueCursor;
}

function onPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  overlay.classList.add('hidden');

  const { x, y } = normalizedPos(e.clientX, e.clientY);
  const hue = nextHue();

  activeTouches.set(e.pointerId, {
    x, y, hue,
    life: 0,
    age: 0,
    startTime: performance.now() / 1000,
    releasing: false,
  });

  audio.onTouchStart(e.pointerId, x, y);
  if (canvas.setPointerCapture) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
}

function onPointerMove(e) {
  const t = activeTouches.get(e.pointerId);
  if (!t || t.releasing) return;

  const { x, y } = normalizedPos(e.clientX, e.clientY);
  t.x = x;
  t.y = y;

  audio.onTouchMove(e.pointerId, x, y);
}

function onPointerUp(e) {
  const t = activeTouches.get(e.pointerId);
  if (!t) return;
  t.releasing = true;
  audio.onTouchEnd(e.pointerId);
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
canvas.addEventListener('pointermove', onPointerMove, { passive: true });
canvas.addEventListener('pointerup', onPointerUp, { passive: true });
canvas.addEventListener('pointercancel', onPointerUp, { passive: true });
canvas.addEventListener('pointerleave', onPointerUp, { passive: true });

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 120));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => renderer.resize());
}
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

function frame() {
  const now = performance.now() / 1000;
  const dt = Math.min(now - lastTime, 0.05);
  lastTime = now;

  for (const [id, t] of activeTouches) {
    if (t.releasing) {
      t.life -= RELEASE_SPEED * dt;
      if (t.life <= 0) {
        activeTouches.delete(id);
        continue;
      }
    } else {
      t.life = Math.min(1, t.life + ATTACK_SPEED * dt);
      t.age += dt;
    }
  }

  styleValue += (styleTarget - styleValue) * Math.min(1, dt * 3.5);

  renderer.render(now, Array.from(activeTouches.values()), styleValue);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
