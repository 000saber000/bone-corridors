import * as THREE from 'three';
import { S } from '../state.js';
import { clamp, rand } from '../utils.js';
import { renderer, scene, camera, moon, heroLight } from '../engine/renderer.js';
import { unflash } from '../engine/characters.js';
import { faceToZ } from '../engine/textures.js';
import { updateFx } from './fx.js';
import { collide } from './room.js';
import { alive, spawnWave } from './entities.js';
import { updateProjectiles } from './combat.js';
import { updatePlayer } from './player.js';
import { updateEnemy, separate } from './ai/index.js';
import { roomCleared } from './flow.js';
import { updateFoes, updateHud } from '../ui/hud.js';

// ---------- 战斗推进一帧 ----------
function tickCombat(dt) {
  S.T += dt;
  updatePlayer(dt);
  if (S.mode !== 'play' && S.mode !== 'over-pending') return;
  const room = S.room;

  // 波次：本波清空后等 1 秒刷下一波，全部清完则开门
  if (!room.cleared && alive().length === 0 && S.mode === 'play') {
    if (room.waveIdx + 1 < room.plan.waves.length) {
      if (room.waitUntil === null) room.waitUntil = S.T + 1;
      if (S.T >= room.waitUntil) { room.waitUntil = null; spawnWave(room.plan.waves[++room.waveIdx]); updateFoes(); }
    } else roomCleared();
  }

  for (const e of S.enemies) {
    updateEnemy(e, dt);
    if (e.state !== 'dead' && e.state !== 'spawn') {
      e.pos.x += e.kx * dt; e.pos.z += e.kz * dt;
      const decay = Math.exp(-9 * dt); e.kx *= decay; e.kz *= decay;
      if (e.y <= 0) collide(e.pos, e.r, false);
    }
    unflash(e.ch, S.T);
    if (e.state !== 'dead') {
      const r = e.ch.root;
      r.position.set(e.pos.x, e.y, e.pos.z);
      // 受击时的挤压回弹
      if (e.punch > 0 && e.state !== 'teleport') {
        e.punch = Math.max(0, e.punch - dt * 7);
        const k = e.punch;
        r.scale.set(e.scale * (1 + 0.16 * k), e.scale * (1 - 0.14 * k), e.scale * (1 + 0.16 * k));
      }
      if (e.shield) {
        e.shield.position.set(e.pos.x, 0.13, e.pos.z);
        e.shield.rotation.z = faceToZ(e.face);
        e.shield.material.opacity += ((e.guard ? 0.7 : 0) - e.shield.material.opacity) * Math.min(1, dt * 10);
      }
    }
    e.ch.root.rotation.y = e.face;
  }
  for (let i = S.enemies.length - 1; i >= 0; i--) if (S.enemies[i].gone) S.enemies.splice(i, 1);
  separate();
  updateProjectiles(dt);
}

// ---------- 镜头 ----------
const camTarget = new THREE.Vector3();
const camOff = new THREE.Vector3();
export function updateCamera(dt, snap = false) {
  const p = S.player;
  const aspect = innerWidth / innerHeight;
  const k = aspect < 0.75 ? 1.5 : aspect < 1.1 ? 1.22 : 1;   // 竖屏时拉远
  if (S.mode === 'menu' || S.mode === 'select') {
    // 英雄放在画面右侧三分之一，镜头缓慢摆动
    const a = 0.45 + Math.sin(performance.now() / 5200) * 0.28;
    const kp = p.pos, side = aspect < 1 ? 0 : 2.6;
    camera.position.set(kp.x + Math.sin(a) * 7.5, 3.6, kp.z + Math.cos(a) * 7.5);
    if (aspect < 1) camera.lookAt(kp.x + Math.sin(a) * 1.5, 0.2, kp.z + Math.cos(a) * 1.5); // 竖屏：英雄在上半屏
    else camera.lookAt(kp.x - Math.cos(a) * side, 1.3, kp.z + Math.sin(a) * side);
    moon.position.set(-10, 24, 8); moon.target.position.set(0, 0, 0);
    heroLight.position.set(p.pos.x, 2.6, p.pos.z + 0.8);
    return;
  }
  camOff.set(0, 17 * k, 12.5 * k);
  const b = S.room.bounds;
  // 镜头中心不越过房间南缘太多，避免画面下方露出大片虚空
  const tx = clamp(p.pos.x, b.minX + 5, b.maxX - 5), tz = clamp(p.pos.z, b.minZ + 3, Math.max(b.minZ + 3, b.maxZ - 5.5 * k));
  if (snap) camTarget.set(tx, 0, tz);
  else { const f = 1 - Math.exp(-dt * 6); camTarget.x += (tx - camTarget.x) * f; camTarget.z += (tz - camTarget.z) * f; }
  camera.position.copy(camTarget).add(camOff);
  if (S.shake > 0) { camera.position.x += rand(-1, 1) * S.shake * 0.6; camera.position.y += rand(-1, 1) * S.shake * 0.4; S.shake = Math.max(0, S.shake - dt * 2); }
  camera.lookAt(camTarget.x, 0.8, camTarget.z - 0.5);
  moon.position.set(camTarget.x - 10, 24, camTarget.z + 8); moon.target.position.copy(camTarget);
  heroLight.position.set(p.pos.x, 2.6, p.pos.z + 0.8);
}

// ---------- 主循环 ----------
export function step(dt) {
  const p = S.player;
  // 顿帧：战斗时间暂停；慢动作：战斗时间变慢。特效和镜头照常
  let sim = dt;
  if (S.hitstop > 0) { S.hitstop -= dt; sim = 0; }
  else if (S.slowmo > 0) { S.slowmo -= dt; sim = dt * 0.3; }
  if (S.mode === 'menu' || S.mode === 'select') {
    p.ch.mixer.update(dt);
    p.ch.root.position.copy(p.pos); p.ch.root.rotation.y = p.face;
    p.ring.visible = false; p.range.visible = false;
  } else if (p && !S.paused && (S.mode === 'play' || S.mode === 'over-pending')) {
    p.ring.visible = !p.dead; p.range.visible = !p.dead;
    if (sim > 0) {
      tickCombat(sim);
      p.ch.mixer.update(sim);
      for (const e of S.enemies) e.ch.mixer.update(sim);
    }
  } else if (p && S.mode === 'over') {
    p.ch.mixer.update(dt);
    for (const e of S.enemies) e.ch.mixer.update(dt);
  } else if (p && S.mode === 'upgrade') {
    p.ch.mixer.update(dt); // 选祝福时战斗暂停，但英雄的动作和光效照常播放
  }
  // 吸收祝福后英雄全身发金光，逐渐消退
  if (p && p.glow > 0) {
    p.glow = Math.max(0, p.glow - dt * 0.9);
    for (const m of p.ch.mats) {
      if (p.glow > 0) { m.emissive.setRGB(1, 0.78, 0.32); m.emissiveIntensity = p.glow * 1.1; }
      else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
    }
  }
  if (!S.paused) updateFx(sim > 0 ? sim : dt * 0.15);
  if (p && S.room) updateCamera(dt);
  updateHud();
}

let last = performance.now();
export function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
