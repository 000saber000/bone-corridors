import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from './vendor/addons/utils/SkeletonUtils.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const isTouch = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.toggle('touch', isTouch);
const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

// ---------- 像素图：字符画 → SVG（可自动加 1 像素黑描边） ----------
function pixSvg(rows, pal, { outline = false, cls = '' } = {}) {
  let grid = rows.map(r => [...r]);
  if (outline) {
    const h = grid.length + 2, w = grid[0].length + 2;
    const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (grid[y - 1] && grid[y - 1][x - 1]) || '.'));
    const filled = (x, y) => g[y] && g[y][x] && g[y][x] !== '.' && g[y][x] !== '#';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (g[y][x] === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g[y][x] = '#';
    }
    grid = g;
  }
  let r = '';
  grid.forEach((row, y) => row.forEach((c, x) => { if (c !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === '#' ? '#000' : pal[c]}"/>`; }));
  return `<svg class="${cls}" viewBox="0 0 ${grid[0].length} ${grid.length}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
const HEART = ['.KK...KK.', 'KRRK.KRRK', 'KRWRKRRRK', 'KRRRRRRRK', '.KRRRRRK.', '..KRRRK..', '...KRK...', '....K....'];
const HEART_FULL = pixSvg(HEART, { K: '#000', R: '#e5484d', W: '#ffd0d0' });
const HEART_EMPTY = pixSvg(HEART, { K: '#000', R: '#3a2f45', W: '#4a3c5a' });
const SKULL = pixSvg(['WWWWW', 'WKWKW', 'WWWWW', '.WKW.', '.W.W.'], { W: '#fff3d6', K: '#000' }, { outline: true });
const UI_W = { W: '#fff2b0' };
const SOUND_ON = pixSvg(['....W.....', '...WW..W..', 'WWWWW...W.', 'WWWWW.W.W.', 'WWWWW.W.W.', 'WWWWW...W.', '...WW..W..', '....W.....'], UI_W);
const SOUND_OFF = pixSvg(['....W.....', '...WW.....', 'WWWWW.W..W', 'WWWWW..WW.', 'WWWWW..WW.', 'WWWWW.W..W', '...WW.....', '....W.....'], UI_W);
const PAUSE = pixSvg(['WW..WW', 'WW..WW', 'WW..WW', 'WW..WW', 'WW..WW', 'WW..WW'], UI_W);

// ---------- 可调参数 ----------
const SLIDERS = [
  { key: 'moveMul',     label: '移速倍率',               min: 0.5, max: 2,   step: 0.05, def: 1 },
  { key: 'atkMul',      label: '攻速倍率',               min: 0.5, max: 3,   step: 0.05, def: 1 },
  { key: 'dmgMul',      label: '伤害倍率',               min: 0.5, max: 3,   step: 0.1,  def: 1 },
  { key: 'fireDelay',   label: '站定后出手延迟（秒）',   min: 0,   max: 0.6, step: 0.02, def: 0.12 },
  { key: 'rollDistMul', label: '翻滚距离倍率',           min: 0.5, max: 2,   step: 0.05, def: 1 },
  { key: 'rollCdMul',   label: '翻滚冷却倍率',           min: 0.3, max: 2,   step: 0.05, def: 1 },
  { key: 'enemySpeed',  label: '骷髅移速',               min: 1,   max: 7,   step: 0.1,  def: 3.2 },
  { key: 'bulletSpeed', label: '敌方弹速',               min: 3,   max: 14,  step: 0.5,  def: 7 },
  { key: 'enemyHpMul',  label: '敌人血量倍率',           min: 0.3, max: 3,   step: 0.1,  def: 1 },
  { key: 'hitstop',     label: '命中顿帧强度',           min: 0,   max: 2,   step: 0.1,  def: 1 },
  { key: 'hpBonus',     label: '额外生命（下局）',       min: 0,   max: 10,  step: 1,    def: 0 },
  { key: 'pixelate',    label: '3D 画面像素化（1 = 关）', min: 1,  max: 5,   step: 1,    def: 1 },
];
const DEFAULTS = Object.fromEntries(SLIDERS.map(s => [s.key, s.def]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
let cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(store.get('bonecorr.cfg') || '{}')); } catch (e) {}
const saveCfg = () => store.set('bonecorr.cfg', JSON.stringify(cfg));

// ---------- 音效（WebAudio 合成） ----------
const sfx = {
  ctx: null, on: store.get('standfire.sound') !== 'off', noiseBuf: null,
  init() {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.noiseBuf) {
        const n = this.ctx.sampleRate * 0.6, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
      }
    } catch (e) { this.ctx = null; }
  },
  tone(type, f0, f1, dur, vol, delay = 0) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, f0, f1, delay = 0) {
    const c = this.ctx; if (!c || !this.on || !this.noiseBuf) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.02);
  },
  bolt()  { this.tone('square', 1300, 620, 0.06, 0.018); this.noise(0.05, 0.03, 3000, 1500); },
  hit()   { this.tone('triangle', 260, 90, 0.08, 0.07); this.noise(0.06, 0.08, 1400, 500); },
  crit()  { this.tone('square', 1500, 2400, 0.09, 0.035); this.tone('triangle', 200, 60, 0.14, 0.09); this.noise(0.1, 0.1, 2500, 600); },
  slash() { this.noise(0.16, 0.12, 900, 4200); this.tone('sawtooth', 300, 140, 0.1, 0.02); },
  clank() { this.tone('square', 1250, 900, 0.12, 0.035); this.tone('square', 1870, 1500, 0.1, 0.02); this.noise(0.08, 0.06, 4000, 2500); },
  bones() { this.noise(0.3, 0.12, 1800, 500); this.tone('square', 200, 70, 0.16, 0.03); },
  hurt()  { this.tone('sawtooth', 180, 50, 0.32, 0.09); this.noise(0.2, 0.08, 600, 200); },
  roll()  { this.noise(0.26, 0.1, 500, 2200); },
  dodge() { this.tone('sine', 1400, 2100, 0.1, 0.03); },
  cast()  { this.tone('sine', 260, 760, 0.55, 0.025); },
  dash()  { this.noise(0.22, 0.09, 2400, 700); },
  slam()  { this.tone('sine', 90, 30, 0.6, 0.18); this.noise(0.5, 0.14, 400, 80); },
  enemyShot() { this.tone('triangle', 620, 260, 0.14, 0.03); },
  door()  { this.tone('sawtooth', 70, 38, 0.9, 0.07); this.noise(0.8, 0.06, 260, 90); },
  bless() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.22, 0.03, i * 0.06)); this.tone('sine', 262, 1047, 0.7, 0.04); },
  pick()  { this.tone('square', 880, 1320, 0.08, 0.035); },
  whoosh() { this.noise(0.7, 0.07, 400, 3200); this.tone('sine', 400, 1600, 0.7, 0.02); },
  win()   { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.06, i * 0.12)); },
  lose()  { [330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.95, 0.4, 0.07, i * 0.2)); },
};

// ---------- 渲染器 ----------
const BASE_PR = Math.min(devicePixelRatio, isTouch ? 1.5 : 2);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(BASE_PR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09070c);
scene.fog = new THREE.Fog(0x09070c, 28, 58);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 140);

const hemi = new THREE.HemisphereLight(0x8a7cb0, 0x20160f, 0.85);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb9c4ff, 1.1);
moon.castShadow = true;
moon.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);
const heroLight = new THREE.PointLight(0xffb76b, 16, 13, 2);
scene.add(heroLight);
let heroPulse = 0;
const TORCH_LIGHTS = Array.from({ length: 5 }, () => { const l = new THREE.PointLight(0xff8a3d, 0, 13, 2); scene.add(l); return l; });

// 三层地牢各自的色调：火把颜色、雾、环境光
const THEMES = [
  { fog: 0x09070c, sky: 0x8a7cb0, ground: 0x20160f, torch: 0xff8a3d, flame: 0xff9a4a, moon: 0xb9c4ff, hero: 0xffb76b },
  { fog: 0x060a10, sky: 0x6f8fb8, ground: 0x0f1418, torch: 0x4fa8ff, flame: 0x6fc8ff, moon: 0xa8d8ff, hero: 0xffc890 },
  { fog: 0x0c0611, sky: 0x9a70c0, ground: 0x1a0c18, torch: 0xb46cff, flame: 0xc890ff, moon: 0xd0b0ff, hero: 0xffd0a0 },
];
let theme = THEMES[0];
function applyTheme(i) {
  theme = THEMES[i % THEMES.length];
  scene.background.setHex(theme.fog); scene.fog.color.setHex(theme.fog);
  hemi.color.setHex(theme.sky); hemi.groundColor.setHex(theme.ground);
  moon.color.setHex(theme.moon); heroLight.color.setHex(theme.hero);
  for (const l of TORCH_LIGHTS) l.color.setHex(theme.torch);
}

// ---------- 程序纹理 ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW = canvasTex(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.55, 'rgba(255,255,255,0.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const RING = canvasTex(256, (g, s) => {
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6;
  g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2); g.stroke();
});
const DISC = canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,0.15)'); r.addColorStop(0.85, 'rgba(255,255,255,0.35)'); r.addColorStop(0.95, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const RUNE = canvasTex(256, (g, s) => {
  const c = s / 2;
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4;
  g.beginPath(); g.arc(c, c, c - 8, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 30, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.save(); g.translate(c + Math.cos(a) * (c - 19), c + Math.sin(a) * (c - 19)); g.rotate(a);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(-2, -6, 4, 12); g.fillRect(-6, -2, 12, 4); g.restore();
  }
  g.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 * 2 - Math.PI / 2; const x = c + Math.cos(a) * (c - 34), y = c + Math.sin(a) * (c - 34); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.stroke();
});
const LANE = canvasTex(64, (g, s) => {
  const r = g.createLinearGradient(0, 0, s, 0);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const BEAM = canvasTex(64, (g, s) => {
  const h = g.createLinearGradient(0, 0, s, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)'); h.addColorStop(0.65, 'rgba(255,255,255,0.6)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h; g.fillRect(0, 0, s, s);
  const v = g.createLinearGradient(0, 0, 0, s);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.85)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = v; g.fillRect(0, 0, s, s);
});
// 剑光：画布上方的一道月牙（贴图“上方”= 角色正前方）
const SLASH = canvasTex(256, (g, s) => {
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.15 + i * 0.15})`;
    g.lineWidth = 34 - i * 5;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 22 - i * 1.5, -Math.PI * 0.86, -Math.PI * 0.14); g.stroke();
  }
});
const SPIN = canvasTex(256, (g, s) => {
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.12 + i * 0.13})`; g.lineWidth = 30 - i * 4;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 22, 0, Math.PI * 1.85); g.stroke();
  }
});
// 持盾骷髅的骨盾结界：前方一道半弧
const SHIELD = canvasTex(256, (g, s) => {
  g.shadowColor = 'white'; g.shadowBlur = 16;
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.35 + i * 0.3})`; g.lineWidth = 16 - i * 5;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 26, -Math.PI * 0.8, -Math.PI * 0.2); g.stroke();
  }
});
// 站定蓄力环：每帧按进度重绘
const chargeCanvas = document.createElement('canvas'); chargeCanvas.width = chargeCanvas.height = 128;
const chargeTex = new THREE.CanvasTexture(chargeCanvas); chargeTex.colorSpace = THREE.SRGBColorSpace;
let lastCharge = -1;
function drawCharge(p, moving) {
  const key = moving ? -2 : Math.round(p * 40);
  if (key === lastCharge) return; lastCharge = key;
  const g = chargeCanvas.getContext('2d'); g.clearRect(0, 0, 128, 128);
  g.lineWidth = 5; g.strokeStyle = 'rgba(155,146,166,0.35)';
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  if (!moving && p > 0) {
    g.strokeStyle = p >= 1 ? 'rgba(255,226,150,1)' : 'rgba(217,182,108,0.9)'; g.lineWidth = p >= 1 ? 7 : 5;
    g.beginPath(); g.arc(64, 64, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke();
  }
  chargeTex.needsUpdate = true;
}
const addMat = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
const glowMat = color => new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
function floorDecal(tex, color, size, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), addMat(tex, color, opacity));
  m.rotation.x = -Math.PI / 2; m.scale.set(size, size, 1); m.position.y = 0.09; m.renderOrder = 2;
  return m;
}
// 平面贴图的“上方”朝向角色 face 方向时，rotation.z 需要加 π
const faceToZ = face => face + Math.PI;

