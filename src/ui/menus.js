import { S } from '../state.js';
import { store } from '../config.js';
import { $, fmt, isTouch } from '../utils.js';
import { sfx } from '../audio.js';
import { play } from '../engine/characters.js';
import { CLASSES, ROLE_PAL } from '../game/data/classes.js';
import { startRun, toMenu, setMenuHero } from '../game/flow.js';
import { resetInput } from '../input.js';
import { pixSvg } from './pixel.js';

// 标题页下方的个人纪录
export function renderRecords() {
  const best = Number(store.get('bonecorr.best') || 0), depth = Number(store.get('bonecorr.depth') || 0);
  const rec = [];
  if (best) rec.push(`<span>战役最佳</span> ${fmt(best)}`);
  if (depth) rec.push(`<span>深渊最深</span> 第 ${depth} 层`);
  $('records').innerHTML = rec.join('　');
}

// ---------- 英雄选择 ----------
export function openSelect(m) {
  S.selMode = m;
  $('menu').hidden = true;
  $('selEyebrow').textContent = m === 'campaign' ? 'Campaign · 三层地牢' : 'Endless Abyss · 无尽深渊';
  $('heroes').innerHTML = Object.entries(CLASSES).map(([k, c], i) => `
    <button class="hero ${c.rarity}${k === S.selHero ? ' sel' : ''}" type="button" data-k="${k}">
      <div class="head">${pixSvg(c.icon, ROLE_PAL, { outline: true })}<h3>${c.name}</h3>${isTouch ? '' : `<span class="key" style="margin-left:auto;color:var(--rc);background:#000;padding:0 6px;line-height:20px">${i + 1}</span>`}</div>
      <span class="role">${c.role}</span>
      <p>${c.desc}</p>
      <div class="bars">${Object.entries(c.stats).map(([n, v]) => `<div class="bar-row"><span>${n}</span><span class="pips">${'<i class="on"></i>'.repeat(v)}${'<i></i>'.repeat(5 - v)}</span></div>`).join('')}</div>
    </button>`).join('');
  // 点没选中的卡片是切换，再点一次已选中的卡片直接出发
  $('heroes').querySelectorAll('.hero').forEach(el => {
    el.addEventListener('click', () => { if (el.dataset.k === S.selHero) startRun(S.selMode, S.selHero); else chooseHero(el.dataset.k); });
  });
  S.mode = 'select';
  $('select').hidden = false;
  setTimeout(() => $('goBtn').focus({ preventScroll: true }), 50);
}
export function chooseHero(k) {
  if (!CLASSES[k] || k === S.selHero) return;
  S.selHero = k; store.set('bonecorr.hero', k);
  $('heroes').querySelectorAll('.hero').forEach(el => el.classList.toggle('sel', el.dataset.k === k));
  setMenuHero(k);
  play(S.player.ch, 'Cheer', { loop: false, restart: true, timeScale: 1.3 });
  sfx.init(); sfx.pick();
}

export function togglePause() {
  if (S.mode !== 'play') return;
  S.paused = !S.paused;
  $('pause').hidden = !S.paused;
  if (S.paused) { resetInput(); $('resumeBtn').focus({ preventScroll: true }); }
}

export function initMenus() {
  const again = () => startRun(S.run.mode, S.run.cls);
  $('pauseBtn').addEventListener('click', togglePause);
  $('resumeBtn').addEventListener('click', togglePause);
  $('restartBtn').addEventListener('click', again);
  $('menuBtn').addEventListener('click', toMenu);
  $('campaignBtn').addEventListener('click', () => { sfx.init(); openSelect('campaign'); });
  $('endlessBtn').addEventListener('click', () => { sfx.init(); openSelect('endless'); });
  $('goBtn').addEventListener('click', () => startRun(S.selMode, S.selHero));
  $('backBtn').addEventListener('click', toMenu);
  $('againBtn').addEventListener('click', again);
  $('overMenuBtn').addEventListener('click', toMenu);
}
