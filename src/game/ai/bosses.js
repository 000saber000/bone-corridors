import { S } from '../../state.js';
import { cfg } from '../../config.js';
import { lerpAngle, clamp, rand } from '../../utils.js';
import { sfx } from '../../audio.js';
import { fxG } from '../../engine/renderer.js';
import { floorDecal, LANE, DISC, RUNE } from '../../engine/textures.js';
import { play } from '../../engine/characters.js';
import { burst, dot, ringFx, freeze, shakeAdd } from '../fx.js';
import { hurtPlayer, fireShot } from '../combat.js';
import { spawnEnemy, alive, targetable } from '../entities.js';
import { collide, spawnPoint } from '../room.js';
import { toast } from '../../ui/hud.js';

const summon = adds => {
  for (const k of Object.keys(adds)) for (let i = 0; i < adds[k]; i++) { const [x, z] = spawnPoint(5); spawnEnemy(k, x, z); }
};

// 首领一：骸骨守卫——圆环弹幕 + 冲锋，掉血后召唤援军
export function updateGuardian(e, dt, d, toward, move) {
  const phase2 = e.hp < e.maxHp * 0.5;
  for (const [th, adds, n] of [[0.66, { minion: 3 }, 1], [0.33, { minion: 2, rogue: 1, mage: 1 }, 2]]) {
    if (e.hp < e.maxHp * th && e.summoned < n) { e.summoned = n; summon(adds); toast('骸骨守卫召唤了援军', 2200); }
  }
  if (e.state === 'chase') {
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 5));
    if (d > 3) { move(e.face, cfg.enemySpeed * 0.8); play(e.ch, 'Walking_D_Skeletons', { timeScale: 0.9 }); }
    else play(e.ch, 'Idle_Combat');
    if (e.t > (phase2 ? 1.6 : 2.4)) {
      e.t = 0;
      e.next = e.next === 'ring' ? 'charge' : 'ring';
      if (e.next === 'ring') {
        e.state = 'ringUp'; play(e.ch, 'Spellcast_Summon', { loop: false, restart: true, timeScale: 4.3 / 1.1 });
        ringFx(e.pos.x, e.pos.z, 0xff4a3a, 1, 6, 0.8, 0.7, RUNE); sfx.cast();
      } else {
        e.state = 'chargeUp'; e.chargeAng = toward;
        play(e.ch, 'Idle_Combat');
        e.lane = floorDecal(LANE, 0xff3a2a, 1, 0.55); e.lane.renderOrder = 3; fxG.add(e.lane);
      }
    }
  } else if (e.state === 'ringUp') {
    if (e.t >= 0.8 && !e.fired) {
      e.fired = true;
      const n = phase2 ? 18 : 14, off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) fireShot(e.pos.x, e.pos.z, off + (i / n) * Math.PI * 2, cfg.bulletSpeed * 0.85, 0xff6a5a);
      sfx.enemyShot();
      if (phase2) setTimeout(() => {
        if (!targetable(e) || S.mode !== 'play') return;
        for (let i = 0; i < n; i++) fireShot(e.pos.x, e.pos.z, off + ((i + 0.5) / n) * Math.PI * 2, cfg.bulletSpeed * 0.85, 0xff6a5a);
        sfx.enemyShot();
      }, 380);
    }
    if (e.t >= 1.3) { e.state = 'chase'; e.t = 0; e.fired = false; }
  } else if (e.state === 'chargeUp') {
    e.chargeAng = lerpAngle(e.chargeAng, toward, Math.min(1, dt * 3));
    e.face = e.chargeAng;
    const L = 13;
    e.lane.position.set(e.pos.x + Math.sin(e.chargeAng) * L / 2, 0.11, e.pos.z + Math.cos(e.chargeAng) * L / 2);
    e.lane.rotation.z = e.chargeAng; e.lane.scale.set(2.2, L, 1);
    e.lane.material.opacity = 0.25 + 0.4 * Math.abs(Math.sin(e.t * 12));
    if (e.t >= 0.85) { fxG.remove(e.lane); e.lane = null; e.state = 'dash'; e.t = 0; e.hitDone = false; play(e.ch, 'Running_A', { timeScale: 1.8 }); }
  } else if (e.state === 'dash') {
    const before = e.pos.clone();
    move(e.chargeAng, 14);
    collide(e.pos, e.r, false);
    if (!e.hitDone && d < e.r + 0.7) { e.hitDone = true; hurtPlayer(); }
    const stuck = e.pos.distanceTo(before) < 14 * dt * 0.5;
    if (e.t > 0.85 || stuck) { e.state = 'chase'; e.t = 0; if (stuck) { shakeAdd(0.3); burst(e.pos.x, 0.5, e.pos.z, 0x9b8f80, 10, 4, 0.5, 0.6); } }
  }
}