// ---------- 资源加载 ----------
const ASSETS = {
  // KayKit 模型已转成内嵌数据的 glTF JSON，并去掉了用不到的动画
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
const got = {};
const G = {};
function showProgress() {
  const done = Object.keys(ASSETS).reduce((s, k) => s + Math.min(got[k] || 0, ASSETS[k][1]), 0);
  const p = Math.round((done / TOTAL) * 100);
  $('loadFill').style.width = p + '%';
  $('loadText').textContent = `正在唤醒地牢 · ${p}%`;
}
async function loadAll() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(ASSETS).map(([k, [url, size]]) => new Promise((res, rej) => {
    const done = gltf => { got[k] = size; showProgress(); G[k] = gltf; res(); };
    // 单文件版把模型直接嵌在页面里（<script id="asset-…">），双击打开时不需要服务器
    const embedded = document.getElementById('asset-' + k);
    if (embedded) loader.parse(embedded.textContent, '', done, rej);
    else loader.load(url, done, e => { got[k] = e.loaded; showProgress(); }, rej);
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

// ---------- 角色模型 ----------
function makeChar(src, { scale = 1, hide = [], tint = null } = {}) {
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
function play(ch, name, { loop = true, fade = 0.18, timeScale = 1, restart = false } = {}) {
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
const clipLen = (ch, name) => (ch.actions[name] ? ch.actions[name].getClip().duration : 1);
function flash(ch, now, strength = 0.9) {
  ch.flashUntil = now + 0.07;
  for (const m of ch.mats) { m.emissive.setRGB(1, 0.95, 0.85); m.emissiveIntensity = strength; }
}
function unflash(ch, now) {
  if (!ch.flashUntil || now < ch.flashUntil) return;
  ch.flashUntil = 0;
  for (const m of ch.mats) { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
}

// ---------- 英雄 ----------
const ROLE_PAL = { W: '#fff6e0', S: '#c9d1e0', G: '#f2c14e', B: '#8a5a2c', P: '#b98cff', Y: '#fff2b0', C: '#6fd3ff' };
const CLASSES = {
  mage: {
    name: '法师', role: '远程 · 奥术', rarity: 'r-arcane', model: 'mage', hide: ['Spellbook', 'Spellbook_open', '1H_Wand'],
    desc: '站定后自动向最近的敌人发射奥术飞弹。射程远，但身板脆弱，翻滚距离一般。',
    hp: 4, speed: 6.4, roll: { speed: 14, dur: 0.3, cd: 0.95 },
    attack: 'ranged', range: 13, fireRate: 4, damage: 1,
    stats: { 生命: 2, 射程: 5, 伤害: 3, 翻滚: 2 },
    icon: ['....PP....', '...PYYP...', '..PYPPYP..', '...PYYP...', '....PP....', '....B.....', '....B.....', '....B.....', '....B.....', '....B.....'],
  },
  knight: {
    name: '骑士', role: '近战 · 剑盾', rarity: 'r-frost', model: 'knight', hide: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword'],
    desc: '站定后自动挥剑横扫身前的敌人，剑光能斩碎飞来的弹幕。翻滚更远、冷却更短，生命更厚。',
    hp: 6, speed: 6.8, roll: { speed: 19, dur: 0.34, cd: 0.5 },
    attack: 'melee', reach: 2.8, swingRate: 1.8, damage: 3,
    stats: { 生命: 4, 射程: 1, 伤害: 5, 翻滚: 5 },
    icon: ['........WW', '.......WSW', '......WSW.', '.....WSW..', '..G.WSW...', '...GSW....', '...BGG....', '..B..G....', '.B........', 'B.........'],
  },
};

// ---------- 房间布局 ----------
const LAYOUTS = [
  { id: 'hall', name: '幽暗门厅', w: 5, d: 5,
    props: [['barrel', -8.3, -8.3], ['barrel', -6.6, -8.6], ['boxes', 7.6, -7.4, 0.5], ['rubble', -10, 6, 0], ['barrel', 8.4, 7.6]],
    torches: [['N', -6], ['N', 6], ['W', -3], ['E', -3]], banners: [['N', -3.2], ['N', 3.2]] },
  { id: 'corridor', name: '石柱长廊', w: 7, d: 5,
    props: [['pillar', -6, -3], ['pillar', 6, -3], ['pillar', -6, 4.5], ['pillar', 6, 4.5], ['boxes', -11.4, -7.4, 0.3], ['barrel', 12, -8.2], ['barrel', 12.2, 7.8], ['rubble', 10, 3, Math.PI]],
    torches: [['N', -10], ['N', -5], ['N', 5], ['N', 10], ['W', 0]], banners: [['N', -3.2], ['N', 3.2], ['E', -4]] },
  { id: 'cross', name: '十字墓室', w: 7, d: 7,
    props: [['pillar', -2.2, -2.2], ['pillar', 2.2, -2.2], ['pillar', -2.2, 2.2], ['pillar', 2.2, 2.2], ['boxes', -11.5, -11.5, 0], ['boxes', 11.5, 11.5, 1.2], ['barrel', 11.8, -12], ['barrel', -12, 11.8]],
    torches: [['N', -8], ['N', 8], ['W', -6], ['E', -6], ['E', 6]], banners: [['N', -3.2], ['N', 3.2]] },
  { id: 'gallery', name: '石棺回廊', w: 9, d: 5,
    props: [['barrel', -13, -5], ['barrel', -13, 0], ['barrel', -13, 5], ['barrel', 13, -5], ['barrel', 13, 0], ['barrel', 13, 5], ['pillar', -6, 0], ['pillar', 6, 0]],
    torches: [['N', -12], ['N', -6], ['N', 6], ['N', 12], ['W', 0]], banners: [['N', -3.2], ['N', 3.2], ['N', -9], ['N', 9]] },
  { id: 'well', name: '枯井密室', w: 5, d: 7,
    props: [['rubble', -10, -6, 0], ['rubble', 10, 4, Math.PI], ['pillar', 0, -1], ['barrel', -8, 10], ['barrel', 8, -10.5]],
    torches: [['N', -6], ['N', 6], ['W', -7], ['E', -7], ['W', 5]], banners: [['N', -3.2], ['N', 3.2]] },
  { id: 'ossuary', name: '藏骨堂', w: 7, d: 5,
    props: [['boxes', -9, -6.5, 0.2], ['boxes', 9, -6.5, -0.2], ['barrel', -3.5, 3], ['barrel', 3.5, 3], ['rubble', -14, -2, 0], ['rubble', 14, -2, Math.PI]],
    torches: [['N', -10], ['N', -5], ['N', 5], ['N', 10], ['E', 3]], banners: [['N', -3.2], ['N', 3.2], ['W', 3]] },
];
const ARENA = { id: 'arena', name: '首领之间', w: 7, d: 7,
  props: [['pillar', -8, -7.5], ['pillar', 8, -7.5], ['pillar', -8, 7], ['pillar', 8, 7], ['barrel', -12.4, -12.2], ['barrel', 12.4, -12.2]],
  torches: [['N', -9], ['N', 9], ['W', -5], ['E', -5], ['W', 6]], banners: [['N', -3.2], ['N', 3.2], ['W', 2], ['E', 2]] };
const PROP_R = { barrel: 0.95, boxes: 1.9, pillar: 0.85, rubble: 1.5, chest: 1.1 };

// 战役的三层：敌人池、首领、首领房名
const FLOORS = [
  { name: '地牢浅层', pool: ['minion', 'minion', 'mage', 'rogue'], boss: 'guardian', arena: '守卫之厅' },
  { name: '骸骨回廊', pool: ['minion', 'mage', 'rogue', 'warrior'], boss: 'warlord', arena: '战将擂台' },
  { name: '白骨王座', pool: ['minion', 'mage', 'mage', 'rogue', 'warrior', 'warrior'], boss: 'archlich', arena: '大巫祭坛' },
];

// ---------- 敌人 ----------
const ENEMY = {
  minion:   { src: 'minion',  hp: 3,   r: 0.6,  scale: 1,    cost: 1 },
  mage:     { src: 'smage',   hp: 4,   r: 0.6,  scale: 1,    cost: 1.6 },
  rogue:    { src: 'rogue',   hp: 3,   r: 0.55, scale: 1,    cost: 1.5 },
  warrior:  { src: 'warrior', hp: 7,   r: 0.72, scale: 1.12, cost: 2.4 },
  guardian: { src: 'minion',  hp: 80,  r: 1.05, scale: 1.65, tint: 0xff8c80, boss: '骸骨守卫' },
  warlord:  { src: 'warrior', hp: 120, r: 1.15, scale: 1.85, tint: 0xffb070, boss: '骸骨战将' },
  archlich: { src: 'smage',   hp: 150, r: 1.1,  scale: 1.9,  tint: 0xc9a0ff, boss: '骸骨大巫' },
};
const BOSS_ORDER = ['guardian', 'warlord', 'archlich'];

// ---------- 状态 ----------
const roomG = new THREE.Group(); scene.add(roomG);
const fxG = new THREE.Group(); scene.add(fxG);
let room = null;
let obstacles = [];
let mode = 'loading';          // loading | menu | select | play | upgrade | transition | over-pending | over
let paused = false;
let T = 0;                     // 本局游戏时间（秒）
let run = null;                // { mode: 'campaign'|'endless', cls, floor, room, depth }
let stats = { kills: 0, dodges: 0 };
let mods = null;
let player = null;
let enemies = [];
const bolts = [], shots = [], parts = [], fx = [];
let shake = 0, hitstop = 0, slowmo = 0;
const camTarget = new THREE.Vector3();
const camOff = new THREE.Vector3();
let selMode = 'campaign';
let selHero = store.get('bonecorr.hero') === 'knight' ? 'knight' : 'mage';

const freeze = s => { hitstop = Math.max(hitstop, s * cfg.hitstop); };
const shakeAdd = v => { if (!reduceMotion) shake = Math.max(shake, v); };

// ---------- 搭建房间 ----------
function place(key, x, y, z, ry = 0) {
  const o = G[key].scene.clone(); o.position.set(x, y, z); o.rotation.y = ry; roomG.add(o); return o;
}
function wallMount(side, at, hx, hz) {
  if (side === 'N') return { x: at, z: -hz, ry: 0, lx: at, lz: -hz + 0.9 };
  if (side === 'W') return { x: -hx, z: at, ry: Math.PI / 2, lx: -hx + 0.9, lz: at };
  return { x: hx, z: at, ry: -Math.PI / 2, lx: hx - 0.9, lz: at };
}
function buildRoom(def) {
  roomG.clear();
  const hx = def.w * 2, hz = def.d * 2;
  obstacles = [];
  for (let i = 0; i < def.w; i++) for (let j = 0; j < def.d; j++) place('floor', -hx + 2 + i * 4, 0, -hz + 2 + j * 4);
  const mid = (def.w - 1) / 2;
  let gate = null;
  for (let i = 0; i < def.w; i++) {
    const x = -hx + 2 + i * 4;
    if (i === mid) gate = place('gated', x, 0, -hz - 0.5);
    else place('wall', x, 0, -hz - 0.5);
  }
  for (let j = 0; j < def.d; j++) {
    const z = -hz + 2 + j * 4;
    place('wall', -hx - 0.5, 0, z, Math.PI / 2);
    place('wall', hx + 0.5, 0, z, Math.PI / 2);
  }
  for (const [x, z] of [[-hx - 0.5, -hz - 0.5], [hx + 0.5, -hz - 0.5], [-hx - 0.5, hz + 0.5], [hx + 0.5, hz + 0.5]]) place('pillar', x, 0, z);
  for (const [k, x, z, ry = 0] of def.props) {
    place(k, x, 0, z, ry);
    obstacles.push(k === 'rubble' ? { x: x + 2 * Math.cos(ry), z: z - 2 * Math.sin(ry), r: PROP_R.rubble } : { x, z, r: PROP_R[k] });
  }
  for (const [side, at] of def.banners) {
    const m = wallMount(side, at, hx, hz);
    const o = place('banner', m.x, 0, m.z, m.ry);
    o.position.addScaledVector(new THREE.Vector3(Math.sin(m.ry), 0, Math.cos(m.ry)), -0.5);
  }
  const torches = [];
  def.torches.forEach(([side, at], i) => {
    const m = wallMount(side, at, hx, hz);
    place('torch', m.x, 2.1, m.z, m.ry);
    const flame = new THREE.Sprite(glowMat(theme.flame)); flame.scale.set(1.3, 1.6, 1);
    const fwd = new THREE.Vector3(Math.sin(m.ry), 0, Math.cos(m.ry));
    flame.position.set(m.x, 2.85, m.z).addScaledVector(fwd, 0.45); roomG.add(flame);
    const l = TORCH_LIGHTS[i]; l.position.set(m.lx, 3.1, m.lz); l.intensity = 22;
    torches.push({ light: l, flame, seed: Math.random() * 10 });
  });
  for (let i = def.torches.length; i < TORCH_LIGHTS.length; i++) TORCH_LIGHTS[i].intensity = 0;
  room = {
    def, hx, hz, gate, door: null, doorOpen: false, doorT: 0, doorX: 0, torches,
    bounds: { minX: -hx, maxX: hx, minZ: -hz, maxZ: hz },
    waveIdx: -1, waitUntil: null, cleared: false, beacon: null, plan: null,
  };
}
function openDoor() {
  roomG.remove(room.gate);
  const d = place('doorway', room.doorX, 0, -room.hz - 0.5);
  room.door = d.getObjectByName('wall_doorway_door');
  room.doorOpen = true; room.doorT = 0;
  const beacon = new THREE.Sprite(glowMat(0xffd27a)); beacon.scale.set(5, 5, 1); beacon.position.set(room.doorX, 1.8, -room.hz + 0.2);
  roomG.add(beacon);
  const arrow = floorDecal(LANE, 0xffd27a, 1, 0.5); arrow.scale.set(2.4, 5, 1); arrow.position.set(room.doorX, 0.09, -room.hz + 3);
  roomG.add(arrow);
  room.beacon = { beacon, arrow };
  sfx.door();
}

// ---------- 实体 ----------
function newPlayer(key) {
  const cls = CLASSES[key];
  const ch = makeChar(G[cls.model], { hide: cls.hide });
  scene.add(ch.root);
  const ring = floorDecal(chargeTex, 0xffffff, 2.6);
  const range = floorDecal(RING, cls.attack === 'melee' ? 0x6fd3ff : 0xd9b66c, 1, 0);
  scene.add(ring, range);
  play(ch, 'Idle');
  const hp = cls.hp + (cfg.hpBonus | 0);
  return { key, cls, ch, ring, range, pos: new THREE.Vector3(), face: Math.PI, hp, maxHp: hp,
    rolling: 0, rollDir: { x: 0, z: -1 }, rollReadyAt: 0, rollTotal: 1, invulnUntil: 0, still: 0, nextShot: 0,
    moving: false, dead: false, regen: 0, swing: null, swings: 0, glow: 0, hitAnimUntil: 0, leech: 0 };
}
function disposePlayer() {
  if (!player) return;
  scene.remove(player.ch.root, player.ring, player.range);
  player = null;
}
function spawnEnemy(kind, x, z) {
  const spec = ENEMY[kind];
  const ch = makeChar(G[spec.src], { scale: spec.scale, tint: spec.tint });
  ch.root.position.set(x, 0, z);
  scene.add(ch.root);
  const isBoss = !!spec.boss;
  const rune = floorDecal(RUNE, isBoss ? 0xff5a4a : 0xa87cff, isBoss ? 5.5 : 2.8, 0.9);
  rune.position.set(x, 0.1, z); fxG.add(rune);
  const spawnDur = isBoss ? 1.8 : 1.15;
  play(ch, 'Spawn_Ground_Skeletons', { loop: false, fade: 0, timeScale: clipLen(ch, 'Spawn_Ground_Skeletons') / (spawnDur + 0.25) });
  const hpScale = (room && room.plan ? (isBoss ? room.plan.bossScale : room.plan.hpScale) : 1) * cfg.enemyHpMul;
  const hp = Math.max(1, Math.round(spec.hp * hpScale));
  const e = { kind, spec, ch, rune, pos: new THREE.Vector3(x, 0, z), y: 0, r: spec.r, scale: spec.scale, hp, maxHp: hp,
    boss: spec.boss || null, state: 'spawn', t: 0, spawnDur,
    face: player ? Math.atan2(player.pos.x - x, player.pos.z - z) : 0, cd: T + rand(0.4, 1.4), kx: 0, kz: 0,
    strafe: Math.random() < 0.5 ? 1 : -1, summoned: 0, hitDone: false, punch: 0, staggerUntil: 0, guard: false, guardBreakUntil: 0 };
  if (kind === 'warrior' || kind === 'warlord') {
    e.shield = floorDecal(SHIELD, 0x7fd0ff, kind === 'warlord' ? 5.2 : 3.4, 0);
    e.shield.renderOrder = 3; fxG.add(e.shield);
  }
  enemies.push(e);
  return e;
}
function spawnPoint(minDist) {
  const b = room.bounds;
  for (let i = 0; i < 40; i++) {
    const x = rand(b.minX + 2, b.maxX - 2), z = rand(b.minZ + 2, b.maxZ - 2);
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < minDist) continue;
    if (obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + 1.4)) continue;
    if (enemies.some(e => e.state !== 'dead' && Math.hypot(x - e.pos.x, z - e.pos.z) < 1.6)) continue;
    return [x, z];
  }
  return [rand(b.minX + 2, b.maxX - 2), b.minZ + 2];
}
function spawnWave(w) {
  for (const kind of Object.keys(w)) {
    for (let i = 0; i < w[kind]; i++) {
      if (ENEMY[kind].boss) spawnEnemy(kind, 0, -room.hz + 6);
      else { const [x, z] = spawnPoint(kind === 'mage' ? 8 : 6); spawnEnemy(kind, x, z); }
    }
  }
  const boss = enemies.find(e => e.boss && e.state !== 'dead');
  if (boss) { $('bossName').textContent = boss.boss; $('boss').hidden = false; $('foes').hidden = true; updateBoss(); }
}
// 按难度预算随机配怪：难度越高预算越多，法师和持盾骷髅有数量上限
function genWaves(lvl, pool, n) {
  const waves = [];
  for (let w = 0; w < n; w++) {
    let budget = 3.5 + lvl * 1.1 + w * 1.3;
    const wave = {}; let count = 0, guard = 0;
    while (budget >= 1 && count < 14 && guard++ < 60) {
      let k = pick(pool);
      if (ENEMY[k].cost > budget) k = 'minion';
      if (k === 'mage' && (wave.mage || 0) >= 1 + Math.floor(lvl / 3)) continue;
      if (k === 'warrior' && (wave.warrior || 0) >= 1 + Math.floor(lvl / 4)) continue;
      if (k === 'rogue' && (wave.rogue || 0) >= 2 + Math.floor(lvl / 4)) continue;
      wave[k] = (wave[k] || 0) + 1; budget -= ENEMY[k].cost; count++;
    }
    waves.push(wave);
  }
  return waves;
}
const alive = () => enemies.filter(e => e.state !== 'dead');
const targetable = e => e.state !== 'dead' && e.state !== 'spawn' && e.state !== 'teleport';

// ---------- 碰撞 ----------
function collide(pos, r, isPlayer) {
  for (const o of obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), m = r + o.r;
    if (d < m) { if (d < 1e-4) pos.x += m; else { pos.x = o.x + (dx / d) * m; pos.z = o.z + (dz / d) * m; } }
  }
  const b = room.bounds;
  pos.x = clamp(pos.x, b.minX + r, b.maxX - r);
  pos.z = Math.min(pos.z, b.maxZ - r);
  const exiting = isPlayer && room.doorOpen && Math.abs(pos.x - room.doorX) < 1.4;
  if (!exiting) pos.z = Math.max(pos.z, b.minZ + r);
  else if (pos.z < b.minZ + r) pos.x = clamp(pos.x, room.doorX - 1.3, room.doorX + 1.3);
}
const blocked = (x, z, pad = 0) => obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + pad);
const outside = (x, z) => { const b = room.bounds; return x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ; };

// ---------- 特效 ----------
function burst(x, y, z, color, n, speed = 5, life = 0.45, size = 0.35, grav = -6) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(glowMat(color)); s.position.set(x, y, z); s.scale.setScalar(size);
    const a = Math.random() * Math.PI * 2, up = rand(0.2, 1);
    fxG.add(s);
    parts.push({ s, vx: Math.cos(a) * speed * rand(0.4, 1), vy: up * speed * 0.8, vz: Math.sin(a) * speed * rand(0.4, 1), life, max: life, size, grav });
  }
}
function dot(x, y, z, color, size, life) {
  const s = new THREE.Sprite(glowMat(color)); s.position.set(x, y, z); s.scale.setScalar(size); fxG.add(s);
  parts.push({ s, vx: 0, vy: 0, vz: 0, life, max: life, size, grav: 0 });
}
function ringFx(x, z, color, from, to, dur, opacity = 0.9, tex = RING) {
  const m = floorDecal(tex, color, from, opacity); m.position.set(x, 0.12, z); fxG.add(m);
  fx.push({ m, from, to, t: 0, dur, opacity });
}
function beamFx(x, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: BEAM, color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.position.set(x, 5.2, z); s.scale.set(3, 11, 1); fxG.add(s);
  fx.push({ m: s, t: 0, dur: 1.1, upd: k => { s.scale.x = 3 * (1 - k) + 0.3; s.material.opacity = 1 - k * k; } });
}
function slashFx(pos, face, reach, spin) {
  const size = reach * 2.5;
  const m = floorDecal(spin ? SPIN : SLASH, 0xc8f1ff, size, 1);
  m.position.set(pos.x, 1.0, pos.z); m.rotation.z = faceToZ(face); m.renderOrder = 4;
  fxG.add(m);
  const z0 = m.rotation.z;
  fx.push({ m, t: 0, dur: 0.2, upd: k => { m.material.opacity = 1 - k; m.scale.setScalar(size * (0.9 + 0.2 * k)); if (spin) m.rotation.z = z0 - k * 4; } });
}
function impactFx(x, y, z, color, big = false) {
  const s = new THREE.Sprite(glowMat(color)); s.position.set(x, y, z); fxG.add(s);
  const sz = big ? 2.6 : 1.6;
  fx.push({ m: s, t: 0, dur: big ? 0.16 : 0.1, upd: k => { s.scale.setScalar(sz * (1 - k * 0.5)); s.material.opacity = 1 - k; } });
}
const popWrap = $('popups');
const tmpV = new THREE.Vector3();
let lastPop = 0;
function screenOf(x, y, z) {
  tmpV.set(x, y, z).project(camera);
  return { x: ((tmpV.x + 1) / 2) * innerWidth, y: ((1 - tmpV.y) / 2) * innerHeight };
}
function popup(text, pos, kind = '') {
  if (kind !== 'big' && performance.now() - lastPop < 220) return;
  lastPop = performance.now();
  const p = screenOf(pos.x, kind === 'big' ? 3.4 : 2.6, pos.z);
  const el = document.createElement('span'); el.className = 'pop ' + kind; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  popWrap.appendChild(el); setTimeout(() => el.remove(), kind === 'big' ? 1500 : 950);
}
function dmgNum(e, n, kind = '') {
  if (popWrap.childElementCount > 48) return;
  const p = screenOf(e.pos.x, 2.3 * e.scale + e.y, e.pos.z);
  const el = document.createElement('span'); el.className = 'dmg ' + kind;
  el.textContent = kind === 'crit' ? n + '!' : String(n);
  el.style.left = Math.round(p.x + rand(-18, 18)) + 'px'; el.style.top = Math.round(p.y + rand(-6, 6)) + 'px';
  popWrap.appendChild(el); setTimeout(() => el.remove(), 950);
}

// ---------- 子弹 ----------
function fireBolts(tgt) {
  const p = player;
  const base = Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z);
  const n = 1 + mods.extraShots;
  const charged = mods.charge && p.still > 1.2;
  const dmg = (p.cls.damage + mods.dmgAdd) * cfg.dmgMul * (charged ? 2 : 1);
  const tipX = p.pos.x + Math.sin(base) * 0.9, tipZ = p.pos.z + Math.cos(base) * 0.9;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.16;
    const color = charged ? 0xffe9a8 : 0xc39bff;
    const s = new THREE.Sprite(glowMat(color)); s.scale.setScalar(charged ? 1.15 : 0.9);
    const core = new THREE.Sprite(glowMat(0xffffff)); core.scale.setScalar(0.38);
    s.position.set(tipX, 1.45, tipZ); core.position.copy(s.position); fxG.add(s, core);
    bolts.push({ s, core, x: tipX, z: tipZ, vx: Math.sin(a) * 26, vz: Math.cos(a) * 26, life: p.cls.range / 26 + 0.15, dmg, color, pierce: mods.pierce, hit: new Set() });
  }
  impactFx(tipX, 1.45, tipZ, charged ? 0xffe9a8 : 0xc39bff);
  heroPulse = 1;
  sfx.bolt();
}
function fireShot(x, z, a, speed, color = 0xb98cff) {
  const s = new THREE.Sprite(glowMat(color)); s.scale.setScalar(1.05);
  const core = new THREE.Sprite(glowMat(0xffffff)); core.scale.setScalar(0.4);
  s.position.set(x, 1.15, z); core.position.copy(s.position);
  fxG.add(s, core);
  shots.push({ s, core, x, z, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, life: 6, dodged: false, color });
}
function removeAt(arr, i) { const o = arr[i]; fxG.remove(o.s); if (o.core) fxG.remove(o.core); arr.splice(i, 1); }

