import { S, bolts, shots, parts, fx } from '../state.js';
import { store } from '../config.js';
import { $, pick, isTouch, fmt } from '../utils.js';
import { sfx } from '../audio.js';
import { scene, fxG, applyTheme } from '../engine/renderer.js';
import { play } from '../engine/characters.js';
import { LAYOUTS, ARENA, FLOORS } from './data/layouts.js';
import { ENEMY, BOSS_ORDER } from './data/enemies.js';
import { freshMods } from './data/blessings.js';
import { burst } from './fx.js';
import { buildRoom, openDoor, place } from './room.js';
import { newPlayer, disposePlayer, genWaves, alive } from './entities.js';
import { enemiesLoaded, enemiesReady } from '../engine/assets.js';
import { updateCamera } from './loop.js';
import { renderHp, updateFoes, toast } from '../ui/hud.js';
import { showBlessings } from '../ui/blessings.js';
import { renderRecords } from '../ui/menus.js';

function pickLayout() {
  const l = pick(LAYOUTS.filter(x => x !== S.lastLayout));
  S.lastLayout = l; return l;
}

// 计算下一间房：用哪个布局、什么色调、刷什么怪
function roomPlan() {
  const run = S.run;
  if (run.mode === 'campaign') {
    const f = run.floor, k = run.room, boss = k === 2, fl = FLOORS[f], lvl = f * 3 + k;
    const layout = boss ? ARENA : pickLayout();
    return {
      theme: f, layout, boss: boss ? fl.boss : null, lvl,
      num: `${f + 1}-${k + 1}`, name: boss ? fl.arena : layout.name,
      eyebrow: `FLOOR ${f + 1} · ${boss ? 'BOSS' : 'ROOM ' + (k + 1)}`,
      sub: boss ? `击败${ENEMY[fl.boss].boss}` : k === 0 ? `第 ${f + 1} 层 · ${fl.name}` : '清除所有敌人，北门将会开启',
      waves: boss ? [{ [fl.boss]: 1 }] : genWaves(lvl, fl.pool, f === 0 ? 2 : 3),
      hpScale: 1 + lvl * 0.08, bossScale: 1, newFloor: k === 0 && f > 0,
    };
  }
  // 无尽深渊：每 5 层换一次色调并出现首领，敌人池随深度变丰富
  const d = run.depth, th = Math.floor((d - 1) / 5) % 3, boss = d % 5 === 0;
  const bossKey = BOSS_ORDER[(d / 5 - 1) % 3];
  const pool = d <= 3 ? FLOORS[0].pool : d <= 8 ? FLOORS[1].pool : FLOORS[2].pool;
  const layout = boss ? ARENA : pickLayout();
  return {
    theme: th, layout, boss: boss ? bossKey : null, lvl: d - 1,
    num: `深渊 ${d}`, name: boss ? '深渊首领' : layout.name,
    eyebrow: `DEPTH ${d}`, sub: boss ? `击败${ENEMY[bossKey].boss}` : d === 1 ? '一直往下走，看你能到第几层' : '清除所有敌人，北门将会开启',
    waves: boss ? [{ [bossKey]: 1 }] : genWaves(d - 1, pool, d > 6 ? 3 : 2),
    hpScale: 1 + (d - 1) * 0.1, bossScale: 1 + Math.floor((d - 5) / 5) * 0.45, newFloor: d > 1 && (d - 1) % 5 === 0,
  };
}

let waitingRun = false;
export function startRun(m = S.selMode, cls = S.selHero) {
  sfx.init();
  // 敌人模型在后台下载，网速慢时可能还没下完：提示一下，下完自动开始
  if (!enemiesLoaded()) {
    if (waitingRun) return;
    waitingRun = true;
    toast('骷髅们正在赶来 · 马上开始');
    enemiesReady().then(() => { waitingRun = false; startRun(m, cls); },
      () => { waitingRun = false; toast('地牢资源加载失败，请刷新页面重试', 6000); });
    return;
  }
  for (const id of ['menu', 'select', 'over', 'pause', 'upgrade']) $(id).hidden = true;
  S.paused = false; S.hitstop = 0; S.slowmo = 0;
  clearCombat();
  disposePlayer();
  S.run = { mode: m, cls, floor: 0, room: 0, depth: 1 };
  S.player = newPlayer(cls);
  S.mods = freshMods();
  S.stats = { kills: 0, dodges: 0 };
  S.T = 0;
  $('hud').hidden = false; $('touch').hidden = !isTouch;
  enterRoom(true);
  const atk = cls === 'knight' ? '站定挥剑' : '站定施法';
  toast(isTouch ? `左侧拖动移动 · 松手${atk} · 右下角翻滚` : `<em>WASD</em> 移动 · ${atk} · <em>空格</em> 翻滚`, 5200);
}

function clearCombat() {
  for (const e of S.enemies) scene.remove(e.ch.root);
  S.enemies.length = 0;
  bolts.length = 0; shots.length = 0; parts.length = 0; fx.length = 0;
  fxG.clear();
}

