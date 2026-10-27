// 生成界面用的像素九宫格边框 SVG（src/assets/frames/）。
// 每张图都是 12×12（或 6×6）的像素网格，CSS 用 border-image 按 4 格（或 2 格）切片拉伸。
// 用法：npm run gen:frames
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/frames');

function svg(w, h, rects) {
  const body = rects.map(([x, y, a, b, c, o = 1]) =>
    `<rect x="${x}" y="${y}" width="${a}" height="${b}" fill="${c}"${o !== 1 ? ` fill-opacity="${o}"` : ''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>\n`;
}

// 黑色缺角描边
const outline12 = () => [[1, 0, 10, 1, '#000'], [1, 11, 10, 1, '#000'], [0, 1, 1, 10, '#000'], [11, 1, 1, 10, '#000']];

// 面板：亮/暗两色边 + 内描边 + 半透明填充
const panel = (hi, lo, fill, op = 0.94, inner = '#000') => svg(12, 12, [...outline12(),
  [1, 1, 10, 1, hi], [1, 2, 1, 9, hi], [2, 10, 9, 1, lo], [10, 2, 1, 8, lo],
  [2, 2, 8, 1, inner], [2, 9, 8, 1, inner], [2, 3, 1, 6, inner], [9, 3, 1, 6, inner],
  [3, 3, 6, 6, fill, op]]);

// 按钮：顶部高光、底部两行阴影形成立体感
const button = (body, top, left, shade, right, shadeRows = 2) => svg(12, 12, [...outline12(),
  [1, 1, 10, 10, body], [1, 1, 10, 1, top], [1, 2, 1, 9 - shadeRows, left],
  [1, 11 - shadeRows, 10, shadeRows, shade], [10, 2, 1, 9 - shadeRows, right]]);

function pixelCircle(n, rOut, rIn, color, op, edge = '#000') {
  const rects = [], c = (n - 1) / 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - c, y - c);
    if (d >= rIn && d <= rOut) rects.push([x, y, 1, 1, color, op]);
    else if ((d > rOut && d <= rOut + 1) || (rIn > 0 && d >= rIn - 1 && d < rIn)) rects.push([x, y, 1, 1, edge, 0.6]);
  }
  return svg(n, n, rects);
}

const FRAMES = {
  'panel.svg': panel('#f2c14e', '#7a4a1c', '#17121c'),
  'gold.svg': button('#f2c14e', '#fff2b0', '#ffd970', '#b0702a', '#d99a3a'),
  'gold-hover.svg': button('#ffd463', '#ffffff', '#fff0a0', '#c07c30', '#e8aa48'),
  'gold-down.svg': button('#e3b040', '#f6dc8a', '#f2c860', '#a0641f', '#c88a30', 1),
  'dark.svg': panel('#6b5a80', '#2b2236', '#221a2b', 0.92),
  'dark-hover.svg': panel('#9a86b4', '#3d3050', '#2c2238', 0.95),
  'bar.svg': svg(6, 6, [[1, 0, 4, 1, '#000'], [1, 5, 4, 1, '#000'], [0, 1, 1, 4, '#000'], [5, 1, 1, 4, '#000'],
    [1, 1, 4, 1, '#4a3c5a'], [1, 2, 1, 2, '#4a3c5a'], [1, 4, 4, 1, '#241c2c'], [4, 2, 1, 2, '#241c2c'], [2, 2, 2, 2, '#0f0b13', 0.92]]),
  'card-gold.svg': panel('#fff2b0', '#b0702a', '#1a1420', 0.95),
  'card-arcane.svg': panel('#e0ccff', '#6a3fb0', '#1a1420', 0.95),
  'card-frost.svg': panel('#c8f1ff', '#2a7fa8', '#1a1420', 0.95),
  'card-moss.svg': panel('#d4f5c8', '#3f8a3a', '#1a1420', 0.95),
  'card-ember.svg': panel('#ffd0a8', '#a8461c', '#1a1420', 0.95),
  'pick-arrow.svg': svg(6, 4, [[0, 0, 6, 1, '#000'], [1, 1, 4, 1, '#000'], [2, 2, 2, 1, '#000'], [1, 0, 4, 1, '#fff2b0'], [2, 1, 2, 1, '#f2c14e']]),
  'joy-ring.svg': pixelCircle(32, 15, 13, '#f2c14e', 0.55),
  'joy-knob.svg': pixelCircle(12, 5.5, 0, '#fff2b0', 0.75),
};

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(FRAMES)) writeFileSync(join(OUT, name), content);
console.log(`已生成 ${Object.keys(FRAMES).length} 个边框到 src/assets/frames/`);