// ---------- 祝福 ----------
// 10x10 像素图标，渲染时自动加黑描边
const ICON_PAL = { R: '#e5484d', O: '#ff8a3d', Y: '#fff2b0', W: '#fff6e0', G: '#f2c14e', B: '#8a5a2c', P: '#b98cff', C: '#6fd3ff', N: '#7bd66b', L: '#2f6a35', S: '#c9d1e0' };
const ICON = {
  fire: ['....R.....', '...RO.....', '...ROR..R.', '..ROOR.RO.', '..ROYOROR.', '.ROYYYOOR.', '.ROYWWYOR.', '.ROYWWYOR.', '..ROYYOR..', '...RRRR...'],
  sword: CLASSES.knight.icon,
  split: ['Y...Y...Y.', 'YY..Y..YY.', '.Y..Y..Y..', '..Y.Y.Y...', '...YYY....', '....Y.....', '....Y.....', '....G.....', '...GGG....', '....G.....'],
  still: ['..PPPPPP..', '.P......P.', 'P..PPPP..P', 'P.P....P.P', 'P.P.WW.P.P', 'P.P.WW.P.P', 'P.P....P.P', 'P..PPPP..P', '.P......P.', '..PPPPPP..'],
  wave: ['..........', '..CC..CC..', '.C..CC..C.', '..........', '..CC..CC..', '.C..CC..C.', '..........', '....YY....', '...YYYY...', 'YYYYYYYYYY'],
  feather: ['.......WW.', '.....WWWW.', '....WWWCW.', '...WWWCW..', '..WWWCW...', '..WWCW....', '.WWCW.....', '.WCW......', '.C........', 'C.........'],
  heart: ['.RR....RR.', 'RWRR..RRRR', 'RWRRRRRRRR', 'RRRRRRRRRR', 'RRRRRRRRRR', '.RRRRRRRR.', '..RRRRRR..', '...RRRR...', '....RR....', '..........'],
  leaf: ['.......NNN', '.....NNNNN', '....NNNNNN', '...NNNNNNN', '..NNNNLNN.', '..NNNLNNN.', '.NNNLNNN..', '.NNLNN....', '.NL.......', 'L.........'],
  eye: ['..........', '...YYYY...', '..Y....Y..', '.Y..RR..Y.', 'Y..RWWR..Y', 'Y..RWWR..Y', '.Y..RR..Y.', '..Y....Y..', '...YYYY...', '..........'],
  skull: ['..WWWWWW..', '.WWWWWWWW.', 'WWWWWWWWWW', 'WW..WW..WW', 'WW..WW..WW', 'WWWWWWWWWW', '.WWW..WWW.', '..WWWWWW..', '..W.W.W.W.', '....R.R...'],
  pierce: ['..........', '......O...', '.......O..', 'OOOOOOOOO.', 'GGGGGGGGGO', 'OOOOOOOOO.', '.......O..', '......O...', '..........', '..........'],
  reach: ['.....CCC..', '.......CC.', '........C.', '.........C', '.........C', '.........C', '........C.', '.......CC.', '.....CCC..', '..........'],
  spin: ['...OOOO...', '..O....O..', '.O......O.', 'O...OO..O.', 'O..O..O...', 'O..O..O..O', '...O..O..O', '.O..OO..O.', '..O....O..', '...OOOO...'],
};
const RARITY = { '通用': 'r-gold', '站定流派': 'r-arcane', '翻滚流派': 'r-frost', '走位流派': 'r-moss', '职业专属': 'r-ember' };
const BLESSINGS = [
  { id: 'rate',   icon: 'fire',    name: '疾咏',   tag: '通用',     desc: '攻击速度提高 30%。', apply: m => { m.rateMul *= 1.3; } },
  { id: 'dmg',    icon: 'sword',   name: '圣铸',   tag: '通用',     desc: '攻击伤害提高（法师 +1，骑士 +2）。', apply: m => { m.dmgAdd += 1; } },
  { id: 'crit',   icon: 'eye',     name: '锐眼',   tag: '通用',     desc: '暴击率 +15%，暴击造成双倍伤害。', apply: m => { m.critAdd += 0.15; } },
  { id: 'tough',  icon: 'heart',   name: '坚韧',   tag: '通用',     desc: '生命上限 +2，并回满生命。', apply: (m, p) => { p.maxHp += 2; p.hp = p.maxHp; } },
  { id: 'leech',  icon: 'skull',   name: '噬魂',   tag: '通用',     once: true, desc: '每击杀 10 个敌人，恢复 1 点生命。', apply: m => { m.leech = true; } },
  { id: 'charge', icon: 'still',   name: '静谧',   tag: '站定流派', once: true, desc: '连续站定超过 1.2 秒后，攻击伤害翻倍。', apply: m => { m.charge = true; } },
  { id: 'shock',  icon: 'wave',    name: '落地震', tag: '翻滚流派', once: true, desc: '翻滚结束时释放冲击波，击退周围敌人并造成 2 点伤害。', apply: m => { m.rollShock = true; } },
  { id: 'nimble', icon: 'feather', name: '轻身',   tag: '翻滚流派', desc: '翻滚冷却缩短 30%。', apply: m => { m.rollCdMul *= 0.7; } },
  { id: 'regen',  icon: 'leaf',    name: '行者',   tag: '走位流派', once: true, desc: '移动时每 6 秒恢复 1 点生命。', apply: m => { m.regen = true; } },
  { id: 'split',  icon: 'split',   name: '三叉光', tag: '职业专属', cls: 'mage', desc: '每次额外射出 1 枚飞弹，呈扇形散开。', apply: m => { m.extraShots += 1; } },
  { id: 'pierce', icon: 'pierce',  name: '贯穿',   tag: '职业专属', cls: 'mage', desc: '飞弹可以多穿透 1 个敌人。', apply: m => { m.pierce += 1; } },
  { id: 'reach',  icon: 'reach',   name: '剑气',   tag: '职业专属', cls: 'knight', desc: '挥砍范围扩大 1.2 格。', apply: m => { m.reachAdd += 1.2; } },
  { id: 'whirl',  icon: 'spin',    name: '回旋斩', tag: '职业专属', cls: 'knight', once: true, desc: '每第 3 次挥砍变为 360° 回旋斩。', apply: m => { m.spinEvery = 3; } },
];
let offered = [];
let absorbing = false;
function showBlessings() {
  const pool = BLESSINGS.filter(b => !(b.once && mods.taken.includes(b.id)) && (!b.cls || b.cls === run.cls));
  offered = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  $('upEyebrow').textContent = room.plan.boss ? 'Boss Defeated' : 'Room Cleansed';
  $('cards').innerHTML = offered.map((b, i) => `
    <button class="card ${RARITY[b.tag]}" type="button" data-i="${i}">
      <div class="top">${pixSvg(ICON[b.icon], ICON_PAL, { outline: true, cls: 'icon' })}${isTouch ? '' : `<span class="key">${i + 1}</span>`}</div>
      <h3>${b.name}</h3><p>${b.desc}</p><span class="tag">${b.tag}</span>
    </button>`).join('');
  $('cards').querySelectorAll('.card').forEach(el => el.addEventListener('click', () => chooseBlessing(Number(el.dataset.i))));
  mode = 'upgrade';
  absorbing = false;
  $('upgrade').classList.remove('absorbing');
  $('upgrade').hidden = false;
  setTimeout(() => $('cards').querySelector('.card')?.focus({ preventScroll: true }), 50);
}
// 选中的卡片先闪亮收缩，化作一团光沿弧线飞向英雄，落地时光柱冲天
function chooseBlessing(i) {
  if (mode !== 'upgrade' || absorbing || !offered[i]) return;
  absorbing = true;
  const b = offered[i];
  const cards = [...$('cards').children];
  cards.forEach((c, j) => { c.classList.add(j === i ? 'chosen' : 'discard'); c.disabled = true; });
  $('upgrade').classList.add('absorbing');
  sfx.pick();
  const r = cards[i].getBoundingClientRect();
  const start = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  setTimeout(() => flySoul(start, b), 300);
}
function flySoul(start, b) {
  const layer = $('fly');
  const soul = document.createElement('div'); soul.className = 'soul'; layer.appendChild(soul);
  const end = screenOf(player.pos.x, 1.3, player.pos.z);
  const side = start.x < end.x ? -1 : 1;
  const ctrl = { x: (start.x + end.x) / 2 + side * Math.min(220, innerWidth * 0.25), y: Math.min(start.y, end.y) - Math.min(200, innerHeight * 0.25) };
  const dur = 720, t0 = performance.now();
  let lastTrail = 0;
  sfx.whoosh();
  const tick = now => {
    const k = clamp((now - t0) / dur, 0, 1), e = k * k;
    const x = (1 - e) ** 2 * start.x + 2 * (1 - e) * e * ctrl.x + e * e * end.x;
    const y = (1 - e) ** 2 * start.y + 2 * (1 - e) * e * ctrl.y + e * e * end.y;
    // 位置取整到 4px，保持像素感
    soul.style.transform = `translate(${Math.round(x / 4) * 4}px, ${Math.round(y / 4) * 4}px) rotate(45deg) scale(${(1 - 0.45 * e).toFixed(2)})`;
    if (now - lastTrail > 24) {
      lastTrail = now;
      const t = document.createElement('i'); t.className = 'trail';
      t.style.transform = `translate(${Math.round((x + rand(-6, 6)) / 4) * 4}px, ${Math.round((y + rand(-6, 6)) / 4) * 4}px)`;
      layer.appendChild(t); setTimeout(() => t.remove(), 520);
    }
    if (k < 1) requestAnimationFrame(tick);
    else { soul.remove(); absorbImpact(b); }
  };
  requestAnimationFrame(tick);
}
function absorbImpact(b) {
  b.apply(mods, player); mods.taken.push(b.id);
  renderHp();
  sfx.bless();
  const p = player.pos;
  beamFx(p.x, p.z);
  ringFx(p.x, p.z, 0xffd27a, 0.6, 7, 0.7, 1);
  ringFx(p.x, p.z, 0xfff2b0, 0.3, 4, 0.5, 0.8, RUNE);
  burst(p.x, 0.3, p.z, 0xffe9a8, 26, 3.2, 1.2, 0.32, 4);
  player.glow = 1;
  play(player.ch, 'Cheer', { loop: false, restart: true, fade: 0.1, timeScale: 1.5 });
  player.hitAnimUntil = T + 0.9;
  popup(b.name, p, 'big');
  setTimeout(() => {
    $('upgrade').hidden = true;
    $('upgrade').classList.remove('absorbing');
    absorbing = false;
    mode = 'play';
    toast(`获得祝福「<em>${b.name}</em>」· 北门已开启`);
  }, 1000);
}

