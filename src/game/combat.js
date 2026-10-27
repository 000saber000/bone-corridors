import * as THREE from 'three';
import { S, bolts, shots } from '../state.js';
import { cfg } from '../config.js';
import { $ } from '../utils.js';
import { sfx } from '../audio.js';
import { fxG } from '../engine/renderer.js';
import { glowMat } from '../engine/textures.js';
import { play, flash, clipLen } from '../engine/characters.js';
import { burst, dot, ringFx, slashFx, impactFx, popup, dmgNum, freeze, shakeAdd } from './fx.js';
import { alive, targetable } from './entities.js';
import { blocked, outside } from './room.js';
import { playerDied } from './flow.js';
import { renderHp, updateFoes, updateBoss } from '../ui/hud.js';

export function nearestEnemy(range) {
  const p = S.player.pos;
  let best = null, bd = range * range;
  for (const e of S.enemies) {
    if (!targetable(e)) continue;
    const d = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2 - e.r * e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- 英雄受伤：翻滚中算闪避，受伤后有短暂无敌 ----------
export function hurtPlayer() {
  const p = S.player;
  if (p.dead || S.mode !== 'play') return false;
  if (p.rolling > 0) { S.stats.dodges++; popup('闪避', p.pos); sfx.dodge(); return false; }
  if (S.T < p.invulnUntil) return false;
  p.hp--; p.invulnUntil = S.T + 0.9;
  shakeAdd(0.45); freeze(0.06);
  const h = $('hurt'); h.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
  $('hp').classList.remove('hit'); void $('hp').offsetWidth; $('hp').classList.add('hit');
  renderHp(); sfx.hurt();
  burst(p.pos.x, 1.2, p.pos.z, 0xff4a4a, 10, 5, 0.4, 0.4);
  if (!p.swing && p.rolling <= 0) { play(p.ch, 'Hit_A', { loop: false, restart: true, fade: 0.05, timeScale: 1.6 }); p.hitAnimUntil = S.T + 0.35; }
  if (p.hp <= 0) playerDied();
  return true;
}

// 攻击是否来自敌人正面（持盾骷髅格挡用）；vx, vz 指向攻击者
function fromFront(e, vx, vz) {
  const l = Math.hypot(vx, vz) || 1;
  return (vx * Math.sin(e.face) + vz * Math.cos(e.face)) / l > Math.cos(1.25);
}

// ---------- 敌人受伤：格挡、暴击、硬直、击退、伤害数字、顿帧 ----------
export function damageEnemy(e, base, dx, dz, { melee = false } = {}) {
  if (!targetable(e)) return false;
  if (!melee && e.guard && fromFront(e, -dx, -dz)) {
    // 远程打在骨盾上：被弹开
    impactFx(e.pos.x + Math.sin(e.face) * (e.r + 0.4), 1.3, e.pos.z + Math.cos(e.face) * (e.r + 0.4), 0x7fd0ff);
    if (e.shield) e.shield.material.opacity = 1;
    dmgNum(e, '格挡', 'block'); sfx.clank();
    return 'blocked';
  }
  let breakGuard = false;
  if (melee && e.guard) { e.guard = false; e.guardBreakUntil = S.T + 1.8; breakGuard = true; }
  const crit = Math.random() < 0.08 + S.mods.critAdd;
  const dmg = Math.max(1, Math.round(base * (crit ? 2 : 1)));
  e.hp -= dmg;
  flash(e.ch, S.T, e.boss ? 0.4 : 0.95);
  e.punch = 1;
  const k = e.boss ? 0.8 : melee ? 8 : 4.5;
  e.kx += dx * k; e.kz += dz * k;
  if (!e.boss && ['chase', 'keep', 'recover'].includes(e.state)) {
    e.staggerUntil = S.T + (melee ? 0.32 : 0.18);
    play(e.ch, 'Hit_A', { loop: false, restart: true, fade: 0.04, timeScale: 2 });
  }
  const hy = 1.3 * e.scale + e.y;
  dmgNum(e, dmg, crit ? 'crit' : '');
  impactFx(e.pos.x - dx * e.r * 0.6, hy, e.pos.z - dz * e.r * 0.6, crit ? 0xfff2b0 : melee ? 0xc8f1ff : 0xd8b8ff, crit);
  burst(e.pos.x, hy, e.pos.z, crit ? 0xfff2b0 : 0xe8dcc4, crit ? 12 : 6, crit ? 7 : 5, 0.32, 0.3);
  if (crit) { sfx.crit(); freeze(0.09); shakeAdd(0.25); }
  else { sfx.hit(); freeze(melee ? 0.055 : 0.03); shakeAdd(melee ? 0.14 : 0.07); }
  if (breakGuard) { popup('破盾', e.pos); sfx.clank(); }
  if (e.boss) updateBoss();
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function cleanupEnemyFx(e) {
  for (const k of ['rune', 'lane', 'orb', 'shield', 'marker']) if (e[k]) { fxG.remove(e[k]); e[k] = null; }
}
export function killEnemy(e) {
  e.state = 'dead'; e.t = 0; e.y = 0;
  cleanupEnemyFx(e);
  play(e.ch, 'Death_C_Skeletons', { loop: false, fade: 0.1 });
  burst(e.pos.x, 1, e.pos.z, 0xe8dcc4, e.boss ? 34 : 14, e.boss ? 8 : 6, 0.65, 0.38);
  ringFx(e.pos.x, e.pos.z, 0xe8dcc4, 0.5, e.boss ? 8 : 3, 0.35, 0.7);
  S.stats.kills++;
  sfx.bones();
  freeze(e.boss ? 0.2 : 0.07); shakeAdd(e.boss ? 0.6 : 0.16);
  const p = S.player;
  if (S.mods && S.mods.leech && ++p.leech >= 10) { p.leech = 0; if (p.hp < p.maxHp) { p.hp++; renderHp(); popup('+1', p.pos); } }
  updateFoes();
  if (e.boss) { $('bossFill').style.width = '0%'; for (const o of alive()) killEnemy(o); S.slowmo = 1.1; }
  else if (alive().length === 0) S.slowmo = 0.5;   // 每波最后一只：短暂慢动作
}
export function shockwave() {
  const p = S.player.pos;
  ringFx(p.x, p.z, 0xffd27a, 1, 8, 0.4);
  for (const e of S.enemies) {
    if (!targetable(e)) continue;
    const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d < 3.6) damageEnemy(e, 2 * cfg.dmgMul, dx / (d || 1), dz / (d || 1), { melee: true });
  }
}

// ---------- 子弹 ----------
export function fireBolts(tgt) {
  const p = S.player, mods = S.mods;
  const base = Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z);
  const n = 1 + mods.extraShots;
  const charged = mods.charge && p.still > 1.2;
  const dmg = (p.cls.damage + mods.dmgAdd) * cfg.dmgMul * (charged ? 2 : 1);
  const tipX = p.pos.x + Math.sin(base) * 0.9, tipZ = p.pos.z + Math.cos(base) * 0.9;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.16;
    const color = charged ? 0xffe9a8 : 0xc39bff;
    const s = new THREE.Sprite(glowMat(color)); s.scale.setScalar(charged ? 1.15 : 0.9);
    const core = new THREE.Sprite(glowMat(0xffffff)); core.scale.setScalar(0.38);
    s.position.set(tipX, 1.45, tipZ); core.position.copy(s.position); fxG.add(s, core);
    bolts.push({ s, core, x: tipX, z: tipZ, vx: Math.sin(a) * 26, vz: Math.cos(a) * 26, life: p.cls.range / 26 + 0.15, dmg, color, pierce: mods.pierce, hit: new Set() });
  }
  impactFx(tipX, 1.45, tipZ, charged ? 0xffe9a8 : 0xc39bff);
  S.heroPulse = 1;
  sfx.bolt();
}
export function fireShot(x, z, a, speed, color = 0xb98cff) {
  const s = new THREE.Sprite(glowMat(color)); s.scale.setScalar(1.05);
  const core = new THREE.Sprite(glowMat(0xffffff)); core.scale.setScalar(0.4);
  s.position.set(x, 1.15, z); core.position.copy(s.position);
  fxG.add(s, core);
  shots.push({ s, core, x, z, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, life: 6, dodged: false, color });
}
export function removeAt(arr, i) { const o = arr[i]; fxG.remove(o.s); if (o.core) fxG.remove(o.core); arr.splice(i, 1); }

