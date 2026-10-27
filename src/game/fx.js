import * as THREE from 'three';
import { S, parts, fx } from '../state.js';
import { cfg } from '../config.js';
import { $, rand, reduceMotion } from '../utils.js';
import { fxG, camera, heroLight } from '../engine/renderer.js';
import { glowMat, floorDecal, RING, BEAM, SLASH, SPIN, faceToZ } from '../engine/textures.js';

// ---------- 打击感：顿帧与镜头抖动 ----------
export const freeze = s => { S.hitstop = Math.max(S.hitstop, s * cfg.hitstop); };
export const shakeAdd = v => { if (!reduceMotion) S.shake = Math.max(S.shake, v); };

// ---------- 粒子与一次性特效 ----------
export function burst(x, y, z, color, n, speed = 5, life = 0.45, size = 0.35, grav = -6) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(glowMat(color)); s.position.set(x, y, z); s.scale.setScalar(size);
    const a = Math.random() * Math.PI * 2, up = rand(0.2, 1);
    fxG.add(s);
    parts.push({ s, vx: Math.cos(a) * speed * rand(0.4, 1), vy: up * speed * 0.8, vz: Math.sin(a) * speed * rand(0.4, 1), life, max: life, size, grav });
  }
}
// 原地渐隐的光点（拖尾用）
export function dot(x, y, z, color, size, life) {
  const s = new THREE.Sprite(glowMat(color)); s.position.set(x, y, z); s.scale.setScalar(size); fxG.add(s);
  parts.push({ s, vx: 0, vy: 0, vz: 0, life, max: life, size, grav: 0 });
}
export function ringFx(x, z, color, from, to, dur, opacity = 0.9, tex = RING) {
  const m = floorDecal(tex, color, from, opacity); m.position.set(x, 0.12, z); fxG.add(m);
  fx.push({ m, from, to, t: 0, dur, opacity });
}
export function beamFx(x, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: BEAM, color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.position.set(x, 5.2, z); s.scale.set(3, 11, 1); fxG.add(s);
  fx.push({ m: s, t: 0, dur: 1.1, upd: k => { s.scale.x = 3 * (1 - k) + 0.3; s.material.opacity = 1 - k * k; } });
}
export function slashFx(pos, face, reach, spin) {
  const size = reach * 2.5;
  const m = floorDecal(spin ? SPIN : SLASH, 0xc8f1ff, size, 1);
  m.position.set(pos.x, 1.0, pos.z); m.rotation.z = faceToZ(face); m.renderOrder = 4;
  fxG.add(m);
  const z0 = m.rotation.z;
  fx.push({ m, t: 0, dur: 0.2, upd: k => { m.material.opacity = 1 - k; m.scale.setScalar(size * (0.9 + 0.2 * k)); if (spin) m.rotation.z = z0 - k * 4; } });
}
export function impactFx(x, y, z, color, big = false) {
  const s = new THREE.Sprite(glowMat(color)); s.position.set(x, y, z); fxG.add(s);
  const sz = big ? 2.6 : 1.6;
  fx.push({ m: s, t: 0, dur: big ? 0.16 : 0.1, upd: k => { s.scale.setScalar(sz * (1 - k * 0.5)); s.material.opacity = 1 - k; } });
}

// ---------- 屏幕上的浮字 ----------
const tmpV = new THREE.Vector3();
let lastPop = 0;
export function screenOf(x, y, z) {
  tmpV.set(x, y, z).project(camera);
  return { x: ((tmpV.x + 1) / 2) * innerWidth, y: ((1 - tmpV.y) / 2) * innerHeight };
}
export function popup(text, pos, kind = '') {
  if (kind !== 'big' && performance.now() - lastPop < 220) return;
  lastPop = performance.now();
  const p = screenOf(pos.x, kind === 'big' ? 3.4 : 2.6, pos.z);
  const el = document.createElement('span'); el.className = 'pop ' + kind; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('popups').appendChild(el); setTimeout(() => el.remove(), kind === 'big' ? 1500 : 950);
}
export function dmgNum(e, n, kind = '') {
  const wrap = $('popups');
  if (wrap.childElementCount > 48) return;
  const p = screenOf(e.pos.x, 2.3 * e.scale + e.y, e.pos.z);
  const el = document.createElement('span'); el.className = 'dmg ' + kind;
  el.textContent = kind === 'crit' ? n + '!' : String(n);
  el.style.left = Math.round(p.x + rand(-18, 18)) + 'px'; el.style.top = Math.round(p.y + rand(-6, 6)) + 'px';
  wrap.appendChild(el); setTimeout(() => el.remove(), 950);
}

// ---------- 每帧推进特效、火把闪烁、开门动画 ----------
export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { fxG.remove(p.s); parts.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.s.position.x += p.vx * dt; p.s.position.y = Math.max(0.1, p.s.position.y + p.vy * dt); p.s.position.z += p.vz * dt;
    p.s.scale.setScalar(p.size * (p.life / p.max));
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    if (f.upd) f.upd(k);
    else {
      const s = f.from + (f.to - f.from) * (1 - (1 - k) ** 3);
      f.m.scale.set(s, s, 1); f.m.material.opacity = f.opacity * (1 - k);
    }
    if (k >= 1) { fxG.remove(f.m); fx.splice(i, 1); }
  }
  const room = S.room;
  if (room) {
    for (const t of room.torches) {
      const n = Math.sin(performance.now() / 90 + t.seed) * 0.5 + Math.sin(performance.now() / 37 + t.seed * 3) * 0.3;
      t.light.intensity = 22 + n * 5; t.flame.scale.set(1.25 + n * 0.12, 1.55 + n * 0.2, 1);
    }
    if (room.doorOpen && room.door && room.doorT < 1) { room.doorT = Math.min(1, room.doorT + dt * 0.9); room.door.rotation.y = -1.75 * (1 - (1 - room.doorT) ** 3); }
    if (room.beacon) { const k = 0.75 + Math.sin(performance.now() / 260) * 0.25; room.beacon.beacon.material.opacity = k; room.beacon.arrow.material.opacity = 0.25 + 0.3 * k; }
  }
  S.heroPulse = Math.max(0, S.heroPulse - dt * 8);
  heroLight.intensity = 16 + S.heroPulse * 26;
}