// ---------- 关卡流程 ----------
let lastLayout = null;
function pickLayout() {
  const l = pick(LAYOUTS.filter(x => x !== lastLayout));
  lastLayout = l; return l;
}
// 计算下一间房：用哪个布局、什么色调、刷什么怪
function roomPlan() {
  if (run.mode === 'campaign') {
    const f = run.floor, k = run.room, boss = k === 2, fl = FLOORS[f], lvl = f * 3 + k;
    const layout = boss ? ARENA : pickLayout();
    return {
      theme: f, layout, boss: boss ? fl.boss : null, lvl,
      num: `${f + 1}-${k + 1}`, name: boss ? fl.arena : layout.name,
      eyebrow: `FLOOR ${f + 1} · ${boss ? 'BOSS' : 'ROOM ' + (k + 1)}`,
      sub: boss ? `击败${ENEMY[fl.boss].boss}` : k === 0 ? `第 ${f + 1} 层 · ${fl.name}` : '清除所有敌人，北门将会开启',
      waves: boss ? [{ [fl.boss]: 1 }] : genWaves(lvl, fl.pool, f === 0 ? 2 : 3),
      hpScale: 1 + lvl * 0.08, bossScale: 1, newFloor: k === 0 && f > 0,
    };
  }
  const d = run.depth, th = Math.floor((d - 1) / 5) % 3, boss = d % 5 === 0;
  const bossKey = BOSS_ORDER[(d / 5 - 1) % 3];
  const pool = d <= 3 ? FLOORS[0].pool : d <= 8 ? FLOORS[1].pool : FLOORS[2].pool;
  const layout = boss ? ARENA : pickLayout();
  return {
    theme: th, layout, boss: boss ? bossKey : null, lvl: d - 1,
    num: `深渊 ${d}`, name: boss ? '深渊首领' : layout.name,
    eyebrow: `DEPTH ${d}`, sub: boss ? `击败${ENEMY[bossKey].boss}` : d === 1 ? '一直往下走，看你能到第几层' : '清除所有敌人，北门将会开启',
    waves: boss ? [{ [bossKey]: 1 }] : genWaves(d - 1, pool, d > 6 ? 3 : 2),
    hpScale: 1 + (d - 1) * 0.1, bossScale: 1 + Math.floor((d - 5) / 5) * 0.45, newFloor: d > 1 && (d - 1) % 5 === 0,
  };
}
function startRun(m = selMode, cls = selHero) {
  sfx.init();
  for (const id of ['menu', 'select', 'over', 'pause', 'upgrade']) $(id).hidden = true;
  paused = false; hitstop = 0; slowmo = 0;
  clearCombat();
  disposePlayer();
  run = { mode: m, cls, floor: 0, room: 0, depth: 1 };
  player = newPlayer(cls);
  mods = { rateMul: 1, dmgAdd: 0, extraShots: 0, pierce: 0, charge: false, rollShock: false, rollCdMul: 1, regen: false,
    reachAdd: 0, spinEvery: 0, leech: false, critAdd: 0, taken: [] };
  stats = { kills: 0, dodges: 0 };
  T = 0;
  $('hud').hidden = false; $('touch').hidden = !isTouch;
  enterRoom(true);
  const atk = cls === 'knight' ? '站定挥剑' : '站定施法';
  toast(isTouch ? `左侧拖动移动 · 松手${atk} · 右下角翻滚` : `<em>WASD</em> 移动 · ${atk} · <em>空格</em> 翻滚`, 5200);
}
function clearCombat() {
  for (const e of enemies) scene.remove(e.ch.root);
  enemies = [];
  bolts.length = 0; shots.length = 0; parts.length = 0; fx.length = 0;
  fxG.clear();
}
function enterRoom(first = false) {
  clearCombat();
  const plan = roomPlan();
  applyTheme(plan.theme);
  buildRoom(plan.layout);
  room.plan = plan;
  player.pos.set(0, 0, room.hz - 2.5); player.face = Math.PI; player.still = 0; player.rolling = 0; player.swing = null;
  player.ch.root.visible = true;
  if (plan.newFloor) { player.hp = Math.min(player.maxHp, player.hp + 2); setTimeout(() => toast('篝火余温 · 恢复 <em>2</em> 点生命'), 1600); }
  $('roomNum').textContent = plan.num; $('roomName').textContent = plan.name;
  $('boss').hidden = true; $('foes').hidden = false;
  renderHp(); updateFoes();
  updateCamera(0, true);
  mode = 'play';
  const b = $('banner');
  $('bannerN').textContent = plan.eyebrow; $('bannerT').textContent = plan.name; $('bannerS').textContent = plan.sub;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  room.waitUntil = T + (first ? 1.6 : 1.3);
}
function nextRoom() {
  mode = 'transition';
  if (run.mode === 'campaign') { run.room++; if (run.room > 2) { run.room = 0; run.floor++; } }
  else run.depth++;
  $('fade').classList.add('on');
  setTimeout(() => { enterRoom(); $('fade').classList.remove('on'); }, 450);
}
function roomCleared() {
  room.cleared = true;
  openDoor();
  const plan = room.plan;
  if (run.mode === 'campaign' && plan.boss && run.floor === 2) { victory(); return; }
  const bless = run.mode === 'campaign' || plan.boss || run.depth % 3 === 0;
  if (bless) setTimeout(() => { if (mode === 'play') showBlessings(); }, 1000);
  else toast('北门已开启');
}
function victory() {
  mode = 'over-pending';
  play(player.ch, 'Cheer', { loop: true });
  const chest = place('chest', 0, 0, -2);
  const lid = chest.getObjectByName('chest_lid'); if (lid) lid.rotation.x = -1.1;
  burst(0, 1, -2, 0xffd27a, 26, 7, 1.2, 0.5);
  sfx.win();
  setTimeout(() => showOver(true), 2200);
}
function playerDied() {
  player.dead = true;
  player.swing = null;
  mode = 'over-pending';
  play(player.ch, 'Death_A', { loop: false, fade: 0.1 });
  for (const e of alive()) if (e.state !== 'spawn') { e.state = 'taunt'; play(e.ch, 'Taunt', { loop: true }); if (e.lane) { fxG.remove(e.lane); e.lane = null; } }
  sfx.lose();
  setTimeout(() => showOver(false), 1700);
}
function showOver(win) {
  mode = 'over';
  $('touch').hidden = true;
  const camp = run.mode === 'campaign';
  $('over').classList.toggle('dead', !win);
  if (camp) {
    let best = Number(store.get('bonecorr.best') || 0);
    if (win && (!best || T < best)) { best = T; store.set('bonecorr.best', String(T)); }
    $('overEyebrow').textContent = win ? 'Campaign Complete' : `Fallen on Floor ${run.floor + 1}`;
    $('overTitle').textContent = win ? '你走出了骸骨回廊' : `倒在了${room.plan.num} ${room.plan.name}`;
    $('stLabel1').textContent = '用时'; $('stMain').textContent = fmt(T);
    $('stLabel4').textContent = '最佳通关'; $('stBest').textContent = best ? fmt(best) : '—';
  } else {
    const reached = run.depth;
    const best = Math.max(Number(store.get('bonecorr.depth') || 0), reached);
    store.set('bonecorr.depth', String(best));
    $('overEyebrow').textContent = `Endless · ${fmt(T)}`;
    $('overTitle').textContent = `沉入深渊第 ${reached} 层`;
    $('stLabel1').textContent = '到达层数'; $('stMain').textContent = reached;
    $('stLabel4').textContent = '最深纪录'; $('stBest').textContent = best;
  }
  $('stKills').textContent = stats.kills;
  $('stDodge').textContent = stats.dodges;
  $('over').hidden = false;
  $('againBtn').focus({ preventScroll: true });
}
function toMenu() {
  for (const id of ['over', 'pause', 'upgrade', 'select']) $(id).hidden = true;
  $('hud').hidden = true; $('touch').hidden = true; paused = false;
  clearCombat();
  run = null;
  applyTheme(0);
  buildRoom(LAYOUTS[0]);
  setMenuHero(selHero);
  mode = 'menu';
  renderRecords();
  $('menu').hidden = false;
}
function setMenuHero(key) {
  disposePlayer();
  player = newPlayer(key); player.pos.set(1, 0, 2); player.face = 0.5;
}
function renderRecords() {
  const best = Number(store.get('bonecorr.best') || 0), depth = Number(store.get('bonecorr.depth') || 0);
  const rec = [];
  if (best) rec.push(`<span>战役最佳</span> ${fmt(best)}`);
  if (depth) rec.push(`<span>深渊最深</span> 第 ${depth} 层`);
  $('records').innerHTML = rec.join('　');
}
let toastTimer = 0;
function toast(html, ms = 3200) {
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- 英雄选择 ----------
function openSelect(m) {
  selMode = m;
  $('menu').hidden = true;
  $('selEyebrow').textContent = m === 'campaign' ? 'Campaign · 三层地牢' : 'Endless Abyss · 无尽深渊';
  $('heroes').innerHTML = Object.entries(CLASSES).map(([k, c], i) => `
    <button class="hero ${c.rarity}${k === selHero ? ' sel' : ''}" type="button" data-k="${k}">
      <div class="head">${pixSvg(c.icon, ROLE_PAL, { outline: true })}<h3>${c.name}</h3>${isTouch ? '' : `<span class="key" style="margin-left:auto;color:var(--rc);background:#000;padding:0 6px;line-height:20px">${i + 1}</span>`}</div>
      <span class="role">${c.role}</span>
      <p>${c.desc}</p>
      <div class="bars">${Object.entries(c.stats).map(([n, v]) => `<div class="bar-row"><span>${n}</span><span class="pips">${'<i class="on"></i>'.repeat(v)}${'<i></i>'.repeat(5 - v)}</span></div>`).join('')}</div>
    </button>`).join('');
  $('heroes').querySelectorAll('.hero').forEach(el => {
    el.addEventListener('click', () => { if (el.dataset.k === selHero) startRun(selMode, selHero); else chooseHero(el.dataset.k); });
  });
  mode = 'select';
  $('select').hidden = false;
  setTimeout(() => $('goBtn').focus({ preventScroll: true }), 50);
}
function chooseHero(k) {
  if (!CLASSES[k] || k === selHero) return;
  selHero = k; store.set('bonecorr.hero', k);
  $('heroes').querySelectorAll('.hero').forEach(el => el.classList.toggle('sel', el.dataset.k === k));
  setMenuHero(k);
  play(player.ch, 'Cheer', { loop: false, restart: true, timeScale: 1.3 });
  sfx.init(); sfx.pick();
}

// ---------- 战斗规则 ----------
function nearestEnemy(range) {
  let best = null, bd = range * range;
  for (const e of enemies) {
    if (!targetable(e)) continue;
    const d = (e.pos.x - player.pos.x) ** 2 + (e.pos.z - player.pos.z) ** 2 - e.r * e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function tryRoll() {
  const p = player;
  if (mode !== 'play' || paused || !p || p.dead || p.rolling > 0 || T < p.rollReadyAt) return;
  const dir = inputDir();
  const d = dir ? { x: dir.x, z: dir.z } : { x: Math.sin(p.face), z: Math.cos(p.face) };
  const r = p.cls.roll;
  p.swing = null;
  p.rollDir = d; p.rolling = r.dur; p.face = Math.atan2(d.x, d.z);
  p.rollTotal = r.dur + r.cd * mods.rollCdMul * cfg.rollCdMul;
  p.rollReadyAt = T + p.rollTotal;
  play(p.ch, 'Dodge_Forward', { loop: false, restart: true, fade: 0.05, timeScale: clipLen(p.ch, 'Dodge_Forward') / (r.dur + 0.1) });
  burst(p.pos.x, 0.3, p.pos.z, 0x9b8f80, 6, 3, 0.4, 0.5, 0);
  sfx.roll();
}
function hurtPlayer(src) {
  const p = player;
  if (p.dead || mode !== 'play') return false;
  if (p.rolling > 0) { stats.dodges++; popup('闪避', p.pos); sfx.dodge(); return false; }
  if (T < p.invulnUntil) return false;
  p.hp--; p.invulnUntil = T + 0.9;
  shakeAdd(0.45); freeze(0.06);
  const h = $('hurt'); h.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
  $('hp').classList.remove('hit'); void $('hp').offsetWidth; $('hp').classList.add('hit');
  renderHp(); sfx.hurt();
  burst(p.pos.x, 1.2, p.pos.z, 0xff4a4a, 10, 5, 0.4, 0.4);
  if (!p.swing && p.rolling <= 0) { play(p.ch, 'Hit_A', { loop: false, restart: true, fade: 0.05, timeScale: 1.6 }); p.hitAnimUntil = T + 0.35; }
  if (p.hp <= 0) playerDied();
  return true;
}
// 判断攻击是否来自敌人正面（持盾骷髅格挡用）；vx, vz 指向攻击者
function fromFront(e, vx, vz) {
  const l = Math.hypot(vx, vz) || 1;
  return (vx * Math.sin(e.face) + vz * Math.cos(e.face)) / l > Math.cos(1.25);
}
function damageEnemy(e, base, dx, dz, { melee = false } = {}) {
  if (!targetable(e)) return false;
  if (!melee && e.guard && fromFront(e, -dx, -dz)) {
    // 远程打在骨盾上：被弹开
    impactFx(e.pos.x + Math.sin(e.face) * (e.r + 0.4), 1.3, e.pos.z + Math.cos(e.face) * (e.r + 0.4), 0x7fd0ff);
    if (e.shield) e.shield.material.opacity = 1;
    dmgNum(e, '格挡', 'block'); sfx.clank();
    return 'blocked';
  }
  let breakGuard = false;
  if (melee && e.guard) { e.guard = false; e.guardBreakUntil = T + 1.8; breakGuard = true; }
  const crit = Math.random() < 0.08 + mods.critAdd;
  const dmg = Math.max(1, Math.round(base * (crit ? 2 : 1)));
  e.hp -= dmg;
  flash(e.ch, T, e.boss ? 0.4 : 0.95);
  e.punch = 1;
  const k = e.boss ? 0.8 : melee ? 8 : 4.5;
  e.kx += dx * k; e.kz += dz * k;
  if (!e.boss && ['chase', 'keep', 'recover'].includes(e.state)) {
    e.staggerUntil = T + (melee ? 0.32 : 0.18);
    play(e.ch, 'Hit_A', { loop: false, restart: true, fade: 0.04, timeScale: 2 });
  }
  const hy = 1.3 * e.scale + e.y;
  dmgNum(e, dmg, crit ? 'crit' : '');
  impactFx(e.pos.x - dx * e.r * 0.6, hy, e.pos.z - dz * e.r * 0.6, crit ? 0xfff2b0 : melee ? 0xc8f1ff : 0xd8b8ff, crit);
  burst(e.pos.x, hy, e.pos.z, crit ? 0xfff2b0 : 0xe8dcc4, crit ? 12 : 6, crit ? 7 : 5, 0.32, 0.3);
  if (crit) { sfx.crit(); freeze(0.09); shakeAdd(0.25); }
  else { sfx.hit(); freeze(melee ? 0.055 : 0.03); shakeAdd(melee ? 0.14 : 0.07); }
  if (breakGuard) { popup('破盾', e.pos); sfx.clank(); }
  if (e.boss) updateBoss();
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function cleanupEnemyFx(e) {
  for (const k of ['rune', 'lane', 'orb', 'shield', 'marker']) if (e[k]) { fxG.remove(e[k]); e[k] = null; }
}
function killEnemy(e) {
  e.state = 'dead'; e.t = 0; e.y = 0;
  cleanupEnemyFx(e);
  play(e.ch, 'Death_C_Skeletons', { loop: false, fade: 0.1 });
  burst(e.pos.x, 1, e.pos.z, 0xe8dcc4, e.boss ? 34 : 14, e.boss ? 8 : 6, 0.65, 0.38);
  ringFx(e.pos.x, e.pos.z, 0xe8dcc4, 0.5, e.boss ? 8 : 3, 0.35, 0.7);
  stats.kills++;
  sfx.bones();
  freeze(e.boss ? 0.2 : 0.07); shakeAdd(e.boss ? 0.6 : 0.16);
  if (mods && mods.leech && ++player.leech >= 10) { player.leech = 0; if (player.hp < player.maxHp) { player.hp++; renderHp(); popup('+1', player.pos); } }
  updateFoes();
  if (e.boss) { $('bossFill').style.width = '0%'; for (const o of alive()) killEnemy(o); slowmo = 1.1; }
  else if (alive().length === 0) slowmo = 0.5;   // 每波最后一只：短暂慢动作
}
function shockwave() {
  const p = player.pos;
  ringFx(p.x, p.z, 0xffd27a, 1, 8, 0.4);
  for (const e of enemies) {
    if (!targetable(e)) continue;
    const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d < 3.6) damageEnemy(e, 2 * cfg.dmgMul, dx / (d || 1), dz / (d || 1), { melee: true });
  }
}

// ---------- 骑士近战 ----------
const reachOf = p => p.cls.reach + mods.reachAdd;
function startSwing() {
  const p = player, c = p.cls;
  const dur = 1 / (c.swingRate * mods.rateMul * cfg.atkMul);
  p.swings++;
  const spin = mods.spinEvery > 0 && p.swings % mods.spinEvery === 0;
  p.swing = { t: 0, dur, hitAt: Math.max(0.08, dur * 0.3), hitDone: false, spin };
  const anim = p.swings % 2 ? '1H_Melee_Attack_Slice_Horizontal' : '1H_Melee_Attack_Slice_Diagonal';
  play(p.ch, anim, { loop: false, restart: true, fade: 0.05, timeScale: clipLen(p.ch, anim) / (dur * 1.05) });
  p.nextShot = T + dur;
}
function meleeHit(spin) {
  const p = player, c = p.cls, reach = reachOf(p);
  const fx = Math.sin(p.face), fz = Math.cos(p.face);
  const charged = mods.charge && p.still > 1.2;
  const dmg = (c.damage + mods.dmgAdd * 2) * cfg.dmgMul * (charged ? 2 : 1) * (spin ? 1.3 : 1);
  slashFx(p.pos, p.face, reach, spin);
  sfx.slash();
  const inArc = (dx, dz, d) => spin || d < 0.6 || (dx * fx + dz * fz) / d > Math.cos(1.25);
  for (const e of enemies) {
    if (!targetable(e)) continue;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > reach + e.r || !inArc(dx, dz, d)) continue;
    damageEnemy(e, dmg, dx / (d || 1), dz / (d || 1), { melee: true });
  }
  // 剑光斩碎飞来的弹幕
  let cut = 0;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i], dx = s.x - p.pos.x, dz = s.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < reach + 0.7 && inArc(dx, dz, d)) { burst(s.x, 1.15, s.z, 0xc8f1ff, 4, 4, 0.25, 0.3); removeAt(shots, i); cut++; }
  }
  if (cut) { stats.dodges += cut; popup('格挡', p.pos); sfx.clank(); freeze(0.04); }
}

