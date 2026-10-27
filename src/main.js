// 骸骨回廊：入口。加载样式和模型，初始化界面与输入，然后进入标题画面。
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/hud.css';
import './styles/tuner.css';
import './styles/responsive.css';

import { S, bolts, shots } from './state.js';
import { $, isTouch } from './utils.js';
import { applyPixelate, onResize } from './engine/renderer.js';
import { loadAll } from './engine/assets.js';
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

loadAll(showProgress).then(() => {
  $('loading').hidden = true;
  toMenu();
  requestAnimationFrame(frame);
}).catch(err => {
  console.error(err);
  $('loadText').textContent = '地牢资源加载失败，请刷新页面重试';
});
