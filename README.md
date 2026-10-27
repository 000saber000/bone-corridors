# 骸骨回廊

浏览器里的 3D 像素风地牢小游戏。移动时不能攻击，站定后才会自动出手；翻滚无敌，可以穿过弹幕。

- 两个职业：法师（远程飞弹）、骑士（近战挥剑，剑光能斩碎弹幕）
- 战役：3 层地牢、9 间密室、3 位首领
- 无尽深渊：一层层往下打，看你能到第几层

## 怎么玩

- 在线：部署在 Render 上，打开网站即可
- 离线：下载 `骸骨回廊.html`，双击用 Chrome / Edge / Firefox 打开

操作：WASD 或方向键移动，空格 / Shift 翻滚；手机按住屏幕拖动移动，右下角按钮翻滚。

## 目录

- `src/`：样式、页面结构、游戏逻辑源码
- `tools/build.py`：把源码合成为 `index.html`（网站用）和 `骸骨回廊.html`（单文件版）
- `models/`、`vendor/`、`fonts/`：模型、Three.js 引擎、像素字体

## 素材授权

- 3D 模型：[KayKit](https://kaylousberg.com) by Kay Lousberg，CC0（见 `models/LICENSE-KayKit.txt`）
- 像素字体：[Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font)，SIL OFL 1.1（见 `fonts/OFL-fusion-pixel.txt`）
- 引擎：[Three.js](https://threejs.org)，MIT