function enterRoom(first = false) {
  clearCombat();
  const plan = roomPlan();
  applyTheme(plan.theme);
  buildRoom(plan.layout);
  S.room.plan = plan;
  const p = S.player;
  p.pos.set(0, 0, S.room.hz - 2.5); p.face = Math.PI; p.still = 0; p.rolling = 0; p.swing = null;
  p.ch.root.visible = true;
  if (plan.newFloor) { p.hp = Math.min(p.maxHp, p.hp + 2); setTimeout(() => toast('篝火余温 · 恢复 <em>2</em> 点生命'), 1600); }
  $('roomNum').textContent = plan.num; $('roomName').textContent = plan.name;
  $('boss').hidden = true; $('foes').hidden = false;
  renderHp(); updateFoes();
  updateCamera(0, true);
  S.mode = 'play';
  const b = $('banner');
  $('bannerN').textContent = plan.eyebrow; $('bannerT').textContent = plan.name; $('bannerS').textContent = plan.sub;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  S.room.waitUntil = S.T + (first ? 1.6 : 1.3);
}

export function nextRoom() {
  const run = S.run;
  S.mode = 'transition';
  if (run.mode === 'campaign') { run.room++; if (run.room > 2) { run.room = 0; run.floor++; } }
  else run.depth++;
  $('fade').classList.add('on');
  setTimeout(() => { enterRoom(); $('fade').classList.remove('on'); }, 450);
}

// 房间清空：开门；战役每间都给祝福，无尽模式只在首领后和每 3 层给
export function roomCleared() {
  const room = S.room, run = S.run;
  room.cleared = true;
  openDoor();
  const plan = room.plan;
  if (run.mode === 'campaign' && plan.boss && run.floor === 2) { victory(); return; }
  const bless = run.mode === 'campaign' || plan.boss || run.depth % 3 === 0;
  if (bless) setTimeout(() => { if (S.mode === 'play') showBlessings(); }, 1000);
  else toast('北门已开启');
}

function victory() {
  S.mode = 'over-pending';
  play(S.player.ch, 'Cheer', { loop: true });
  const chest = place('chest', 0, 0, -2);
  const lid = chest.getObjectByName('chest_lid'); if (lid) lid.rotation.x = -1.1;
  burst(0, 1, -2, 0xffd27a, 26, 7, 1.2, 0.5);
  sfx.win();
  setTimeout(() => showOver(true), 2200);
}

export function playerDied() {
  const p = S.player;
  p.dead = true;
  p.swing = null;
  S.mode = 'over-pending';
  play(p.ch, 'Death_A', { loop: false, fade: 0.1 });
  for (const e of alive()) {
    if (e.state === 'spawn') continue;
    e.state = 'taunt'; play(e.ch, 'Taunt', { loop: true });
    if (e.lane) { fxG.remove(e.lane); e.lane = null; }
  }
  sfx.lose();
  setTimeout(() => showOver(false), 1700);
}

function showOver(win) {
  const run = S.run, plan = S.room.plan;
  S.mode = 'over';
  $('touch').hidden = true;
  $('over').classList.toggle('dead', !win);
  if (run.mode === 'campaign') {
    let best = Number(store.get('bonecorr.best') || 0);
    if (win && (!best || S.T < best)) { best = S.T; store.set('bonecorr.best', String(S.T)); }
    $('overEyebrow').textContent = win ? 'Campaign Complete' : `Fallen on Floor ${run.floor + 1}`;
    $('overTitle').textContent = win ? '你走出了骸骨回廊' : `倒在了${plan.num} ${plan.name}`;
    $('stLabel1').textContent = '用时'; $('stMain').textContent = fmt(S.T);
    $('stLabel4').textContent = '最佳通关'; $('stBest').textContent = best ? fmt(best) : '—';
  } else {
    const reached = run.depth;
    const best = Math.max(Number(store.get('bonecorr.depth') || 0), reached);
    store.set('bonecorr.depth', String(best));
    $('overEyebrow').textContent = `Endless · ${fmt(S.T)}`;
    $('overTitle').textContent = `沉入深渊第 ${reached} 层`;
    $('stLabel1').textContent = '到达层数'; $('stMain').textContent = reached;
    $('stLabel4').textContent = '最深纪录'; $('stBest').textContent = best;
  }
  $('stKills').textContent = S.stats.kills;
  $('stDodge').textContent = S.stats.dodges;
  $('over').hidden = false;
  $('againBtn').focus({ preventScroll: true });
}

// 回到标题：重建第一间房当背景，英雄站在画面右侧
export function toMenu() {
  for (const id of ['over', 'pause', 'upgrade', 'select']) $(id).hidden = true;
  $('hud').hidden = true; $('touch').hidden = true; S.paused = false;
  clearCombat();
  S.run = null;
  applyTheme(0);
  buildRoom(LAYOUTS[0]);
  setMenuHero(S.selHero);
  S.mode = 'menu';
  renderRecords();
  $('menu').hidden = false;
}
export function setMenuHero(key) {
  disposePlayer();
  S.player = newPlayer(key); S.player.pos.set(1, 0, 2); S.player.face = 0.5;
}