// ---------- 每帧更新：英雄 ----------
const keys = new Set();
const joy = { id: null, ox: 0, oy: 0, vx: 0, vy: 0 };
function inputDir() {
  let x = 0, z = 0;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z--;
  if (joy.id !== null && (joy.vx || joy.vy)) { x = joy.vx; z = joy.vy; }
  const l = Math.hypot(x, z);
  return l > 0.12 ? { x: x / l, z: z / l, m: Math.min(1, l) } : null;
}
function updatePlayer(dt) {
  const p = player, c = p.cls;
  if (p.dead) return;
  const dir = inputDir();
  if (p.rolling > 0) {
    const sp = c.roll.speed * cfg.rollDistMul;
    p.rolling -= dt;
    p.pos.x += p.rollDir.x * sp * dt; p.pos.z += p.rollDir.z * sp * dt;
    p.moving = true; p.still = 0;
    if (Math.random() < 0.5) dot(p.pos.x, 0.3, p.pos.z, 0x9b8f80, 0.6, 0.3);
    if (p.rolling <= 0) { p.rolling = 0; if (mods.rollShock) shockwave(); }
  } else if (dir) {
    p.swing = null; // 移动会打断挥砍
    const s = c.speed * cfg.moveMul * dir.m;
    p.pos.x += dir.x * s * dt; p.pos.z += dir.z * s * dt;
    p.face = lerpAngle(p.face, Math.atan2(dir.x, dir.z), Math.min(1, dt * 14));
    p.moving = true; p.still = 0;
    play(p.ch, 'Running_A', { timeScale: (c.speed * cfg.moveMul) / 6.5 });
    if (mods.regen && p.hp < p.maxHp) { p.regen += dt; if (p.regen >= 6) { p.regen = 0; p.hp++; renderHp(); popup('+1', p.pos); } }
  } else {
    p.moving = false; p.still += dt;
  }
  collide(p.pos, 0.55, true);
  if (room.doorOpen && p.pos.z < room.bounds.minZ - 1 && mode === 'play') nextRoom();

  if (p.swing) {
    const s = p.swing; s.t += dt;
    if (!s.hitDone && s.t >= s.hitAt) { s.hitDone = true; meleeHit(s.spin); }
    if (s.t >= s.dur) p.swing = null;
  } else if (!p.moving) attackLogic(dt);

  const r = p.ch.root;
  r.position.copy(p.pos); r.rotation.y = p.face;
  r.visible = !(T < p.invulnUntil && p.rolling <= 0 && Math.floor(T * 16) % 2);

  const charge = cfg.fireDelay > 0 ? Math.min(1, p.still / cfg.fireDelay) : 1;
  drawCharge(charge, p.moving);
  p.ring.position.set(p.pos.x, 0.1, p.pos.z);
  const ready = !p.moving && charge >= 1;
  const reach = c.attack === 'melee' ? reachOf(p) : c.range;
  p.range.position.set(p.pos.x, 0.09, p.pos.z);
  p.range.scale.set(reach * 2, reach * 2, 1);
  p.range.material.opacity += ((ready ? (c.attack === 'melee' ? 0.3 : 0.16) : 0) - p.range.material.opacity) * Math.min(1, dt * 8);
}
function attackLogic(dt) {
  const p = player, c = p.cls;
  const idle = () => { if (T >= p.hitAnimUntil) play(p.ch, 'Idle'); };
  if (c.attack === 'ranged') {
    const tgt = nearestEnemy(c.range);
    if (!tgt) return idle();
    p.face = lerpAngle(p.face, Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z), Math.min(1, dt * 18));
    if (T >= p.hitAnimUntil) play(p.ch, 'Spellcasting', { timeScale: 1.2 });
    if (p.still >= cfg.fireDelay && T >= p.nextShot) { fireBolts(tgt); p.nextShot = T + 1 / (c.fireRate * mods.rateMul * cfg.atkMul); }
  } else {
    const reach = reachOf(p);
    const tgt = nearestEnemy(reach + 5);
    if (!tgt) return idle();
    p.face = lerpAngle(p.face, Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z), Math.min(1, dt * 20));
    const d = Math.hypot(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z);
    if (d <= reach + tgt.r && p.still >= cfg.fireDelay && T >= p.nextShot) startSwing();
    else idle();
  }
}

