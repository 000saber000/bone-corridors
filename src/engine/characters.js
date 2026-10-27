import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// 克隆一个带骨骼动画的角色；材质逐个复制，这样受击闪白只影响这一个角色
export function makeChar(src, { scale = 1, hide = [], tint = null } = {}) {
  const root = cloneSkinned(src.scene);
  const mats = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    if (hide.includes(o.name)) { o.visible = false; return; }
    o.material = o.material.clone();
    const m = o.material;
    if (tint) { m.color.multiply(new THREE.Color(tint)); if (m.emissive) m.emissive.setRGB(0.25, 0.03, 0.02); }
    if (m.emissive) { m.userData.e0 = m.emissive.clone(); m.userData.ei0 = m.emissiveIntensity; mats.push(m); }
  });
  root.scale.setScalar(scale);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const c of src.animations) actions[c.name] = mixer.clipAction(c);
  return { root, mixer, actions, cur: null, mats, flashUntil: 0 };
}

// 切换动作（带淡入淡出）；同一个动作重复调用只更新播放速度
export function play(ch, name, { loop = true, fade = 0.18, timeScale = 1, restart = false } = {}) {
  const a = ch.actions[name]; if (!a) return;
  if (ch.cur === a && !restart) { a.timeScale = timeScale; return; }
  a.reset();
  a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  a.clampWhenFinished = !loop;
  a.timeScale = timeScale;
  a.setEffectiveWeight(1);
  a.play();
  if (ch.cur && ch.cur !== a) a.crossFadeFrom(ch.cur, fade, false);
  ch.cur = a;
}
export const clipLen = (ch, name) => (ch.actions[name] ? ch.actions[name].getClip().duration : 1);

export function flash(ch, now, strength = 0.9) {
  ch.flashUntil = now + 0.07;
  for (const m of ch.mats) { m.emissive.setRGB(1, 0.95, 0.85); m.emissiveIntensity = strength; }
}
export function unflash(ch, now) {
  if (!ch.flashUntil || now < ch.flashUntil) return;
  ch.flashUntil = 0;
  for (const m of ch.mats) { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
}