// 首领二：骸骨战将——举盾逼近、跃起重砸（落点红圈预警 + 冲击弹幕）、旋风斩
function startLeap(e) {
  const b = S.room.bounds, p = S.player.pos;
  e.state = 'leap'; e.t = 0; e.landed = false; e.guard = false;
  e.lx0 = e.pos.x; e.lz0 = e.pos.z;
  e.lx1 = clamp(p.x, b.minX + 2, b.maxX - 2); e.lz1 = clamp(p.z, b.minZ + 2, b.maxZ - 2);
  e.marker = floorDecal(DISC, 0xff4a2a, 6.4, 0.6); e.marker.position.set(e.lx1, 0.11, e.lz1); fxG.add(e.marker);
  play(e.ch, '1H_Melee_Attack_Jump_Chop', { loop: false, restart: true, timeScale: 1.33 / 1.15 });
}
export function updateWarlord(e, dt, d, toward, move) {
  const phase2 = e.hp < e.maxHp * 0.5;
  if (phase2 && !e.summoned) { e.summoned = 1; summon({ warrior: 2 }); toast('骸骨战将召来了盾卫', 2200); }
  const broken = S.T < e.guardBreakUntil;
  if (e.state === 'chase') {
    e.guard = !broken;
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 3.5));
    if (d > 2.6) { move(e.face, cfg.enemySpeed * 0.62); play(e.ch, 'Walking_D_Skeletons', { timeScale: 0.75 }); }
    else play(e.ch, 'Blocking');
    if (e.t > (phase2 ? 1.7 : 2.4)) {
      e.t = 0;
      e.next = e.next === 'leap' ? 'spin' : 'leap';
      if (e.next === 'leap') startLeap(e);
      else { e.state = 'spin'; e.guard = false; e.spinHit = 0; play(e.ch, '2H_Melee_Attack_Spinning', { loop: true, timeScale: 1 }); sfx.slash(); }
    }
  } else if (e.state === 'leap') {
    const air = clamp((e.t - 0.35) / 0.6, 0, 1);
    if (e.marker) e.marker.material.opacity = 0.35 + 0.4 * Math.abs(Math.sin(e.t * 10));
    if (air > 0 && !e.landed) {
      e.pos.x = e.lx0 + (e.lx1 - e.lx0) * air; e.pos.z = e.lz0 + (e.lz1 - e.lz0) * air;
      e.y = Math.sin(air * Math.PI) * 4.5;
    }
    if (e.t >= 0.95 && !e.landed) {
      e.landed = true; e.y = 0;
      if (e.marker) { fxG.remove(e.marker); e.marker = null; }
      ringFx(e.pos.x, e.pos.z, 0xffa040, 1, 9, 0.5, 1);
      burst(e.pos.x, 0.4, e.pos.z, 0x9b8f80, 22, 7, 0.6, 0.7);
      shakeAdd(0.7); freeze(0.08); sfx.slam();
      if (Math.hypot(S.player.pos.x - e.pos.x, S.player.pos.z - e.pos.z) < 3.2) hurtPlayer();
      const n = phase2 ? 18 : 12;
      for (let i = 0; i < n; i++) fireShot(e.pos.x, e.pos.z, (i / n) * Math.PI * 2, cfg.bulletSpeed * 0.8, 0xffa040);
    }
    if (e.t >= 1.5) {
      if (phase2 && !e.doubleLeap) { e.doubleLeap = true; startLeap(e); }
      else { e.doubleLeap = false; e.state = 'chase'; e.t = 0; }
    }
  } else if (e.state === 'spin') {
    move(toward, cfg.enemySpeed * 1.05);
    if (Math.random() < 0.3) dot(e.pos.x + rand(-1.5, 1.5), 1.2, e.pos.z + rand(-1.5, 1.5), 0xffc070, 0.4, 0.2);
    if (d < e.r + 1.4 && S.T >= e.spinHit) { e.spinHit = S.T + 0.5; hurtPlayer(); }
    if (e.t >= (phase2 ? 3.2 : 2.6)) { e.state = 'chase'; e.t = 0; play(e.ch, 'Idle_Combat'); }
  }
}

