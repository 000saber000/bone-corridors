import * as THREE from 'three';
import { $, isTouch } from '../utils.js';
import { cfg } from '../config.js';

// ---------- 渲染器、场景、相机、灯光 ----------
export const BASE_PR = Math.min(devicePixelRatio, isTouch ? 1.5 : 2);
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(BASE_PR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09070c);
scene.fog = new THREE.Fog(0x09070c, 28, 58);
export const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 140);

export const hemi = new THREE.HemisphereLight(0x8a7cb0, 0x20160f, 0.85);
scene.add(hemi);
export const moon = new THREE.DirectionalLight(0xb9c4ff, 1.1);
moon.castShadow = true;
moon.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);
export const heroLight = new THREE.PointLight(0xffb76b, 16, 13, 2);
scene.add(heroLight);
// 火把灯数量固定，换房间时只改位置和亮度，避免重新编译着色器造成卡顿
export const TORCH_LIGHTS = Array.from({ length: 5 }, () => { const l = new THREE.PointLight(0xff8a3d, 0, 13, 2); scene.add(l); return l; });

export const roomG = new THREE.Group(); scene.add(roomG);  // 房间里的墙、地砖、道具
export const fxG = new THREE.Group(); scene.add(fxG);      // 子弹、粒子、贴花等特效

// 三层地牢各自的色调：火把颜色、雾、环境光
export const THEMES = [
  { fog: 0x09070c, sky: 0x8a7cb0, ground: 0x20160f, torch: 0xff8a3d, flame: 0xff9a4a, moon: 0xb9c4ff, hero: 0xffb76b },
  { fog: 0x060a10, sky: 0x6f8fb8, ground: 0x0f1418, torch: 0x4fa8ff, flame: 0x6fc8ff, moon: 0xa8d8ff, hero: 0xffc890 },
  { fog: 0x0c0611, sky: 0x9a70c0, ground: 0x1a0c18, torch: 0xb46cff, flame: 0xc890ff, moon: 0xd0b0ff, hero: 0xffd0a0 },
];
export let theme = THEMES[0];
export function applyTheme(i) {
  theme = THEMES[i % THEMES.length];
  scene.background.setHex(theme.fog); scene.fog.color.setHex(theme.fog);
  hemi.color.setHex(theme.sky); hemi.groundColor.setHex(theme.ground);
  moon.color.setHex(theme.moon); heroLight.color.setHex(theme.hero);
  for (const l of TORCH_LIGHTS) l.color.setHex(theme.torch);
}

// 把 3D 画面按较低分辨率渲染再放大，得到像素块效果
export function applyPixelate() {
  const n = Math.max(1, cfg.pixelate | 0);
  renderer.setPixelRatio(n > 1 ? 1 / n : BASE_PR);
  renderer.setSize(innerWidth, innerHeight);
  $('stage').classList.toggle('pixelated', n > 1);
}

export function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
