// 骸骨回廊：入口。加载样式和模型，初始化界面与输入，然后进入标题画面。
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/hud.css';
import './styles/tuner.css';
import './styles/responsive.css';

import { S, bolts, shots } from './state.js';
import { $, isTouch } from './utils.js';
import { renderer, scene, camera, applyPixelate, onResize } from './engine/renderer.js';
import { loadAll, enemiesReady, ENEMY_KEYS, G } from './engine/assets.js';
import { makeChar } from './engine/characters.js';
import { step, frame } from './game/loop.js';
import { startRun, nextRoom, toMenu } from './game/flow.js';
import { tryRoll } from './game/player.js';
import { fireShot } from './game/combat.js';
import { spawnEnemy } from './game/entities.js';
import { initInput } from './input.js';
import { initHud, showProgress } from './ui/hud.js';
import { initMenus, openSelect, chooseHero } from './ui/menus.js';
import { initTuner } from './ui/tuner.js';
import { initEmbers } from './ui/embers.js';
import { showBlessings, chooseBlessing } from './ui/blessings.js';

document.body.classList.toggle('touch', isTouch);
initHud();
initMenus();
initTuner();
initEmbers();
initInput();
applyPixelate();
addEventListener('resize', onResize);

// 调试入口：浏览器控制台里可用 dungeon.step(dt) 快进、dungeon.state 查看状态
window.dungeon = {
  step, startRun, tryRoll, fireShot, showBlessings, chooseBlessing, chooseHero, openSelect, spawnEnemy, nextRoom,
  get state() { return { ...S, bolts, shots }; },
};

// 第一次画某种模型时，显卡要编译着色器、上传贴图，画面会停顿半秒左右。
// 趁加载画面还挡着先画一帧标题场景（同一段脚本里完成，玩家看不到这一帧）
function warmUp() {
  step(0);
  renderer.render(scene, camera);
}
// 敌人模型后台下完后也预热：每帧只准备一种敌人（编译着色器、上传贴图），分散开标题画面就不会明显卡一下
function warmEnemies(keys = [...ENEMY_KEYS]) {
  const k = keys.shift(); if (!k) return;
  const c = makeChar(G[k]);
  scene.add(c.root);
  renderer.compile(scene, camera);
  c.root.traverse(o => { if (o.isMesh && o.material.map) renderer.initTexture(o.material.map); });
  scene.remove(c.root);
  requestAnimationFrame(() => warmEnemies(keys));
}

loadAll(showProgress).then(() => {
  toMenu();
  warmUp();
  $('loading').hidden = true;
  requestAnimationFrame(frame);
  enemiesReady().then(() => warmEnemies(), err => console.error(err));
}).catch(err => {
  console.error(err);
  $('loadText').textContent = '地牢资源加载失败，请刷新页面重试';
});
