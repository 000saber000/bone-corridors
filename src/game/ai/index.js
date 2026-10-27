import { S } from '../../state.js';
import { scene, fxG } from '../../engine/renderer.js';
import { updateMinion, updateMage, updateRogue, updateWarrior } from './regular.js';
import { updateGuardian, updateWarlord, updateArchlich } from './bosses.js';

const AI = {
  minion: updateMinion, mage: updateMage, rogue: updateRogue, warrior: updateWarrior,
  guardian: updateGuardian, warlord: updateWarlord, archlich: updateArchlich,
};

// 每帧推进一个敌人：出场、死亡下沉、受击硬直，其余交给对应的 AI
export function updateEnemy(e, dt) {
  const p = S.player.pos;
  const dx = p.x - e.pos.x, dz = p.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  const toward = Math.atan2(dx, dz);
  const move = (ang, speed) => { e.pos.x += Math.sin(ang) * speed * dt; e.pos.z += Math.cos(ang) * speed * dt; };
  e.t += dt;
  if (e.state === 'spawn') {
    e.rune.material.opacity = 0.9 * (1 - e.t / e.spawnDur);
    e.rune.rotation.z += dt * 2;
    if (e.t >= e.spawnDur) { fxG.remove(e.rune); e.rune = null; e.state = e.kind === 'mage' ? 'keep' : 'chase'; e.t = 0; }
    return;
  }
  if (e.state === 'dead') {
    if (e.t > 1.7) e.ch.root.position.y = -(e.t - 1.7) * 1.4;
    if (e.t > 2.8) { scene.remove(e.ch.root); e.gone = true; }
    return;
  }
  if (e.state === 'taunt' || S.player.dead) return;
  if (S.T < e.staggerUntil) return;   // 受击硬直
  AI[e.kind](e, dt, d, toward, move);
}

// 敌人之间互相推开，首领几乎推不动
export function separate() {
  const live = S.enemies.filter(e => e.state !== 'dead' && e.y <= 0);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.r + b.r;
    if (d < m && d > 1e-4) {
      const push = (m - d) / 2, nx = dx / d, nz = dz / d;
      const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1;
      a.pos.x -= nx * push * wa; a.pos.z -= nz * push * wa; b.pos.x += nx * push * wb; b.pos.z += nz * push * wb;
    }
  }
}
