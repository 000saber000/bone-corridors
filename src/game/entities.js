import * as THREE from 'three';
import { S } from '../state.js';
import { cfg } from '../config.js';
import { rand, pick } from '../utils.js';
import { G } from '../engine/assets.js';
import { scene, fxG } from '../engine/renderer.js';
import { makeChar, play, clipLen } from '../engine/characters.js';
import { floorDecal, chargeTex, RING, RUNE, SHIELD } from '../engine/textures.js';
import { CLASSES } from './data/classes.js';
import { ENEMY } from './data/enemies.js';
import { spawnPoint } from './room.js';
import { updateBoss } from '../ui/hud.js';

export const alive = () => S.enemies.filter(e => e.state !== 'dead');
export const targetable = e => e.state !== 'dead' && e.state !== 'spawn' && e.state !== 'teleport';

// ---------- 英雄 ----------
export function newPlayer(key) {
  const cls = CLASSES[key];
  const ch = makeChar(G[cls.model], { hide: cls.hide });
  scene.add(ch.root);
  const ring = floorDecal(chargeTex, 0xffffff, 2.6);                                     // 脚下的站定蓄力环
  const range = floorDecal(RING, cls.attack === 'melee' ? 0x6fd3ff : 0xd9b66c, 1, 0);   // 攻击范围圈
  scene.add(ring, range);
  play(ch, 'Idle');
  const hp = cls.hp + (cfg.hpBonus | 0);
  return { key, cls, ch, ring, range, pos: new THREE.Vector3(), face: Math.PI, hp, maxHp: hp,
    rolling: 0, rollDir: { x: 0, z: -1 }, rollReadyAt: 0, rollTotal: 1, invulnUntil: 0, still: 0, nextShot: 0,
    moving: false, dead: false, regen: 0, swing: null, swings: 0, glow: 0, hitAnimUntil: 0, leech: 0 };
}
export function disposePlayer() {
  if (!S.player) return;
  scene.remove(S.player.ch.root, S.player.ring, S.player.range);
  S.player = null;
}

// ---------- 敌人 ----------
export function spawnEnemy(kind, x, z) {
  const spec = ENEMY[kind];
  const ch = makeChar(G[spec.src], { scale: spec.scale, tint: spec.tint });
  ch.root.position.set(x, 0, z);
  scene.add(ch.root);
  const isBoss = !!spec.boss;
  // 出场时地面先亮起召唤法阵，骷髅从地里爬出来
  const rune = floorDecal(RUNE, isBoss ? 0xff5a4a : 0xa87cff, isBoss ? 5.5 : 2.8, 0.9);
  rune.position.set(x, 0.1, z); fxG.add(rune);
  const spawnDur = isBoss ? 1.8 : 1.15;
  play(ch, 'Spawn_Ground_Skeletons', { loop: false, fade: 0, timeScale: clipLen(ch, 'Spawn_Ground_Skeletons') / (spawnDur + 0.25) });
  const plan = S.room && S.room.plan;
  const hpScale = (plan ? (isBoss ? plan.bossScale : plan.hpScale) : 1) * cfg.enemyHpMul;
  const hp = Math.max(1, Math.round(spec.hp * hpScale));
  const p = S.player;
  const e = { kind, spec, ch, rune, pos: new THREE.Vector3(x, 0, z), y: 0, r: spec.r, scale: spec.scale, hp, maxHp: hp,
    boss: spec.boss || null, state: 'spawn', t: 0, spawnDur,
    face: p ? Math.atan2(p.pos.x - x, p.pos.z - z) : 0, cd: S.T + rand(0.4, 1.4), kx: 0, kz: 0,
    strafe: Math.random() < 0.5 ? 1 : -1, summoned: 0, hitDone: false, punch: 0, staggerUntil: 0, guard: false, guardBreakUntil: 0 };
  if (kind === 'warrior' || kind === 'warlord') {
    e.shield = floorDecal(SHIELD, 0x7fd0ff, kind === 'warlord' ? 5.2 : 3.4, 0);
    e.shield.renderOrder = 3; fxG.add(e.shield);
  }
  S.enemies.push(e);
  return e;
}
export function spawnWave(w) {
  for (const kind of Object.keys(w)) {
    for (let i = 0; i < w[kind]; i++) {
      if (ENEMY[kind].boss) spawnEnemy(kind, 0, -S.room.hz + 6);
      else { const [x, z] = spawnPoint(kind === 'mage' ? 8 : 6); spawnEnemy(kind, x, z); }
    }
  }
  updateBoss();
}

// 按难度预算随机配怪：难度越高预算越多，法师、刺客、持盾骷髅各有数量上限
export function genWaves(lvl, pool, n) {
  const waves = [];
  for (let w = 0; w < n; w++) {
    let budget = 3.5 + lvl * 1.1 + w * 1.3;
    const wave = {}; let count = 0, guard = 0;
    while (budget >= 1 && count < 14 && guard++ < 60) {
      let k = pick(pool);
      if (ENEMY[k].cost > budget) k = 'minion';
      if (k === 'mage' && (wave.mage || 0) >= 1 + Math.floor(lvl / 3)) continue;
      if (k === 'warrior' && (wave.warrior || 0) >= 1 + Math.floor(lvl / 4)) continue;
      if (k === 'rogue' && (wave.rogue || 0) >= 2 + Math.floor(lvl / 4)) continue;
      wave[k] = (wave[k] || 0) + 1; budget -= ENEMY[k].cost; count++;
    }
    waves.push(wave);
  }
  return waves;
}
