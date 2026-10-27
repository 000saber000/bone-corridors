import { S } from './state.js';
import { $ } from './utils.js';
import { tryRoll } from './game/player.js';
import { startRun, toMenu } from './game/flow.js';
import { chooseBlessing } from './ui/blessings.js';
import { chooseHero, togglePause } from './ui/menus.js';
import { toggleTuner, closeTuner, tunerOpen } from './ui/tuner.js';

// ---------- 键盘 + 触屏虚拟摇杆 ----------
const keys = new Set();
const joy = { id: null, ox: 0, oy: 0, vx: 0, vy: 0 };

// 当前移动方向（单位向量）和推杆力度；没有输入时返回 null
export function inputDir() {
  let x = 0, z = 0;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z--;
  if (joy.id !== null && (joy.vx || joy.vy)) { x = joy.vx; z = joy.vy; }
  const l = Math.hypot(x, z);
  return l > 0.12 ? { x: x / l, z: z / l, m: Math.min(1, l) } : null;
}

export function resetInput() {
  keys.clear();
  joy.id = null; joy.vx = joy.vy = 0;
  $('joy').classList.remove('on');
}

function onKeyDown(e) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) { if (e.code === 'Escape') closeTuner(); return; }
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyT') { toggleTuner(); return; }
  if (tunerOpen()) { if (e.code === 'Escape') closeTuner(); return; }
  if (S.mode === 'play') {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); tryRoll(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  } else if (S.mode === 'upgrade') {
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (n >= 0) chooseBlessing(n);
  } else if (S.mode === 'select') {
    if (e.code === 'Digit1' || e.code === 'ArrowLeft') chooseHero('mage');
    if (e.code === 'Digit2' || e.code === 'ArrowRight') chooseHero('knight');
    if (e.code === 'Escape') toMenu();
  } else if (S.mode === 'over' && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault(); startRun(S.run.mode, S.run.cls);
  }
}

export function initInput() {
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); if (S.mode === 'play' && !S.paused) togglePause(); });

  // 触屏：按下的位置就是摇杆中心，拖动方向即移动方向，松手即站定
  const stage = $('stage'), joyEl = $('joy'), knob = joyEl.querySelector('i');
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || S.mode !== 'play' || S.paused || joy.id !== null) return;
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.vx = joy.vy = 0;
    joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.add('on');
    knob.style.transform = '';
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerId !== joy.id) return;
    const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.hypot(dx, dy), R = 60;
    if (d < 8) { joy.vx = joy.vy = 0; knob.style.transform = ''; return; }
    const m = Math.min(d, R) / R;
    joy.vx = (dx / d) * m; joy.vy = (dy / d) * m;
    knob.style.transform = `translate(${Math.round(joy.vx * R / 4) * 4}px, ${Math.round(joy.vy * R / 4) * 4}px)`;
  });
  const endJoy = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.vx = joy.vy = 0; joyEl.classList.remove('on'); };
  stage.addEventListener('pointerup', endJoy);
  stage.addEventListener('pointercancel', endJoy);
  $('rollBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tryRoll(); });
}
