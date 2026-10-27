// 把 KayKit 的 .glb 模型转成内嵌 base64 的 glTF JSON，只保留游戏用到的动画，并压缩二进制缓冲。
// 网页托管服务通常不支持 .glb 类型，而 .json 都能正常提供；去掉多余动画后角色模型能缩小到原来的 1/4 左右。
//
// 用法：npm run convert:model -- <输入.glb> <输出.json> [动画1,动画2,...]
// 例如：npm run convert:model -- assets/Mage.glb public/models/Mage.json Idle,Running_A,Dodge_Forward
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const [src, dst, keepArg] = process.argv.slice(2);
if (!src || !dst) {
  console.error('用法：npm run convert:model -- <输入.glb> <输出.json> [动画1,动画2,...]');
  process.exit(1);
}
const keep = keepArg ? new Set(keepArg.split(',')) : null;

// GLB 结构：12 字节文件头，然后是 JSON 块和 BIN 块
const b = readFileSync(src);
const jsonLen = b.readUInt32LE(12);
const j = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;
const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jsonLen));

if (keep && j.animations) {
  const missing = [...keep].filter(n => !j.animations.some(a => a.name === n));
  if (missing.length) console.warn('模型里没有这些动画：', missing.join(', '));
  j.animations = j.animations.filter(a => keep.has(a.name));
}

// 找出仍被网格、蒙皮、动画引用的 accessor 和 bufferView，其余丢掉
const usedAcc = new Set();
for (const m of j.meshes || []) for (const p of m.primitives) {
  Object.values(p.attributes).forEach(i => usedAcc.add(i));
  if (p.indices !== undefined) usedAcc.add(p.indices);
  for (const t of p.targets || []) Object.values(t).forEach(i => usedAcc.add(i));
}
for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) usedAcc.add(s.inverseBindMatrices);
for (const a of j.animations || []) for (const s of a.samplers) { usedAcc.add(s.input); usedAcc.add(s.output); }

const accMap = new Map(), newAcc = [];
j.accessors.forEach((a, i) => { if (usedAcc.has(i)) { accMap.set(i, newAcc.length); newAcc.push(a); } });
const usedBV = new Set();
newAcc.forEach(a => {
  if (a.bufferView !== undefined) usedBV.add(a.bufferView);
  if (a.sparse) { usedBV.add(a.sparse.indices.bufferView); usedBV.add(a.sparse.values.bufferView); }
});
for (const im of j.images || []) if (im.bufferView !== undefined) usedBV.add(im.bufferView);

// 重新紧凑排列缓冲区（4 字节对齐）
const bvMap = new Map(), newBV = [], chunks = [];
let off = 0;
j.bufferViews.forEach((bv, i) => {
  if (!usedBV.has(i)) return;
  const start = bv.byteOffset || 0;
  const data = bin.subarray(start, start + bv.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  bvMap.set(i, newBV.length); newBV.push({ ...bv, buffer: 0, byteOffset: off });
  chunks.push(data); off += data.length;
});

// 更新所有引用到新的下标
newAcc.forEach(a => {
  if (a.bufferView !== undefined) a.bufferView = bvMap.get(a.bufferView);
  if (a.sparse) { a.sparse.indices.bufferView = bvMap.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = bvMap.get(a.sparse.values.bufferView); }
});
for (const im of j.images || []) if (im.bufferView !== undefined) im.bufferView = bvMap.get(im.bufferView);
for (const m of j.meshes || []) for (const p of m.primitives) {
  for (const k of Object.keys(p.attributes)) p.attributes[k] = accMap.get(p.attributes[k]);
  if (p.indices !== undefined) p.indices = accMap.get(p.indices);
  for (const t of p.targets || []) for (const k of Object.keys(t)) t[k] = accMap.get(t[k]);
}
for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = accMap.get(s.inverseBindMatrices);
for (const a of j.animations || []) for (const s of a.samplers) { s.input = accMap.get(s.input); s.output = accMap.get(s.output); }
j.accessors = newAcc; j.bufferViews = newBV;

const out = Buffer.concat(chunks);
j.buffers = [{ byteLength: out.length, uri: 'data:application/octet-stream;base64,' + out.toString('base64') }];
writeFileSync(dst, JSON.stringify(j));
const mb = f => (statSync(f).size / 1e6).toFixed(2) + ' MB';
console.log(`${basename(dst)}: ${mb(src)} → ${mb(dst)}，动画：${(j.animations || []).map(a => a.name).join(', ') || '无'}`);
