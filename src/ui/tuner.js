import { S } from '../state.js';
import { SLIDERS, cfg, saveCfg, resetCfg } from '../config.js';
import { $ } from '../utils.js';
import { applyPixelate } from '../engine/renderer.js';

// ---------- 调参面板：按 T，或连点标题 / 房间名 3 次打开 ----------
let pausedByTuner = false;

function buildSliders() {
  $('sliders').innerHTML = SLIDERS.map(s => `
    <div class="slider">
      <label for="cfg-${s.key}">${s.label}<output id="out-${s.key}">${cfg[s.key]}</output></label>
      <input id="cfg-${s.key}" type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${cfg[s.key]}">
    </div>`).join('');
  SLIDERS.forEach(s => $('cfg-' + s.key).addEventListener('input', ev => {
    cfg[s.key] = Number(ev.target.value); $('out-' + s.key).textContent = cfg[s.key]; saveCfg();
    if (s.key === 'pixelate') applyPixelate();
  }));
}

export function openTuner() {
  if (!$('tuner').hidden) return;
  $('tuner').hidden = false;
  if (S.mode === 'play' && !S.paused) { S.paused = true; pausedByTuner = true; }
}
export function closeTuner() {
  $('tuner').hidden = true; $('cfgOut').hidden = true;
  if (pausedByTuner) { S.paused = false; pausedByTuner = false; }
}
export function toggleTuner() { $('tuner').hidden ? openTuner() : closeTuner(); }
export const tunerOpen = () => !$('tuner').hidden;

function tripleTap(el) {
  let taps = [];
  el.style.pointerEvents = 'auto';
  el.addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    const now = performance.now(); taps = taps.filter(t => now - t < 650); taps.push(now);
    if (taps.length >= 3) { taps = []; openTuner(); }
  });
}

export function initTuner() {
  buildSliders();
  tripleTap($('menuTitle'));
  tripleTap(document.querySelector('.room-label'));
  $('tunerClose').addEventListener('click', closeTuner);
  $('resetCfg').addEventListener('click', () => { resetCfg(); buildSliders(); applyPixelate(); });
  // 复制当前参数，方便发给开发者写成默认值；剪贴板不可用时退回到可选中的文本框
  $('copyCfg').addEventListener('click', () => {
    const text = JSON.stringify(cfg, null, 2), out = $('cfgOut');
    const fallback = () => { out.value = text; out.hidden = false; out.focus(); out.select(); };
    try {
      navigator.clipboard.writeText(text).then(() => {
        $('copyCfg').textContent = '已复制'; setTimeout(() => { $('copyCfg').textContent = '复制参数'; }, 1500);
      }, fallback);
    } catch (err) { fallback(); }
  });
}
