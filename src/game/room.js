import * as THREE from 'three';
import { S } from '../state.js';
import { clamp, rand } from '../utils.js';
import { sfx } from '../audio.js';
import { G } from '../engine/assets.js';
import { roomG, TORCH_LIGHTS, theme } from '../engine/renderer.js';
import { glowMat, floorDecal, LANE } from '../engine/textures.js';
import { PROP_R } from './data/layouts.js';

// ---------- 按布局搭建房间：地砖、墙、北门、道具、火把 ----------
export function place(key, x, y, z, ry = 0) {
  const o = G[key].scene.clone(); o.position.set(x, y, z); o.rotation.y = ry; roomG.add(o); return o;
}
function wallMount(side, at, hx, hz) {
  if (side === 'N') return { x: at, z: -hz, ry: 0, lx: at, lz: -hz + 0.9 };
  if (side === 'W') return { x: -hx, z: at, ry: Math.PI / 2, lx: -hx + 0.9, lz: at };
  return { x: hx, z: at, ry: -Math.PI / 2, lx: hx - 0.9, lz: at };
}
export function buildRoom(def) {
  roomG.clear();
  const hx = def.w * 2, hz = def.d * 2;
  const obstacles = [];
  for (let i = 0; i < def.w; i++) for (let j = 0; j < def.d; j++) place('floor', -hx + 2 + i * 4, 0, -hz + 2 + j * 4);
  const mid = (def.w - 1) / 2;
  let gate = null;
  for (let i = 0; i < def.w; i++) {
    const x = -hx + 2 + i * 4;
    if (i === mid) gate = place('gated', x, 0, -hz - 0.5);
    else place('wall', x, 0, -hz - 0.5);
  }
  for (let j = 0; j < def.d; j++) {
    const z = -hz + 2 + j * 4;
    place('wall', -hx - 0.5, 0, z, Math.PI / 2);
    place('wall', hx + 0.5, 0, z, Math.PI / 2);
  }
  for (const [x, z] of [[-hx - 0.5, -hz - 0.5], [hx + 0.5, -hz - 0.5], [-hx - 0.5, hz + 0.5], [hx + 0.5, hz + 0.5]]) place('pillar', x, 0, z);
  for (const [k, x, z, ry = 0] of def.props) {
    place(k, x, 0, z, ry);
    // 碎石模型的原点在一端，碰撞圆放到它的中段
    obstacles.push(k === 'rubble' ? { x: x + 2 * Math.cos(ry), z: z - 2 * Math.sin(ry), r: PROP_R.rubble } : { x, z, r: PROP_R[k] });
  }
  for (const [side, at] of def.banners) {
    const m = wallMount(side, at, hx, hz);
    const o = place('banner', m.x, 0, m.z, m.ry);
    o.position.addScaledVector(new THREE.Vector3(Math.sin(m.ry), 0, Math.cos(m.ry)), -0.5);
  }
  const torches = [];
  def.torches.forEach(([side, at], i) => {
    const m = wallMount(side, at, hx, hz);
    place('torch', m.x, 2.1, m.z, m.ry);
    const flame = new THREE.Sprite(glowMat(theme.flame)); flame.scale.set(1.3, 1.6, 1);
    const fwd = new THREE.Vector3(Math.sin(m.ry), 0, Math.cos(m.ry));
    flame.position.set(m.x, 2.85, m.z).addScaledVector(fwd, 0.45); roomG.add(flame);
    const l = TORCH_LIGHTS[i]; l.position.set(m.lx, 3.1, m.lz); l.intensity = 22;
    torches.push({ light: l, flame, seed: Math.random() * 10 });
  });
  for (let i = def.torches.length; i < TORCH_LIGHTS.length; i++) TORCH_LIGHTS[i].intensity = 0;
  S.obstacles = obstacles;
  S.room = {
    def, hx, hz, gate, door: null, doorOpen: false, doorT: 0, doorX: 0, torches,
    bounds: { minX: -hx, maxX: hx, minZ: -hz, maxZ: hz },
    waveIdx: -1, waitUntil: null, cleared: false, beacon: null, plan: null,
  };
}

// 清完房间后把铁栅门换成木门并打开，门口亮起指引
export function openDoor() {
  const room = S.room;
  roomG.remove(room.gate);
  const d = place('doorway', room.doorX, 0, -room.hz - 0.5);
  room.door = d.getObjectByName('wall_doorway_door');
  room.doorOpen = true; room.doorT = 0;
  const beacon = new THREE.Sprite(glowMat(0xffd27a)); beacon.scale.set(5, 5, 1); beacon.position.set(room.doorX, 1.8, -room.hz + 0.2);
  roomG.add(beacon);
  const arrow = floorDecal(LANE, 0xffd27a, 1, 0.5); arrow.scale.set(2.4, 5, 1); arrow.position.set(room.doorX, 0.09, -room.hz + 3);
  roomG.add(arrow);
  room.beacon = { beacon, arrow };
  sfx.door();
}

// ---------- 碰撞：圆形道具 + 房间边界；门开着时英雄可以从北门走出去 ----------
export function collide(pos, r, isPlayer) {
  for (const o of S.obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), m = r + o.r;
    if (d < m) { if (d < 1e-4) pos.x += m; else { pos.x = o.x + (dx / d) * m; pos.z = o.z + (dz / d) * m; } }
  }
  const room = S.room, b = room.bounds;
  pos.x = clamp(pos.x, b.minX + r, b.maxX - r);
  pos.z = Math.min(pos.z, b.maxZ - r);
  const exiting = isPlayer && room.doorOpen && Math.abs(pos.x - room.doorX) < 1.4;
  if (!exiting) pos.z = Math.max(pos.z, b.minZ + r);
  else if (pos.z < b.minZ + r) pos.x = clamp(pos.x, room.doorX - 1.3, room.doorX + 1.3);
}
export const blocked = (x, z, pad = 0) => S.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + pad);
export const outside = (x, z) => { const b = S.room.bounds; return x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ; };

// 找一个离英雄够远、不压在道具和其他敌人身上的刷怪点
export function spawnPoint(minDist) {
  const b = S.room.bounds, p = S.player.pos;
  for (let i = 0; i < 40; i++) {
    const x = rand(b.minX + 2, b.maxX - 2), z = rand(b.minZ + 2, b.maxZ - 2);
    if (Math.hypot(x - p.x, z - p.z) < minDist) continue;
    if (S.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + 1.4)) continue;
    if (S.enemies.some(e => e.state !== 'dead' && Math.hypot(x - e.pos.x, z - e.pos.z) < 1.6)) continue;
    return [x, z];
  }
  return [rand(b.minX + 2, b.maxX - 2), b.minZ + 2];
}