// ---------- 每帧更新：敌人 ----------
function updateEnemy(e, dt) {
  const p = player.pos;
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
  if (e.state === 'taunt' || player.dead) return;
  if (T < e.staggerUntil) return;   // 受击硬直
  switch (e.kind) {
    case 'minion': return updateMinion(e, dt, d, toward, move);
    case 'mage': return updateMage(e, dt, d, toward, move);
    case 'rogue': return updateRogue(e, dt, d, toward, move);
    case 'warrior': return updateWarrior(e, dt, d, toward, move);
    case 'guardian': return updateGuardian(e, dt, d, toward, move);
    case 'warlord': return updateWarlord(e, dt, d, toward, move);
    case 'archlich': return updateArchlich(e, dt, d, toward, move);
  }
}
function updateMinion(e, dt, d, toward, move) {
  if (e.state === 'chase' || e.state === 'recover') {
    e.state = 'chase';
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 8));
    if (d > 1.55) { move(e.face, cfg.enemySpeed); play(e.ch, 'Walking_D_Skeletons', { timeScale: cfg.enemySpeed / 2.2 }); }
    else if (T >= e.cd) { e.state = 'windup'; e.t = 0; e.hitDone = false; play(e.ch, '1H_Melee_Attack_Chop', { loop: false, restart: true, timeScale: 1.07 / 0.95 }); }
    else play(e.ch, 'Idle_Combat');
  } else if (e.state === 'windup') {
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 4));
    if (!e.hitDone && e.t >= 0.5) { e.hitDone = true; if (d < 2.1) hurtPlayer(e); }
    if (e.t >= 0.95) { e.state = 'chase'; e.t = 0; e.cd = T + 0.8; }
  }
}
function updateMage(e, dt, d, toward, move) {
  if (e.state === 'keep' || e.state === 'recover') {
    e.state = 'keep';
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 6));
    const ang = d < 6.5 ? toward + Math.PI : d > 11 ? toward : toward + (Math.PI / 2) * e.strafe;
    const s = d < 6.5 || d > 11 ? cfg.enemySpeed * 0.85 : cfg.enemySpeed * 0.4;
    move(ang, s);
    play(e.ch, 'Walking_A', { timeScale: s / 2 + 0.3 });
    if (T >= e.cd && d < 17) {
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
      e.state = 'keep'; e.t = 0; e.cd = T + rand(2, 2.9); if (Math.random() < 0.4) e.strafe *= -1;
    }
  }
}
// 骷髅刺客：绕圈游走，瞄准（地面红线预警）后高速突刺
function updateRogue(e, dt, d, toward, move) {
  if (e.state === 'chase' || e.state === 'recover' && e.t >= 0.75) {
    if (e.state === 'recover') { e.state = 'chase'; e.cd = T + rand(1.6, 2.6); e.strafe *= -1; }
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 8));
    const ang = d > 6.5 ? toward : d < 4.5 ? toward + Math.PI : toward + (Math.PI / 2) * e.strafe;
    move(ang, cfg.enemySpeed * 1.25);
    play(e.ch, 'Running_C', { timeScale: 1.1 });
    if (T >= e.cd && d < 9.5) {
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
    if (!e.hitDone && d < e.r + 0.7) { e.hitDone = true; hurtPlayer(e); }
    if (e.t >= 0.42) { e.state = 'recover'; e.t = 0; play(e.ch, 'Idle_Combat'); }
  }
}
// 持盾骷髅：举着骨盾慢慢逼近，正面挡下远程攻击；挥砍时露出破绽；近战可以破盾
function updateWarrior(e, dt, d, toward, move) {
  const broken = T < e.guardBreakUntil;
  if (e.state === 'chase' || e.state === 'recover') {
    e.state = 'chase';
    e.guard = !broken;
    // 转身较慢，法师可以翻滚绕到侧后方
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * (broken ? 1.5 : 2.5)));
    if (d > 1.9) { move(e.face, cfg.enemySpeed * (broken ? 0.3 : 0.6)); play(e.ch, 'Walking_D_Skeletons', { timeScale: 0.8 }); }
    else if (T >= e.cd && !broken) { e.state = 'windup'; e.t = 0; e.hitDone = false; e.guard = false; play(e.ch, '1H_Melee_Attack_Chop', { loop: false, restart: true, timeScale: 1.07 / 0.9 }); }
    else play(e.ch, broken ? 'Hit_A' : 'Blocking');
  } else if (e.state === 'windup') {
    e.guard = false;
    e.face = lerpAngle(e.face, toward, Math.min(1, dt * 3));
    if (!e.hitDone && e.t >= 0.55) { e.hitDone = true; if (d < 2.4) hurtPlayer(e); }
    if (e.t >= 0.9) { e.state = 'chase'; e.t = 0; e.cd = T + 1.3; }
  }
}
// 首领一：骸骨守卫——圆环弹幕 + 冲锋，掉血后召唤援军
function updateGuardian(e, dt, d, toward, move) {
  const phase2 = e.hp < e.maxHp * 0.5;
  for (const [th, adds, n] of [[0.66, { minion: 3 }, 1], [0.33, { minion: 2, rogue: 1, mage: 1 }, 2]]) {
    if (e.hp < e.maxHp * th && e.summoned < n) {
      e.summoned = n;
      for (const k of Object.keys(adds)) for (let i = 0; i < adds[k]; i++) { const [x, z] = spawnPoint(5); spawnEnemy(k, x, z); }
      toast('骸骨守卫召唤了援军', 2200);
    }
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
      if (phase2) setTimeout(() => { if (targetable(e) && mode === 'play') { for (let i = 0; i < n; i++) fireShot(e.pos.x, e.pos.z, off + ((i + 0.5) / n) * Math.PI * 2, cfg.bulletSpeed * 0.85, 0xff6a5a); sfx.enemyShot(); } }, 380);
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
    if (!e.hitDone && d < e.r + 0.7) { e.hitDone = true; hurtPlayer(e); }
    const stuck = e.pos.distanceTo(before) < 14 * dt * 0.5;
    if (e.t > 0.85 || stuck) { e.state = 'chase'; e.t = 0; if (stuck) { shakeAdd(0.3); burst(e.pos.x, 0.5, e.pos.z, 0x9b8f80, 10, 4, 0.5, 0.6); } }
  }
}
// 首领二：骸骨战将——举盾逼近、跃起重砸（落点红圈预警 + 冲击弹幕）、旋风斩
function startLeap(e) {
  const b = room.bounds;
  e.state = 'leap'; e.t = 0; e.landed = false; e.guard = false;
  e.lx0 = e.pos.x; e.lz0 = e.pos.z;
  e.lx1 = clamp(player.pos.x, b.minX + 2, b.maxX - 2); e.lz1 = clamp(player.pos.z, b.minZ + 2, b.maxZ - 2);
  e.marker = floorDecal(DISC, 0xff4a2a, 6.4, 0.6); e.marker.position.set(e.lx1, 0.11, e.lz1); fxG.add(e.marker);
  play(e.ch, '1H_Melee_Attack_Jump_Chop', { loop: false, restart: true, timeScale: 1.33 / 1.15 });
}
function updateWarlord(e, dt, d, toward, move) {
  const phase2 = e.hp < e.maxHp * 0.5;
  if (phase2 && !e.summoned) {
    e.summoned = 1;
    for (let i = 0; i < 2; i++) { const [x, z] = spawnPoint(6); spawnEnemy('warrior', x, z); }
    toast('骸骨战将召来了盾卫', 2200);
  }
  const broken = T < e.guardBreakUntil;
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
      if (Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 3.2) hurtPlayer(e);
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
    if (d < e.r + 1.4 && T >= e.spinHit) { e.spinHit = T + 0.5; hurtPlayer(e); }
    if (e.t >= (phase2 ? 3.2 : 2.6)) { e.state = 'chase'; e.t = 0; play(e.ch, 'Idle_Combat'); }
  }
}
// 首领三：骸骨大巫——保持距离、瞬移、螺旋弹幕、扇形连发、召唤
function updateArchlich(e, dt, d, toward, move) {
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
    if (T >= (e.nextBullet || 0)) {
      e.nextBullet = T + 0.11;
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
    if (!e.fired && e.t >= 0.8) {
      e.fired = 1;
      const adds = phase2 ? { minion: 2, rogue: 2 } : { minion: 2, rogue: 1 };
      for (const k of Object.keys(adds)) for (let i = 0; i < adds[k]; i++) { const [x, z] = spawnPoint(5); spawnEnemy(k, x, z); }
    }
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
function separate() {
  const live = enemies.filter(e => e.state !== 'dead' && e.y <= 0);
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

function tickCombat(dt) {
  T += dt;
  updatePlayer(dt);
  if (mode !== 'play' && mode !== 'over-pending') return;

  // 波次
  if (!room.cleared && alive().length === 0 && mode === 'play') {
    if (room.waveIdx + 1 < room.plan.waves.length) {
      if (room.waitUntil === null) room.waitUntil = T + 1;
      if (T >= room.waitUntil) { room.waitUntil = null; spawnWave(room.plan.waves[++room.waveIdx]); updateFoes(); }
    } else roomCleared();
  }

  for (const e of enemies) {
    updateEnemy(e, dt);
    if (e.state !== 'dead' && e.state !== 'spawn') {
      e.pos.x += e.kx * dt; e.pos.z += e.kz * dt;
      const decay = Math.exp(-9 * dt); e.kx *= decay; e.kz *= decay;
      if (e.y <= 0) collide(e.pos, e.r, false);
    }
    unflash(e.ch, T);
    if (e.state !== 'dead') {
      const r = e.ch.root;
      r.position.set(e.pos.x, e.y, e.pos.z);
      // 受击时的挤压回弹
      if (e.punch > 0 && e.state !== 'teleport') {
        e.punch = Math.max(0, e.punch - dt * 7);
        const k = e.punch;
        r.scale.set(e.scale * (1 + 0.16 * k), e.scale * (1 - 0.14 * k), e.scale * (1 + 0.16 * k));
      }
      if (e.shield) {
        e.shield.position.set(e.pos.x, 0.13, e.pos.z);
        e.shield.rotation.z = faceToZ(e.face);
        e.shield.material.opacity += ((e.guard ? 0.7 : 0) - e.shield.material.opacity) * Math.min(1, dt * 10);
      }
    }
    e.ch.root.rotation.y = e.face;
  }
  enemies = enemies.filter(e => !e.gone);
  separate();

  // 法师飞弹
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
    b.s.position.set(b.x, 1.45, b.z); b.core.position.copy(b.s.position);
    dot(b.x, 1.45, b.z, b.color, 0.55, 0.14);
    if (b.life <= 0 || outside(b.x, b.z) || blocked(b.x, b.z)) { burst(b.x, 1.45, b.z, b.color, 4, 3, 0.2, 0.25); removeAt(bolts, i); continue; }
    for (const e of enemies) {
      if (!targetable(e) || b.hit.has(e)) continue;
      if (Math.hypot(e.pos.x - b.x, e.pos.z - b.z) < e.r + 0.3) {
        const l = Math.hypot(b.vx, b.vz);
        const res = damageEnemy(e, b.dmg, b.vx / l, b.vz / l);
        b.hit.add(e);
        if (res === 'blocked' || b.pierce-- <= 0) { removeAt(bolts, i); }
        break;
      }
    }
  }
  // 敌方弹幕
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
    s.s.position.set(s.x, 1.15, s.z); s.core.position.copy(s.s.position);
    if (s.life <= 0 || outside(s.x, s.z) || blocked(s.x, s.z)) { burst(s.x, 1.15, s.z, s.color, 3, 3, 0.25, 0.3); removeAt(shots, i); continue; }
    if (!player.dead && Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 0.75) {
      if (player.rolling > 0) { if (!s.dodged) { s.dodged = true; hurtPlayer(s); } }
      else if (hurtPlayer(s)) removeAt(shots, i);
    }
  }
}

function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { fxG.remove(p.s); parts.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.s.position.x += p.vx * dt; p.s.position.y = Math.max(0.1, p.s.position.y + p.vy * dt); p.s.position.z += p.vz * dt;
    p.s.scale.setScalar(p.size * (p.life / p.max));
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    if (f.upd) f.upd(k);
    else {
      const s = f.from + (f.to - f.from) * (1 - (1 - k) ** 3);
      f.m.scale.set(s, s, 1); f.m.material.opacity = f.opacity * (1 - k);
    }
    if (k >= 1) { fxG.remove(f.m); fx.splice(i, 1); }
  }
  if (room) {
    for (const t of room.torches) {
      const n = Math.sin(performance.now() / 90 + t.seed) * 0.5 + Math.sin(performance.now() / 37 + t.seed * 3) * 0.3;
      t.light.intensity = 22 + n * 5; t.flame.scale.set(1.25 + n * 0.12, 1.55 + n * 0.2, 1);
    }
    if (room.doorOpen && room.door && room.doorT < 1) { room.doorT = Math.min(1, room.doorT + dt * 0.9); room.door.rotation.y = -1.75 * (1 - (1 - room.doorT) ** 3); }
    if (room.beacon) { const k = 0.75 + Math.sin(performance.now() / 260) * 0.25; room.beacon.beacon.material.opacity = k; room.beacon.arrow.material.opacity = 0.25 + 0.3 * k; }
  }
  heroPulse = Math.max(0, heroPulse - dt * 8);
  heroLight.intensity = 16 + heroPulse * 26;
}

