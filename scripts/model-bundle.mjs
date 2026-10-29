// Vite 插件（只在 npm run build 时生效）：
// 1. 把 11 个场景小模型合成一个 models/scenery.json，标题画面要等的请求从 13 个降到 3 个；
// 2. 在页面开头预加载这 3 个文件，不用等游戏脚本下载、运行完才开始下载模型。
// 网络延迟高（比如开着代理）时，每个请求都要先等一段时间，请求个数比文件大小更影响速度。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSETS, SCENERY_KEYS, SCENERY_BUNDLE, FIRST_URLS } from '../src/engine/asset-list.js';

export default function modelBundle({ publicDir = 'public' } = {}) {
  return {
    name: 'model-bundle',
    apply: 'build',
    generateBundle() {
      const all = Object.fromEntries(SCENERY_KEYS.map(k => [k, JSON.parse(readFileSync(join(publicDir, ASSETS[k][0]), 'utf8'))]));
      this.emitFile({ type: 'asset', fileName: SCENERY_BUNDLE, source: JSON.stringify(all) });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // crossorigin 要和 three.js 的 fetch 请求一致，浏览器才会直接用预加载的结果
        const links = FIRST_URLS.map(u => `  <link rel="preload" href="./${u}" as="fetch" crossorigin>`).join('\n');
        return html.replace('</title>', `</title>\n${links}`);
      },
    },
  };
}
