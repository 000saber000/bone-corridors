// Vite 插件（只在 npm run build 时生效）：完整字体有几千个汉字、650 KB，
// 构建时扫描 index.html 和 src/ 里实际出现的文字，只保留这些字，生成小字体给网页用。
// 开发模式（npm run dev）仍用完整字体，新加的文字不需要任何额外操作，下次构建自动包含。
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import subsetFont from 'subset-font';

const SCAN_EXT = new Set(['.js', '.css', '.html']);

function collectText(paths) {
  const chars = new Set();
  // 所有可打印 ASCII 都保留：分数、计时、英文小标题都靠它们拼出来
  for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c));
  const walk = p => {
    if (statSync(p).isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f)); return; }
    if (!SCAN_EXT.has(extname(p))) return;
    for (const ch of readFileSync(p, 'utf8')) if (ch.codePointAt(0) > 0x7e) chars.add(ch);
  };
  for (const p of paths) walk(p);
  return [...chars].join('');
}

export default function fontSubset({ font, out, scan }) {
  const fontName = basename(font), outName = basename(out);
  return {
    name: 'font-subset',
    apply: 'build',
    enforce: 'pre',
    async buildStart() {
      const text = collectText(scan);
      const full = readFileSync(font);
      const small = await subsetFont(full, text, { targetFormat: 'woff2' });
      writeFileSync(out, small);
      console.log(`\n字体瘦身：${[...text].length} 个字符，${(full.length / 1024).toFixed(0)} KB → ${(small.length / 1024).toFixed(0)} KB`);
    },
    // 样式里引用完整字体的地方换成瘦身后的字体
    transform(code, id) {
      if (id.split('?')[0].endsWith('.css') && code.includes(fontName)) return code.replaceAll(fontName, outName);
    },
    // 字体和样式表同时开始下载，不用等页面排版时才发现要它
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const asset = Object.values(ctx.bundle || {}).find(f => f.fileName.endsWith('.woff2'));
        if (!asset) return html;
        return html.replace('</title>', `</title>\n  <link rel="preload" href="./${asset.fileName}" as="font" type="font/woff2" crossorigin>`);
      },
    },
  };
}