export function updateProjectiles(dt) {
  // 法师飞弹
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
    b.s.position.set(b.x, 1.45, b.z); b.core.position.copy(b.s.position);
    dot(b.x, 1.45, b.z, b.color, 0.55, 0.14);
    if (b.life <= 0 || outside(b.x, b.z) || blocked(b.x, b.z)) { burst(b.x, 1.45, b.z, b.color, 4, 3, 0.2, 0.25); removeAt(bolts, i); continue; }
    for (const e of S.enemies) {
      if (!targetable(e) || b.hit.has(e)) continue;
      if (Math.hypot(e.pos.x - b.x, e.pos.z - b.z) < e.r + 0.3) {
        const l = Math.hypot(b.vx, b.vz);
        const res = damageEnemy(e, b.dmg, b.vx / l, b.vz / l);
        b.hit.add(e);
        if (res === 'blocked' || b.pierce-- <= 0) removeAt(bolts, i);
        break;
      }
    }
  }
  // 敌方弹幕：翻滚中穿过算闪避
  const p = S.player;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
    s.s.position.set(s.x, 1.15, s.z); s.core.position.copy(s.s.position);
    if (s.life <= 0 || outside(s.x, s.z) || blocked(s.x, s.z)) { burst(s.x, 1.15, s.z, s.color, 3, 3, 0.25, 0.3); removeAt(shots, i); continue; }
    if (!p.dead && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 0.75) {
      if (p.rolling > 0) { if (!s.dodged) { s.dodged = true; hurtPlayer(); } }
      else if (hurtPlayer()) removeAt(shots, i);
    }
  }
}

