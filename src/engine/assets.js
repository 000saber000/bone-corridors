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
const TOTAL = Object.values(ASSETS).reduce((s, a) => s + a[1], 0);

// 加载完成后的 glTF，按 ASSETS 的键索引
export const G = {};

export async function loadAll(onProgress) {
  const loader = new GLTFLoader();
  const got = {};
  const report = () => onProgress(Object.keys(ASSETS).reduce((s, k) => s + Math.min(got[k] || 0, ASSETS[k][1]), 0) / TOTAL);
  await Promise.all(Object.entries(ASSETS).map(([k, [url, size]]) => new Promise((res, rej) => {
    const done = gltf => { got[k] = size; report(); G[k] = gltf; res(); };
    // 单文件版把模型直接嵌在页面里（<script id="asset-…">），双击打开时不需要服务器
    const embedded = document.getElementById('asset-' + k);
    if (embedded) loader.parse(embedded.textContent, '', done, rej);
    else loader.load(url, done, e => { got[k] = e.loaded; report(); }, rej);
  })));
  for (const k of Object.keys(G)) {
    const isChar = CHAR_KEYS.includes(k);
    G[k].scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = k !== 'floor';
      o.receiveShadow = !isChar;
      if (isChar) o.frustumCulled = false;
    });
  }
}