function updateCamera(dt, snap = false) {
  const aspect = innerWidth / innerHeight;
  const k = aspect < 0.75 ? 1.5 : aspect < 1.1 ? 1.22 : 1;
  if (mode === 'menu' || mode === 'select') {
    // 英雄放在画面右侧三分之一，镜头缓慢摆动
    const a = 0.45 + Math.sin(performance.now() / 5200) * 0.28;
    const kp = player.pos, side = aspect < 1 ? 0 : 2.6;
    camera.position.set(kp.x + Math.sin(a) * 7.5, 3.6, kp.z + Math.cos(a) * 7.5);
    if (aspect < 1) camera.lookAt(kp.x + Math.sin(a) * 1.5, 0.2, kp.z + Math.cos(a) * 1.5); // 竖屏：英雄在上半屏
    else camera.lookAt(kp.x - Math.cos(a) * side, 1.3, kp.z + Math.sin(a) * side);
    moon.position.set(-10, 24, 8); moon.target.position.set(0, 0, 0);
    heroLight.position.set(player.pos.x, 2.6, player.pos.z + 0.8);
    return;
  }
  camOff.set(0, 17 * k, 12.5 * k);
  const b = room.bounds;
  // 镜头中心不越过房间南缘太多，避免画面下方露出大片虚空
  const tx = clamp(player.pos.x, b.minX + 5, b.maxX - 5), tz = clamp(player.pos.z, b.minZ + 3, Math.max(b.minZ + 3, b.maxZ - 5.5 * k));
  if (snap) camTarget.set(tx, 0, tz);
  else { const f = 1 - Math.exp(-dt * 6); camTarget.x += (tx - camTarget.x) * f; camTarget.z += (tz - camTarget.z) * f; }
  camera.position.copy(camTarget).add(camOff);
  if (shake > 0) { camera.position.x += rand(-1, 1) * shake * 0.6; camera.position.y += rand(-1, 1) * shake * 0.4; shake = Math.max(0, shake - dt * 2); }
  camera.lookAt(camTarget.x, 0.8, camTarget.z - 0.5);
  moon.position.set(camTarget.x - 10, 24, camTarget.z + 8); moon.target.position.copy(camTarget);
  heroLight.position.set(player.pos.x, 2.6, player.pos.z + 0.8);
}