// ---------- 骑士近战 ----------
export const reachOf = p => p.cls.reach + S.mods.reachAdd;
export function startSwing() {
  const p = S.player, c = p.cls, mods = S.mods;
  const dur = 1 / (c.swingRate * mods.rateMul * cfg.atkMul);
  p.swings++;
  const spin = mods.spinEvery > 0 && p.swings % mods.spinEvery === 0;
  p.swing = { t: 0, dur, hitAt: Math.max(0.08, dur * 0.3), hitDone: false, spin };
  const anim = p.swings % 2 ? '1H_Melee_Attack_Slice_Horizontal' : '1H_Melee_Attack_Slice_Diagonal';
  play(p.ch, anim, { loop: false, restart: true, fade: 0.05, timeScale: clipLen(p.ch, anim) / (dur * 1.05) });
  p.nextShot = S.T + dur;
}
export function meleeHit(spin) {
  const p = S.player, c = p.cls, mods = S.mods, reach = reachOf(p);
  const fx = Math.sin(p.face), fz = Math.cos(p.face);
  const charged = mods.charge && p.still > 1.2;
  const dmg = (c.damage + mods.dmgAdd * 2) * cfg.dmgMul * (charged ? 2 : 1) * (spin ? 1.3 : 1);
  slashFx(p.pos, p.face, reach, spin);
  sfx.slash();
  const inArc = (dx, dz, d) => spin || d < 0.6 || (dx * fx + dz * fz) / d > Math.cos(1.25);  // 约 140° 扇形
  for (const e of S.enemies) {
    if (!targetable(e)) continue;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > reach + e.r || !inArc(dx, dz, d)) continue;
    damageEnemy(e, dmg, dx / (d || 1), dz / (d || 1), { melee: true });
  }
  // 剑光斩碎飞来的弹幕
  let cut = 0;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i], dx = s.x - p.pos.x, dz = s.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < reach + 0.7 && inArc(dx, dz, d)) { burst(s.x, 1.15, s.z, 0xc8f1ff, 4, 4, 0.25, 0.3); removeAt(shots, i); cut++; }
  }
  if (cut) { S.stats.dodges += cut; popup('格挡', p.pos); sfx.clank(); freeze(0.04); }
}
