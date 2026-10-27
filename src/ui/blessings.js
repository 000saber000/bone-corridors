import { S } from '../state.js';
import { $, clamp, rand, isTouch } from '../utils.js';
import { sfx } from '../audio.js';
import { RUNE } from '../engine/textures.js';
import { play } from '../engine/characters.js';
import { ICON, ICON_PAL, RARITY, BLESSINGS } from '../game/data/blessings.js';
import { beamFx, ringFx, burst, popup, screenOf } from '../game/fx.js';
import { pixSvg } from './pixel.js';
import { renderHp, toast } from './hud.js';

// ---------- 清完房间后的三选一祝福 ----------
export function showBlessings() {
  const pool = BLESSINGS.filter(b => !(b.once && S.mods.taken.includes(b.id)) && (!b.cls || b.cls === S.run.cls));
  S.offered = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  $('upEyebrow').textContent = S.room.plan.boss ? 'Boss Defeated' : 'Room Cleansed';
  $('cards').innerHTML = S.offered.map((b, i) => `
    <button class="card ${RARITY[b.tag]}" type="button" data-i="${i}">
      <div class="top">${pixSvg(ICON[b.icon], ICON_PAL, { outline: true, cls: 'icon' })}${isTouch ? '' : `<span class="key">${i + 1}</span>`}</div>
      <h3>${b.name}</h3><p>${b.desc}</p><span class="tag">${b.tag}</span>
    </button>`).join('');
  $('cards').querySelectorAll('.card').forEach(el => el.addEventListener('click', () => chooseBlessing(Number(el.dataset.i))));
  S.mode = 'upgrade';
  S.absorbing = false;
  $('upgrade').classList.remove('absorbing');
  $('upgrade').hidden = false;
  setTimeout(() => $('cards').querySelector('.card')?.focus({ preventScroll: true }), 50);
}

// 选中的卡片先闪亮收缩，化作一团光沿弧线飞向英雄，落地时光柱冲天
export function chooseBlessing(i) {
  if (S.mode !== 'upgrade' || S.absorbing || !S.offered[i]) return;
  S.absorbing = true;
  const b = S.offered[i];
  const cards = [...$('cards').children];
  cards.forEach((c, j) => { c.classList.add(j === i ? 'chosen' : 'discard'); c.disabled = true; });
  $('upgrade').classList.add('absorbing');
  sfx.pick();
  const r = cards[i].getBoundingClientRect();
  const start = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  setTimeout(() => flySoul(start, b), 300);
}

function flySoul(start, b) {
  const layer = $('fly');
  const soul = document.createElement('div'); soul.className = 'soul'; layer.appendChild(soul);
  const p = S.player.pos;
  const end = screenOf(p.x, 1.3, p.z);
  const side = start.x < end.x ? -1 : 1;
  const ctrl = { x: (start.x + end.x) / 2 + side * Math.min(220, innerWidth * 0.25), y: Math.min(start.y, end.y) - Math.min(200, innerHeight * 0.25) };
  const dur = 720, t0 = performance.now();
  let lastTrail = 0;
  sfx.whoosh();
  const tick = now => {
    const k = clamp((now - t0) / dur, 0, 1), e = k * k;   // 二次贝塞尔曲线，越飞越快
    const x = (1 - e) ** 2 * start.x + 2 * (1 - e) * e * ctrl.x + e * e * end.x;
    const y = (1 - e) ** 2 * start.y + 2 * (1 - e) * e * ctrl.y + e * e * end.y;
    // 位置取整到 4px，保持像素感
    soul.style.transform = `translate(${Math.round(x / 4) * 4}px, ${Math.round(y / 4) * 4}px) rotate(45deg) scale(${(1 - 0.45 * e).toFixed(2)})`;
    if (now - lastTrail > 24) {
      lastTrail = now;
      const t = document.createElement('i'); t.className = 'trail';
      t.style.transform = `translate(${Math.round((x + rand(-6, 6)) / 4) * 4}px, ${Math.round((y + rand(-6, 6)) / 4) * 4}px)`;
      layer.appendChild(t); setTimeout(() => t.remove(), 520);
    }
    if (k < 1) requestAnimationFrame(tick);
    else { soul.remove(); absorbImpact(b); }
  };
  requestAnimationFrame(tick);
}

function absorbImpact(b) {
  const pl = S.player, p = pl.pos;
  b.apply(S.mods, pl); S.mods.taken.push(b.id);
  renderHp();
  sfx.bless();
  beamFx(p.x, p.z);
  ringFx(p.x, p.z, 0xffd27a, 0.6, 7, 0.7, 1);
  ringFx(p.x, p.z, 0xfff2b0, 0.3, 4, 0.5, 0.8, RUNE);
  burst(p.x, 0.3, p.z, 0xffe9a8, 26, 3.2, 1.2, 0.32, 4);
  pl.glow = 1;
  play(pl.ch, 'Cheer', { loop: false, restart: true, fade: 0.1, timeScale: 1.5 });
  pl.hitAnimUntil = S.T + 0.9;
  popup(b.name, p, 'big');
  setTimeout(() => {
    $('upgrade').hidden = true;
    $('upgrade').classList.remove('absorbing');
    S.absorbing = false;
    S.mode = 'play';
    toast(`获得祝福「<em>${b.name}</em>」· 北门已开启`);
  }, 1000);
}
