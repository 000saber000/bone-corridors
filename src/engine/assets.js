import { FileLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSETS, CHAR_KEYS, ENEMY_KEYS, SCENERY_KEYS, SCENERY_BUNDLE } from './asset-list.js';

export { ENEMY_KEYS };
const FIRST_KEYS = Object.keys(ASSETS).filter(k => !ENEMY_KEYS.includes(k));

// 加载完成后的 glTF，按 ASSETS 的键索引
export const G = {};

const loader = new GLTFLoader();
// 单文件版把模型直接嵌在页面里（<script id="asset-…">），双击打开时不需要服务器
const embedded = k => document.getElementById('asset-' + k);
// 构建版的场景模型合在 SCENERY_BUNDLE 一个文件里；开发模式和单文件版仍按单个模型加载
const bundled = !import.meta.env.DEV && !embedded('floor');

// KayKit 的 11 个场景模型各带一份相同的 dungeon_texture，4 个骷髅也各带一份 skeleton_texture。
// 同名贴图只留第一份、大家共用：显卡少上传十几张 1024×1024 的图（没有独立显卡的电脑上这一步很慢）
const sharedTex = new Map();
function shareTextures(mat) {
  for (const key of Object.keys(mat)) {
    const t = mat[key];
    if (!t || !t.isTexture || !t.name) continue;
    const keep = sharedTex.get(t.name);
    if (!keep) sharedTex.set(t.name, t);
    else if (keep !== t) { mat[key] = keep; t.image?.close?.(); }
  }
}

function prepare(k, gltf) {
  const isChar = CHAR_KEYS.includes(k);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = k !== 'floor';
    o.receiveShadow = !isChar;
    if (isChar) o.frustumCulled = false;
    [].concat(o.material).forEach(shareTextures);
  });
  G[k] = gltf;
}
const parse = (k, data) => new Promise((res, rej) => loader.parse(data, '', gltf => { prepare(k, gltf); res(); }, rej));

// 加载一个模型；onBytes 报告已下载的字节数
function loadOne(k, onBytes) {
  const el = embedded(k);
  if (el) return parse(k, el.textContent).then(() => onBytes(ASSETS[k][1]));
  return new Promise((res, rej) => loader.load(ASSETS[k][0], gltf => { prepare(k, gltf); onBytes(ASSETS[k][1]); res(); }, e => onBytes(e.loaded), rej));
}
function loadScenery(onBytes) {
  const size = SCENERY_KEYS.reduce((s, k) => s + ASSETS[k][1], 0);
  return new Promise((res, rej) => new FileLoader().setResponseType('json').load(SCENERY_BUNDLE, all => {
    onBytes(size);
    Promise.all(SCENERY_KEYS.map(k => parse(k, all[k]))).then(res, rej);
  }, e => onBytes(Math.min(e.loaded, size)), rej));
}

let enemiesP = null;
// 敌人模型加载完成（开始一局前要等它）
export const enemiesReady = () => enemiesP || Promise.reject(new Error('loadAll 还没调用'));
export const enemiesLoaded = () => ENEMY_KEYS.every(k => G[k]);

// 先加载标题画面需要的模型，进度条只算这一部分；返回后敌人模型继续在后台下载
export async function loadAll(onProgress) {
  const total = FIRST_KEYS.reduce((s, k) => s + ASSETS[k][1], 0);
  const got = {};
  const report = () => onProgress(Object.values(got).reduce((s, n) => s + n, 0) / total);
  const track = key => n => { got[key] = n; report(); };
  const first = bundled
    ? [loadScenery(track('scenery')), ...FIRST_KEYS.filter(k => !SCENERY_KEYS.includes(k)).map(k => loadOne(k, track(k)))]
    : FIRST_KEYS.map(k => loadOne(k, track(k)));
  await Promise.all(first);
  enemiesP = Promise.all(ENEMY_KEYS.map(k => loadOne(k, () => {})));
}
