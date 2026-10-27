import { S } from '../state.js';
import { cfg } from '../config.js';
import { lerpAngle, clamp } from '../utils.js';
import { sfx } from '../audio.js';
import { play, clipLen } from '../engine/characters.js';
import { drawCharge } from '../engine/textures.js';
import { burst, dot, popup } from './fx.js';
import { collide } from './room.js';
import { nearestEnemy, fireBolts, startSwing, meleeHit, reachOf, shockwave } from './combat.js';
import { nextRoom } from './flow.js';
import { inputDir } from '../input.js';
import { renderHp } from '../ui/hud.js';

// ---------- 翻滚：全程无敌，会打断挥砍 ----------
export function tryRoll() {
  const p = S.player;
  if (S.mode !== 'play' || S.paused || !p || p.dead || p.rolling > 0 || S.T < p.rollReadyAt) return;
  const dir = inputDir();
  const d = dir ? { x: dir.x, z: dir.z } : { x: Math.sin(p.face), z: Math.cos(p.face) };
  const r = p.cls.roll;
  p.swing = null;
  p.rollDir = d; p.rolling = r.dur; p.face = Math.atan2(d.x, d.z);
  p.rollTotal = r.dur + r.cd * S.mods.rollCdMul * cfg.rollCdMul;
  p.rollReadyAt = S.T + p.rollTotal;
  play(p.ch, 'Dodge_Forward', { loop: false, restart: true, fade: 0.05, timeScale: clipLen(p.ch, 'Dodge_Forward') / (r.dur + 0.1) });
  burst(p.pos.x, 0.3, p.pos.z, 0x9b8f80, 6, 3, 0.4, 0.5, 0);
  sfx.roll();
}

// ---------- 每帧：移动、出门、挥砍进度、站定攻击、蓄力环 ----------
export function updatePlayer(dt) {
  const p = S.player, c = p.cls, mods = S.mods, room = S.room;
  if (p.dead) return;
  const dir = inputDir();
  if (p.rolling > 0) {
    const sp = c.roll.speed * cfg.rollDistMul;
    p.rolling -= dt;
    p.pos.x += p.rollDir.x * sp * dt; p.pos.z += p.rollDir.z * sp * dt;
    p.moving = true; p.still = 0;
    if (Math.random() < 0.5) dot(p.pos.x, 0.3, p.pos.z, 0x9b8f80, 0.6, 0.3);
    if (p.rolling <= 0) { p.rolling = 0; if (mods.rollShock) shockwave(); }
  } else if (dir) {
    p.swing = null; // 移动会打断挥砍
    const s = c.speed * cfg.moveMul * dir.m;
    p.pos.x += dir.x * s * dt; p.pos.z += dir.z * s * dt;
    p.face = lerpAngle(p.face, Math.atan2(dir.x, dir.z), Math.min(1, dt * 14));
    p.moving = true; p.still = 0;
    play(p.ch, 'Running_A', { timeScale: (c.speed * cfg.moveMul) / 6.5 });
    if (mods.regen && p.hp < p.maxHp) { p.regen += dt; if (p.regen >= 6) { p.regen = 0; p.hp++; renderHp(); popup('+1', p.pos); } }
  } else {
    p.moving = false; p.still += dt;
  }
  collide(p.pos, 0.55, true);
  if (room.doorOpen && p.pos.z < room.bounds.minZ - 1 && S.mode === 'play') nextRoom();

  if (p.swing) {
    const s = p.swing; s.t += dt;
    if (!s.hitDone && s.t >= s.hitAt) { s.hitDone = true; meleeHit(s.spin); }
    if (s.t >= s.dur) p.swing = null;
  } else if (!p.moving) attackLogic(dt);

  const r = p.ch.root;
  r.position.copy(p.pos); r.rotation.y = p.face;
  r.visible = !(S.T < p.invulnUntil && p.rolling <= 0 && Math.floor(S.T * 16) % 2);   // 受伤无敌时闪烁

  const charge = cfg.fireDelay > 0 ? Math.min(1, p.still / cfg.fireDelay) : 1;
  drawCharge(charge, p.moving);
  p.ring.position.set(p.pos.x, 0.1, p.pos.z);
  const ready = !p.moving && charge >= 1;
  const reach = c.attack === 'melee' ? reachOf(p) : c.range;
  p.range.position.set(p.pos.x, 0.09, p.pos.z);
  p.range.scale.set(reach * 2, reach * 2, 1);
  p.range.material.opacity += ((ready ? (c.attack === 'melee' ? 0.3 : 0.16) : 0) - p.range.material.opacity) * clamp(dt * 8, 0, 1);
}

// 站定时：法师朝最近的敌人施法；骑士等敌人进入挥砍范围后出剑
function attackLogic(dt) {
  const p = S.player, c = p.cls, mods = S.mods;
  const idle = () => { if (S.T >= p.hitAnimUntil) play(p.ch, 'Idle'); };
  if (c.attack === 'ranged') {
    const tgt = nearestEnemy(c.range);
    if (!tgt) return idle();
    p.face = lerpAngle(p.face, Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z), Math.min(1, dt * 18));
    if (S.T >= p.hitAnimUntil) play(p.ch, 'Spellcasting', { timeScale: 1.2 });
    if (p.still >= cfg.fireDelay && S.T >= p.nextShot) { fireBolts(tgt); p.nextShot = S.T + 1 / (c.fireRate * mods.rateMul * cfg.atkMul); }
  } else {
    const reach = reachOf(p);
    const tgt = nearestEnemy(reach + 5);
    if (!tgt) return idle();
    p.face = lerpAngle(p.face, Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z), Math.min(1, dt * 20));
    const d = Math.hypot(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z);
    if (d <= reach + tgt.r && p.still >= cfg.fireDelay && S.T >= p.nextShot) startSwing();
    else idle();
  }
}
