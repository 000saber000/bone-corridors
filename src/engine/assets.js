import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// KayKit 模型已转成内嵌数据的 glTF JSON（public/models/），并去掉了用不到的动画。
// 第二项是文件字节数，用来计算加载进度。新增模型用 npm run convert:model 转换。
export const ASSETS = {
  knight: ['models/Knight.json', 941716], mage: ['models/Mage.json', 756798],
  minion: ['models/Skeleton_Minion.json', 1002867], smage: ['models/Skeleton_Mage.json', 766248],
  warrior: ['models/Skeleton_Warrior.json', 1178129], rogue: ['models/Skeleton_Rogue.json', 1019546],
  floor: ['models/floor_tile_large.json', 37071], wall: ['models/wall.json', 70459], doorway: ['models/wall_doorway.json', 133026],
  gated: ['models/wall_gated.json', 61429], torch: ['models/torch_mounted.json', 43875], pillar: ['models/pillar.json', 33676],
  barrel: ['models/barrel_large.json', 58641], boxes: ['models/box_stacked.json', 195540], banner: ['models/banner_red.json', 31876],
  rubble: ['models/rubble_half.json', 51373], chest: ['models/chest.json', 107416],
};
const CHAR_KEYS = ['knight', 'mage', 'minion', 'smage', 'warrior', 'rogue'];
// 敌人模型占了一大半体积，但标题画面用不到：先加载英雄和场景，敌人在玩家看标题、选英雄时后台下载
export const ENEMY_KEYS = ['minion', 'smage', 'warrior', 'rogue'];
const FIRST_KEYS = Object.keys(ASSETS).filter(k => !ENEMY_KEYS.includes(k));

// 加载完成后的 glTF，按 ASSETS 的键索引
export const G = {};

const loader = new GLTFLoader();
function loadOne(k, onBytes) {
  return new Promise((res, rej) => {
    const done = gltf => {
      const isChar = CHAR_KEYS.includes(k);
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = k !== 'floor';
        o.receiveShadow = !isChar;
        if (isChar) o.frustumCulled = false;
      });
      G[k] = gltf; onBytes(ASSETS[k][1]); res();
    };
    // 单文件版把模型直接嵌在页面里（<script id="asset-…">），双击打开时不需要服务器
    const embedded = document.getElementById('asset-' + k);
    if (embedded) loader.parse(embedded.textContent, '', done, rej);
    else loader.load(ASSETS[k][0], done, e => onBytes(e.loaded), rej);
  });
}

let enemiesP = null;
// 敌人模型加载完成（开始一局前要等它）
export const enemiesReady = () => enemiesP || Promise.reject(new Error('loadAll 还没调用'));
export const enemiesLoaded = () => ENEMY_KEYS.every(k => G[k]);

// 先加载标题画面需要的模型，进度条只算这一部分；返回后敌人模型继续在后台下载
export async function loadAll(onProgress) {
  const total = FIRST_KEYS.reduce((s, k) => s + ASSETS[k][1], 0);
  const got = {};
  const report = () => onProgress(FIRST_KEYS.reduce((s, k) => s + Math.min(got[k] || 0, ASSETS[k][1]), 0) / total);
  await Promise.all(FIRST_KEYS.map(k => loadOne(k, n => { got[k] = n; report(); })));
  enemiesP = Promise.all(ENEMY_KEYS.map(k => loadOne(k, () => {})));
}
