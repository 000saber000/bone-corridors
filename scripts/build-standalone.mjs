// 在 vite build 之后运行：把 dist/ 里的脚本、样式、字体和模型全部内嵌，
// 生成可以双击打开、也能直接发给别人的单文件版 dist/骸骨回廊.html。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const read = p => readFileSync(p, 'utf8');

let html = read(join(DIST, 'index.html'));
// 字体会内嵌进样式，单文件版不需要预加载外部字体
html = html.replace(/\s*<link rel="preload"[^>]*>/g, '');

// 1. 样式：<link rel="stylesheet"> 换成内联 <style>，其中引用的字体和图片都换成 base64
const MIME = { woff2: 'font/woff2', svg: 'image/svg+xml', png: 'image/png' };
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (_, file) => {
  const css = read(join(DIST, file)).replace(/url\(["']?(?!data:)\.?\/?([^"')]+\.(woff2|svg|png))["']?\)/g, (m, ref, ext) => {
    const data = readFileSync(join(DIST, 'assets', basename(ref))).toString('base64');
    return `url("data:${MIME[ext]};base64,${data}")`;
  });
  return `<style>${css}</style>`;
});

// 2. 脚本：外部模块换成内联模块（转义 </script，避免提前结束标签）
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, file) => {
  const js = read(join(DIST, file)).replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
if (/src="\.\/assets\//.test(html) || /href="\.\/assets\/[^"]+\.css"/.test(html)) throw new Error('仍有外部 assets 引用没有内联');

// 3. 模型：按 src/engine/assets.js 里的 ASSETS 清单嵌成 <script id="asset-键名">，游戏会优先读取它们
const manifest = [...read(join(ROOT, 'src/engine/assets.js')).matchAll(/(\w+): \['(models\/[^']+\.json)'/g)];
if (manifest.length < 10) throw new Error('没有从 assets.js 读到模型清单');
const blobs = manifest.map(([, key, file]) =>
  `<script type="application/json" id="asset-${key}">${read(join(DIST, file)).replace(/<\//g, '<\\/')}</script>`).join('\n');
html = html.replace('</body>', `${blobs}\n</body>`);

const out = join(DIST, '骸骨回廊.html');
writeFileSync(out, html);
const files = readdirSync(join(DIST, 'models')).length;
console.log(`单文件版已生成：dist/骸骨回廊.html（${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB，内嵌 ${manifest.length}/${files - 1} 个模型）`);
