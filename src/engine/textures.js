import * as THREE from 'three';

// ---------- 用 Canvas 现画的特效贴图 ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const GLOW = canvasTex(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.55, 'rgba(255,255,255,0.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
export const RING = canvasTex(256, (g, s) => {
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6;
  g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2); g.stroke();
});
export const DISC = canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,0.15)'); r.addColorStop(0.85, 'rgba(255,255,255,0.35)'); r.addColorStop(0.95, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
export const RUNE = canvasTex(256, (g, s) => {
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
export const LANE = canvasTex(64, (g, s) => {
  const r = g.createLinearGradient(0, 0, s, 0);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
// 祝福光柱：横向中间亮、纵向越往上越淡
export const BEAM = canvasTex(64, (g, s) => {
  const h = g.createLinearGradient(0, 0, s, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)'); h.addColorStop(0.65, 'rgba(255,255,255,0.6)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h; g.fillRect(0, 0, s, s);
  const v = g.createLinearGradient(0, 0, 0, s);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.85)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = v; g.fillRect(0, 0, s, s);
});
// 剑光：画布上方的一道月牙（贴图“上方”= 角色正前方）
export const SLASH = canvasTex(256, (g, s) => {
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.15 + i * 0.15})`;
    g.lineWidth = 34 - i * 5;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 22 - i * 1.5, -Math.PI * 0.86, -Math.PI * 0.14); g.stroke();
  }
});
export const SPIN = canvasTex(256, (g, s) => {
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.12 + i * 0.13})`; g.lineWidth = 30 - i * 4;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 22, 0, Math.PI * 1.85); g.stroke();
  }
});
// 持盾骷髅的骨盾结界：前方一道半弧
export const SHIELD = canvasTex(256, (g, s) => {
  g.shadowColor = 'white'; g.shadowBlur = 16;
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.35 + i * 0.3})`; g.lineWidth = 16 - i * 5;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 26, -Math.PI * 0.8, -Math.PI * 0.2); g.stroke();
  }
});

// 站定蓄力环：按进度重绘，进度没变就跳过
const chargeCanvas = document.createElement('canvas'); chargeCanvas.width = chargeCanvas.height = 128;
export const chargeTex = new THREE.CanvasTexture(chargeCanvas); chargeTex.colorSpace = THREE.SRGBColorSpace;
let lastCharge = -1;
export function drawCharge(p, moving) {
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

// ---------- 材质与地面贴花 ----------
const addMat = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
export const glowMat = color => new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
export function floorDecal(tex, color, size, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), addMat(tex, color, opacity));
  m.rotation.x = -Math.PI / 2; m.scale.set(size, size, 1); m.position.y = 0.09; m.renderOrder = 2;
  return m;
}
// 平面贴图的“上方”朝向角色 face 方向时，rotation.z 需要加 π
export const faceToZ = face => face + Math.PI;