// 首领三：骸骨大巫——保持距离、瞬移、螺旋弹幕、扇形连发、召唤
export function updateArchlich(e, dt, d, toward, move) {
  const phase2 = e.hp < e.maxHp * 0.5;
  if (e.state === 'chase') {
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 5));
    const ang = d < 8 ? toward + Math.PI : d > 12 ? toward : toward + (Math.PI / 2) * e.strafe;
    move(ang, cfg.enemySpeed * 0.55);
    play(e.ch, 'Walking_A', { timeScale: 0.8 });
    if (e.t > (phase2 ? 1.2 : 1.8)) {
      e.t = 0; e.cycle = (e.cycle || 0) + 1; e.fired = 0;
      let act = ['spiral', 'fan', 'teleport', 'summon', 'fan', 'spiral', 'teleport'][e.cycle % 7];
      if (act === 'summon' && alive().length > 5) act = 'fan';
      e.state = act;
      if (act === 'spiral') { play(e.ch, 'Spellcasting', { loop: true }); sfx.cast(); }
      else if (act === 'fan') play(e.ch, 'Spellcast_Shoot', { loop: false, restart: true });
      else if (act === 'summon') { play(e.ch, 'Spellcast_Summon', { loop: false, restart: true, timeScale: 4.3 / 1.4 }); ringFx(e.pos.x, e.pos.z, 0xc890ff, 1, 7, 1, 0.8, RUNE); sfx.cast(); }
      else { play(e.ch, 'Spellcast_Long', { loop: false, restart: true, timeScale: 2.53 / 0.7 }); e.moved = false; }
    }
  } else if (e.state === 'spiral') {
    e.spinAng = (e.spinAng || 0) + dt * (phase2 ? 2.6 : 2);
    if (S.T >= (e.nextBullet || 0)) {
      e.nextBullet = S.T + 0.11;
      const arms = phase2 ? 3 : 2;
      for (let a = 0; a < arms; a++) fireShot(e.pos.x, e.pos.z, e.spinAng + (a / arms) * Math.PI * 2, cfg.bulletSpeed * 0.75, 0xd08cff);
      if ((e.fired = (e.fired || 0) + 1) % 3 === 0) sfx.enemyShot();
    }
    if (e.t >= 2.4) { e.state = 'chase'; e.t = 0; }
  } else if (e.state === 'fan') {
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 8));
    if (e.fired < 3 && e.t >= 0.35 + e.fired * 0.4) {
      e.fired++;
      const n = phase2 ? 4 : 3;
      for (let i = -n; i <= n; i++) fireShot(e.pos.x, e.pos.z, toward + i * 0.15, cfg.bulletSpeed * 0.95, 0xff7ad0);
      sfx.enemyShot(); play(e.ch, 'Spellcast_Shoot', { loop: false, restart: true, fade: 0.05 });
    }
    if (e.t >= 1.5) { e.state = 'chase'; e.t = 0; }
  } else if (e.state === 'summon') {
    if (!e.fired && e.t >= 0.8) { e.fired = 1; summon(phase2 ? { minion: 2, rogue: 2 } : { minion: 2, rogue: 1 }); }
    if (e.t >= 1.4) { e.state = 'chase'; e.t = 0; }
  } else if (e.state === 'teleport') {
    const s = e.scale;
    if (e.t < 0.35) e.ch.root.scale.setScalar(s * Math.max(0.05, 1 - e.t / 0.35));
    else {
      if (!e.moved) {
        e.moved = true;
        const [x, z] = spawnPoint(8); e.pos.set(x, 0, z);
        ringFx(x, z, 0xc890ff, 1, 5, 0.5, 0.9, RUNE); burst(x, 1.5, z, 0xc890ff, 14, 4, 0.5, 0.4);
      }
      e.ch.root.scale.setScalar(s * Math.min(1, (e.t - 0.35) / 0.35));
    }
    if (e.t >= 0.7) { e.ch.root.scale.setScalar(s); e.state = 'chase'; e.t = 0; }
  }
}
