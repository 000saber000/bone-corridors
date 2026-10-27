import { S } from '../state.js';
import { $, clamp, fmt } from '../utils.js';
import { sfx } from '../audio.js';
import { HEART_FULL, HEART_EMPTY, SKULL, SOUND_ON, SOUND_OFF, PAUSE } from './pixel.js';

// ---------- 顶部 HUD：生命、翻滚冷却、房间名、剩余敌人 / 首领血条、计时 ----------
export function renderHp() {
  const p = S.player; if (!p) return;
  $('hp').innerHTML = Array.from({ length: p.maxHp }, (_, i) => (i < p.hp ? HEART_FULL : HEART_EMPTY)).join('');
}
export function updateFoes() {
  $('foeN').textContent = S.enemies.filter(e => e.state !== 'dead').length;
}
// 场上有首领时，用首领血条替换“剩余敌人”
export function updateBoss() {
  const e = S.enemies.find(x => x.boss && x.state !== 'dead');
  if (!e) return;
  $('bossName').textContent = e.boss;
  $('boss').hidden = false; $('foes').hidden = true;
  $('bossFill').style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
}

let lastClock = '', lastSegs = -1, rollSegs = [];
export function updateHud() {
  const p = S.player;
  if (!p || !S.run) return;
  const k = clamp(1 - (p.rollReadyAt - S.T) / p.rollTotal, 0, 1);
  const ready = k >= 1 && p.rolling <= 0;
  const segs = ready ? 5 : Math.floor(k * 5);
  if (segs !== lastSegs) { lastSegs = segs; rollSegs.forEach((s, i) => s.classList.toggle('on', i < segs)); }
  $('rollPip').classList.toggle('ready', ready);
  const btn = $('rollBtn'); btn.style.setProperty('--p', (Math.floor(k * 8) / 8).toFixed(3)); btn.classList.toggle('ready', ready);
  const c = fmt(S.T); if (c !== lastClock) { $('clock').textContent = c; lastClock = c; }
  updateFoes();
}

let toastTimer = 0;
export function toast(html, ms = 3200) {
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function showProgress(p) {
  const pct = Math.round(p * 100);
  $('loadFill').style.width = pct + '%';
  $('loadText').textContent = `正在唤醒地牢 · ${pct}%`;
}

export function initHud() {
  rollSegs = [...document.querySelectorAll('#rollPip .segs i')];
  $('pauseBtn').innerHTML = PAUSE;
  $('skull').outerHTML = SKULL;
  const syncSound = () => { $('soundBtn').innerHTML = sfx.on ? SOUND_ON : SOUND_OFF; };
  syncSound();
  $('soundBtn').addEventListener('click', () => { sfx.toggle(); syncSound(); });
}
