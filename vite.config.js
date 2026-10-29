import { defineConfig } from 'vite';
import fontSubset from './scripts/font-subset.mjs';
import modelBundle from './scripts/model-bundle.mjs';

const FONTS = 'src/assets/fonts';

export default defineConfig({
  // 相对路径：部署到任何子目录都能用
  base: './',
  plugins: [
    fontSubset({
      font: `${FONTS}/fusion-pixel-12px-proportional-zh_hans.woff2`,
      out: `${FONTS}/fusion-pixel-subset.woff2`,
      scan: ['index.html', 'src'],
    }),
    modelBundle(),
  ],
  build: {
    // 像素边框 SVG 很小，直接内联进 CSS
    assetsInlineLimit: 4096,
    // Three.js 本身就有 600 KB 左右，单个包不拆分
    chunkSizeWarningLimit: 1500,
  },
});
