# 骸骨回廊

浏览器里的 3D 像素风地牢小游戏。**移动时不能攻击，站定后才会自动出手**；翻滚期间无敌，可以穿过弹幕。

- 两个职业：法师（远程飞弹）、骑士（近战挥剑，剑光能斩碎弹幕）
- 战役：3 层地牢、9 间密室（随机布局与配怪）、3 位首领
- 无尽深渊：一层层往下打，每 5 层一位首领，看你能到第几层
- 每间房清空后三选一祝福，选中的卡片会化作一道光飞入角色体内

在线试玩：<https://bone-corridors.onrender.com>

## 操作

| | 电脑 | 手机 |
|---|---|---|
| 移动 | WASD / 方向键 | 按住屏幕任意处拖动 |
| 攻击 | 站定后自动 | 松手站定后自动 |
| 翻滚 | 空格 / Shift | 右下角按钮 |
| 暂停 | Esc / P | 右上角按钮 |
| 调参面板 | T | 连点标题或房间名 3 次 |

## 开发

需要 Node.js 20 或更高版本。

```bash
npm install        # 安装依赖（Vite、Three.js）
npm run dev        # 本地开发，打开 http://localhost:5173
npm run build      # 构建到 dist/，同时生成单文件版 dist/骸骨回廊.html
npm run preview    # 预览构建结果
```

`dist/骸骨回廊.html` 把引擎、模型、字体全部内嵌在一个文件里，双击就能离线游玩，也可以直接发给朋友。

## 目录结构

```
index.html                 页面结构（菜单、HUD、各种弹层）
public/models/             KayKit 角色与场景模型（已转成 glTF JSON）
src/
  main.js                  入口：初始化界面和输入，加载模型，进入标题画面
  state.js                 运行时共享状态
  config.js                调参面板的可调数值
  audio.js                 WebAudio 合成音效
  input.js                 键盘与触屏摇杆
  engine/                  渲染器与灯光、程序贴图、模型加载、角色动画
  game/
    data/                  英雄、房间布局、敌人、祝福等数据表
    ai/                    普通敌人和三位首领的行为
    combat.js              伤害、格挡、暴击、子弹、骑士近战
    player.js              英雄移动、翻滚、站定攻击
    flow.js                战役 / 无尽模式的关卡流程
    loop.js                主循环与镜头
    room.js · entities.js · fx.js
  ui/                      HUD、菜单与英雄选择、祝福卡片、调参面板、像素图标
  styles/                  像素风界面样式
  assets/                  像素字体、像素边框 SVG
scripts/
  build-standalone.mjs     生成单文件版
  gen-frames.mjs           生成像素边框 SVG（npm run gen:frames）
  convert-model.mjs        把 .glb 模型转成 JSON 并裁掉不用的动画（npm run convert:model）
```

## 部署（Render 静态网站）

- Build Command：`npm ci && npm run build`
- Publish Directory：`dist`

推送到 `main` 分支后 Render 会自动重新部署。

## 素材授权

- 3D 模型：[KayKit](https://kaylousberg.com) by Kay Lousberg，CC0（见 `public/models/LICENSE-KayKit.txt`）
- 像素字体：[Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font)，SIL OFL 1.1（见 `src/assets/fonts/OFL-fusion-pixel.txt`）
- 引擎：[Three.js](https://threejs.org)，MIT
