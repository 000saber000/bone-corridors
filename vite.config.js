import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径：部署到任何子目录都能用
  base: './',
  build: {
    // 像素边框 SVG 很小，直接内联进 CSS
    assetsInlineLimit: 4096,
    // Three.js 本身就有 600 KB 左右，单个包不拆分
    chunkSizeWarningLimit: 1500,
  },
});