// ---------- HUD ----------
function renderHp() {
  if (!player) return;
  $('hp').innerHTML = Array.from({ length: player.maxHp }, (_, i) => (i < player.hp ? HEART_FULL : HEART_EMPTY)).join('');
}
function updateFoes() { $('foeN').textContent = alive().length; }
function updateBoss() { const e = enemies.find(x => x.boss && x.state !== 'dead'); if (e) $('bossFill').style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%'; }
let lastClock = '', lastSegs = -1;
const rollSegs = [...document.querySelectorAll('#rollPip .segs i')];
function updateHud() {
  if (!player || !run) return;
  const p = clamp(1 - (player.rollReadyAt - T) / player.rollTotal, 0, 1);
  const ready = p >= 1 && player.rolling <= 0;
  const segs = ready ? 5 : Math.floor(p * 5);
  if (segs !== lastSegs) { lastSegs = segs; rollSegs.forEach((s, i) => s.classList.toggle('on', i < segs)); }
  $('rollPip').classList.toggle('ready', ready);
  const btn = $('rollBtn'); btn.style.setProperty('--p', (Math.floor(p * 8) / 8).toFixed(3)); btn.classList.toggle('ready', ready);
  const c = fmt(T); if (c !== lastClock) { $('clock').textContent = c; lastClock = c; }
  $('foeN').textContent = alive().length;
}

// ---------- 主循环 ----------
let last = performance.now();
function step(dt) {
  // 顿帧：战斗时间暂停；慢动作：战斗时间变慢。特效和镜头照常
  let sim = dt;
  if (hitstop > 0) { hitstop -= dt; sim = 0; }
  else if (slowmo > 0) { slowmo -= dt; sim = dt * 0.3; }
  if (mode === 'menu' || mode === 'select') {
    player.ch.mixer.update(dt);
    player.ch.root.position.copy(player.pos); player.ch.root.rotation.y = player.face;
    player.ring.visible = false; player.range.visible = false;
  } else if (player && !paused && (mode === 'play' || mode === 'over-pending')) {
    player.ring.visible = !player.dead; player.range.visible = !player.dead;
    if (sim > 0) {
      tickCombat(sim);
      player.ch.mixer.update(sim);
      for (const e of enemies) e.ch.mixer.update(sim);
    }
  } else if (player && mode === 'over') {
    player.ch.mixer.update(dt);
    for (const e of enemies) e.ch.mixer.update(dt);
  } else if (player && mode === 'upgrade') {
    player.ch.mixer.update(dt); // 选祝福时战斗暂停，但英雄的动作和光效照常播放
  }
  if (player && player.glow > 0) {
    player.glow = Math.max(0, player.glow - dt * 0.9);
    for (const m of player.ch.mats) {
      if (player.glow > 0) { m.emissive.setRGB(1, 0.78, 0.32); m.emissiveIntensity = player.glow * 1.1; }
      else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
    }
  }
  if (!paused) updateFx(sim > 0 ? sim : dt * 0.15);
  if (player && room) updateCamera(dt);
  updateHud();
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- 输入 ----------
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) { if (e.code === 'Escape') closeTuner(); return; }
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyT') { toggleTuner(); return; }
  if (!$('tuner').hidden) { if (e.code === 'Escape') closeTuner(); return; }
  if (mode === 'play') {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); tryRoll(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  } else if (mode === 'upgrade') {
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (n >= 0) chooseBlessing(n);
  } else if (mode === 'select') {
    if (e.code === 'Digit1' || e.code === 'ArrowLeft') chooseHero('mage');
    if (e.code === 'Digit2' || e.code === 'ArrowRight') chooseHero('knight');
    if (e.code === 'Escape') toMenu();
  } else if (mode === 'over' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); startRun(run.mode, run.cls); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (mode === 'play' && !paused) togglePause(); });

const stageEl = $('stage'), joyEl = $('joy'), knob = joyEl.querySelector('i');
stageEl.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || mode !== 'play' || paused || joy.id !== null) return;
  joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.vx = joy.vy = 0;
  joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.add('on');
  knob.style.transform = '';
  try { stageEl.setPointerCapture(e.pointerId); } catch (err) {}
});
stageEl.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.hypot(dx, dy), R = 60;
  if (d < 8) { joy.vx = joy.vy = 0; knob.style.transform = ''; return; }
  const m = Math.min(d, R) / R;
  joy.vx = (dx / d) * m; joy.vy = (dy / d) * m;
  knob.style.transform = `translate(${Math.round(joy.vx * R / 4) * 4}px, ${Math.round(joy.vy * R / 4) * 4}px)`;
});
const endJoy = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.vx = joy.vy = 0; joyEl.classList.remove('on'); };
stageEl.addEventListener('pointerup', endJoy);
stageEl.addEventListener('pointercancel', endJoy);
$('rollBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tryRoll(); });

function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  $('pause').hidden = !paused;
  if (paused) { joy.id = null; joyEl.classList.remove('on'); keys.clear(); $('resumeBtn').focus({ preventScroll: true }); }
}
$('pauseBtn').innerHTML = PAUSE;
$('skull').outerHTML = SKULL;
$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', togglePause);
$('restartBtn').addEventListener('click', () => startRun(run.mode, run.cls));
$('menuBtn').addEventListener('click', toMenu);
$('campaignBtn').addEventListener('click', () => { sfx.init(); openSelect('campaign'); });
$('endlessBtn').addEventListener('click', () => { sfx.init(); openSelect('endless'); });
$('goBtn').addEventListener('click', () => startRun(selMode, selHero));
$('backBtn').addEventListener('click', toMenu);
$('againBtn').addEventListener('click', () => startRun(run.mode, run.cls));
$('overMenuBtn').addEventListener('click', toMenu);

const syncSound = () => { $('soundBtn').innerHTML = sfx.on ? SOUND_ON : SOUND_OFF; };
syncSound();
$('soundBtn').addEventListener('click', () => { sfx.on = !sfx.on; store.set('standfire.sound', sfx.on ? 'on' : 'off'); syncSound(); });

// ---------- 调参面板（按 T，或连点标题 / 房间名 3 次） ----------
let pausedByTuner = false;
function buildSliders() {
  $('sliders').innerHTML = SLIDERS.map(s => `
    <div class="slider">
      <label for="cfg-${s.key}">${s.label}<output id="out-${s.key}">${cfg[s.key]}</output></label>
      <input id="cfg-${s.key}" type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${cfg[s.key]}">
    </div>`).join('');
  SLIDERS.forEach(s => $('cfg-' + s.key).addEventListener('input', ev => {
    cfg[s.key] = Number(ev.target.value); $('out-' + s.key).textContent = cfg[s.key]; saveCfg();
    if (s.key === 'pixelate') applyPixelate();
  }));
}
// 把 3D 画面按较低分辨率渲染再放大，得到像素块效果
function applyPixelate() {
  const n = Math.max(1, cfg.pixelate | 0);
  renderer.setPixelRatio(n > 1 ? 1 / n : BASE_PR);
  renderer.setSize(innerWidth, innerHeight);
  $('stage').classList.toggle('pixelated', n > 1);
}
function openTuner() {
  if (!$('tuner').hidden) return;
  $('tuner').hidden = false;
  if (mode === 'play' && !paused) { paused = true; pausedByTuner = true; }
}
function closeTuner() {
  $('tuner').hidden = true; $('cfgOut').hidden = true;
  if (pausedByTuner) { paused = false; pausedByTuner = false; }
}
function toggleTuner() { $('tuner').hidden ? openTuner() : closeTuner(); }
function tripleTap(el) {
  let taps = [];
  el.style.pointerEvents = 'auto';
  el.addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    const now = performance.now(); taps = taps.filter(t => now - t < 650); taps.push(now);
    if (taps.length >= 3) { taps = []; openTuner(); }
  });
}
buildSliders();
applyPixelate();
tripleTap($('menuTitle'));
tripleTap(document.querySelector('.room-label'));
$('tunerClose').addEventListener('click', closeTuner);
$('resetCfg').addEventListener('click', () => { cfg = { ...DEFAULTS }; saveCfg(); buildSliders(); applyPixelate(); });
$('copyCfg').addEventListener('click', () => {
  const text = JSON.stringify(cfg, null, 2), out = $('cfgOut');
  const fallback = () => { out.value = text; out.hidden = false; out.focus(); out.select(); };
  try { navigator.clipboard.writeText(text).then(() => { $('copyCfg').textContent = '已复制'; setTimeout(() => { $('copyCfg').textContent = '复制参数'; }, 1500); }, fallback); }
  catch (err) { fallback(); }
});

// 菜单、选择、祝福、结算界面上缓缓升起的火星
document.querySelectorAll('.embers').forEach(box => {
  for (let i = 0; i < 18; i++) {
    const e = document.createElement('i');
    const big = Math.random() < 0.3;
    e.style.left = rand(2, 98) + '%';
    e.style.width = e.style.height = big ? '8px' : '4px';
    e.style.background = e.style.color = ['#ff7a3d', '#f2c14e', '#ffb35c'][i % 3];
    e.style.boxShadow = '0 0 8px currentColor';
    const dur = rand(7, 14);
    e.style.animationDuration = dur + 's';
    e.style.animationDelay = -rand(0, dur) + 's';
    e.style.animationTimingFunction = `steps(${Math.round(dur * 12)})`;
    box.appendChild(e);
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// 调试入口：浏览器控制台里可用 dungeon.step(dt) 快进
window.dungeon = {
  step, startRun, tryRoll, fireShot, showBlessings, chooseBlessing, chooseHero, openSelect, spawnEnemy, nextRoom,
  get state() { return { mode, paused, T, run, room, player, enemies, stats, mods, shots, bolts }; },
};

// ---------- 启动 ----------
loadAll().then(() => {
  $('loading').hidden = true;
  toMenu();
  requestAnimationFrame(frame);
}).catch(err => {
  console.error(err);
  $('loadText').textContent = '地牢资源加载失败，请刷新页面重试';
});
