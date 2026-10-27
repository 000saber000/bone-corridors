import * as THREE from 'three';
import { S } from '../../state.js';
import { cfg } from '../../config.js';
import { lerpAngle, rand } from '../../utils.js';
import { sfx } from '../../audio.js';
import { fxG } from '../../engine/renderer.js';
import { glowMat, floorDecal, LANE } from '../../engine/textures.js';
import { play } from '../../engine/characters.js';
import { dot } from '../fx.js';
import { hurtPlayer, fireShot } from '../combat.js';

// 每个 AI 函数的参数：e 敌人，dt 帧时间，d 到英雄的距离，toward 朝英雄的角度，move(角度, 速度)

// 骷髅小兵：追上来，举刀蓄力后劈砍
export function updateMinion(e, dt, d, toward, move) {
  if (e.state === 'chase' || e.state === 'recover') {
    e.state = 'chase';
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 8));
    if (d > 1.55) { move(e.face, cfg.enemySpeed); play(e.ch, 'Walking_D_Skeletons', { timeScale: cfg.enemySpeed / 2.2 }); }
    else if (S.T >= e.cd) { e.state = 'windup'; e.t = 0; e.hitDone = false; play(e.ch, '1H_Melee_Attack_Chop', { loop: false, restart: true, timeScale: 1.07 / 0.95 }); }
    else play(e.ch, 'Idle_Combat');
  } else if (e.state === 'windup') {
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 4));
    if (!e.hitDone && e.t >= 0.5) { e.hitDone = true; if (d < 2.1) hurtPlayer(); }
    if (e.t >= 0.95) { e.state = 'chase'; e.t = 0; e.cd = S.T + 0.8; }
  }
}

// 骷髅法师：保持距离游走，手上聚起光球后放三连发
export function updateMage(e, dt, d, toward, move) {
  if (e.state === 'keep' || e.state === 'recover') {
    e.state = 'keep';
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 6));
    const ang = d < 6.5 ? toward + Math.PI : d > 11 ? toward : toward + (Math.PI / 2) * e.strafe;
    const s = d < 6.5 || d > 11 ? cfg.enemySpeed * 0.85 : cfg.enemySpeed * 0.4;
    move(ang, s);
    play(e.ch, 'Walking_A', { timeScale: s / 2 + 0.3 });
    if (S.T >= e.cd && d < 17) {
      e.state = 'cast'; e.t = 0;
      play(e.ch, 'Spellcast_Shoot', { loop: false, restart: true, timeScale: 0.93 / 0.85 });
      e.orb = new THREE.Sprite(glowMat(0xb98cff)); e.orb.scale.setScalar(0.2); fxG.add(e.orb);
      sfx.cast();
    }
  } else if (e.state === 'cast') {
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 10));
    const hx = e.pos.x + Math.sin(e.face) * 0.7, hz = e.pos.z + Math.cos(e.face) * 0.7;
    e.orb.position.set(hx, 1.5, hz); e.orb.scale.setScalar(0.2 + e.t * 2.2);
    if (e.t >= 0.6) {
      fxG.remove(e.orb); e.orb = null;
      for (const off of [-0.22, 0, 0.22]) fireShot(hx, hz, e.face + off, cfg.bulletSpeed);
      sfx.enemyShot();
      e.state = 'keep'; e.t = 0; e.cd = S.T + rand(2, 2.9); if (Math.random() < 0.4) e.strafe *= -1;
    }
  }
}

// 骷髅刺客：绕圈游走，瞄准（地面红线预警）后高速突刺
export function updateRogue(e, dt, d, toward, move) {
  if (e.state === 'chase' || (e.state === 'recover' && e.t >= 0.75)) {
    if (e.state === 'recover') { e.state = 'chase'; e.cd = S.T + rand(1.6, 2.6); e.strafe *= -1; }
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 8));
    const ang = d > 6.5 ? toward : d < 4.5 ? toward + Math.PI : toward + (Math.PI / 2) * e.strafe;
    move(ang, cfg.enemySpeed * 1.25);
    play(e.ch, 'Running_C', { timeScale: 1.1 });
    if (S.T >= e.cd && d < 9.5) {
      e.state = 'aim'; e.t = 0; e.aim = toward;
      e.lane = floorDecal(LANE, 0xff3a2a, 1, 0.5); e.lane.renderOrder = 3; fxG.add(e.lane);
      play(e.ch, 'Idle_Combat');
    }
  } else if (e.state === 'aim') {
    e.aim = lerpAngle(e.aim, toward, Math.min(1, dt * 5)); e.face = e.aim;
    const L = 8.5;
    e.lane.position.set(e.pos.x + Math.sin(e.aim) * L / 2, 0.11, e.pos.z + Math.cos(e.aim) * L / 2);
    e.lane.rotation.z = e.aim; e.lane.scale.set(1.3, L, 1);
    e.lane.material.opacity = 0.25 + 0.45 * Math.abs(Math.sin(e.t * 14));
    if (e.t >= 0.5) {
      fxG.remove(e.lane); e.lane = null;
      e.state = 'dash'; e.t = 0; e.hitDone = false;
      play(e.ch, 'Dualwield_Melee_Attack_Stab', { loop: false, restart: true, timeScale: 1.6 / 0.45 });
      sfx.dash();
    }
  } else if (e.state === 'dash') {
    move(e.aim, 17);
    dot(e.pos.x, 0.8, e.pos.z, 0xff6a5a, 0.5, 0.2);
    if (!e.hitDone && d < e.r + 0.7) { e.hitDone = true; hurtPlayer(); }
    if (e.t >= 0.42) { e.state = 'recover'; e.t = 0; play(e.ch, 'Idle_Combat'); }
  }
}

// 持盾骷髅：举着骨盾慢慢逼近，正面挡下远程攻击；挥砍时露出破绽；近战可以破盾
export function updateWarrior(e, dt, d, toward, move) {
  const broken = S.T < e.guardBreakUntil;
  if (e.state === 'chase' || e.state === 'recover') {
    e.state = 'chase';
    e.guard = !broken;
    // 转身较慢，法师可以翻滚绕到侧后方
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * (broken ? 1.5 : 2.5)));
    if (d > 1.9) { move(e.face, cfg.enemySpeed * (broken ? 0.3 : 0.6)); play(e.ch, 'Walking_D_Skeletons', { timeScale: 0.8 }); }
    else if (S.T >= e.cd && !broken) { e.state = 'windup'; e.t = 0; e.hitDone = false; e.guard = false; play(e.ch, '1H_Melee_Attack_Chop', { loop: false, restart: true, timeScale: 1.07 / 0.9 }); }
    else play(e.ch, broken ? 'Hit_A' : 'Blocking');
  } else if (e.state === 'windup') {
    e.guard = false;
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 3));
    if (!e.hitDone && e.t >= 0.55) { e.hitDone = true; if (d < 2.4) hurtPlayer(); }
    if (e.t >= 0.9) { e.state = 'chase'; e.t = 0; e.cd = S.T + 1.3; }
  }
}
