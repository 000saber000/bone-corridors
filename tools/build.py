# 把 src/ 里的样式、页面结构和游戏脚本合成为两个页面：
#   index.html     开发版，引擎和模型是外部文件，需要用本地服务器打开
#   骸骨回廊.html  单文件版，引擎、模型、字体全部内嵌，双击即可游玩，也能直接发给朋友
# 用法：在 stand-and-fire 目录下运行  python tools/build.py
import base64
import json
import math
import os
import re
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def svg(w, h, rects):
    body = ''.join(
        f"<rect x='{x}' y='{y}' width='{a}' height='{b}' fill='{c}'" + (f" fill-opacity='{o}'" if o != 1 else '') + '/>'
        for x, y, a, b, c, o in rects)
    s = f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}' shape-rendering='crispEdges'>{body}</svg>"
    return 'url("data:image/svg+xml,' + urllib.parse.quote(s, safe="/:=' ") + '")'


def outline12():
    return [(1, 0, 10, 1, '#000', 1), (1, 11, 10, 1, '#000', 1), (0, 1, 1, 10, '#000', 1), (11, 1, 1, 10, '#000', 1)]


def panel(hi, lo, fill, op=0.94, inner='#000'):
    """12x12 九宫格面板：黑色缺角描边 + 亮/暗两色边 + 内描边 + 填充。"""
    return svg(12, 12, outline12() + [
        (1, 1, 10, 1, hi, 1), (1, 2, 1, 9, hi, 1), (2, 10, 9, 1, lo, 1), (10, 2, 1, 8, lo, 1),
        (2, 2, 8, 1, inner, 1), (2, 9, 8, 1, inner, 1), (2, 3, 1, 6, inner, 1), (9, 3, 1, 6, inner, 1),
        (3, 3, 6, 6, fill, op)])


def button(body, top, left, shade, right, shade_rows=2):
    return svg(12, 12, outline12() + [
        (1, 1, 10, 10, body, 1), (1, 1, 10, 1, top, 1), (1, 2, 1, 11 - 2 - shade_rows, left, 1),
        (1, 11 - shade_rows, 10, shade_rows, shade, 1), (10, 2, 1, 11 - 2 - shade_rows, right, 1)])


def pixel_circle(n, r_out, r_in, color, op, edge='#000'):
    rects = []
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if r_in <= d <= r_out:
                rects.append((x, y, 1, 1, color, op))
            elif r_out < d <= r_out + 1 or (r_in > 0 and r_in - 1 <= d < r_in):
                rects.append((x, y, 1, 1, edge, 0.6))
    return svg(n, n, rects)


FRAMES = {
    '__F_PANEL__': panel('#f2c14e', '#7a4a1c', '#17121c'),
    '__F_GOLD__': button('#f2c14e', '#fff2b0', '#ffd970', '#b0702a', '#d99a3a'),
    '__F_GOLD_HI__': button('#ffd463', '#ffffff', '#fff0a0', '#c07c30', '#e8aa48'),
    '__F_GOLD_DOWN__': button('#e3b040', '#f6dc8a', '#f2c860', '#a0641f', '#c88a30', 1),
    '__F_DARK__': panel('#6b5a80', '#2b2236', '#221a2b', 0.92),
    '__F_DARK_HI__': panel('#9a86b4', '#3d3050', '#2c2238', 0.95),
    '__F_BAR__': svg(6, 6, [(1, 0, 4, 1, '#000', 1), (1, 5, 4, 1, '#000', 1), (0, 1, 1, 4, '#000', 1), (5, 1, 1, 4, '#000', 1),
                           (1, 1, 4, 1, '#4a3c5a', 1), (1, 2, 1, 2, '#4a3c5a', 1), (1, 4, 4, 1, '#241c2c', 1), (4, 2, 1, 2, '#241c2c', 1),
                           (2, 2, 2, 2, '#0f0b13', 0.92)]),
    '__F_C_GOLD__': panel('#fff2b0', '#b0702a', '#1a1420', 0.95),
    '__F_C_ARCANE__': panel('#e0ccff', '#6a3fb0', '#1a1420', 0.95),
    '__F_C_FROST__': panel('#c8f1ff', '#2a7fa8', '#1a1420', 0.95),
    '__F_C_MOSS__': panel('#d4f5c8', '#3f8a3a', '#1a1420', 0.95),
    '__F_C_EMBER__': panel('#ffd0a8', '#a8461c', '#1a1420', 0.95),
    '__ARROW__': svg(6, 4, [(0, 0, 6, 1, '#000', 1), (1, 1, 4, 1, '#000', 1), (2, 2, 2, 1, '#000', 1),
                           (1, 0, 4, 1, '#fff2b0', 1), (2, 1, 2, 1, '#f2c14e', 1)]),
    '__JOY_RING__': pixel_circle(32, 15, 13, '#f2c14e', 0.55),
    '__JOY_KNOB__': pixel_circle(12, 5.5, 0, '#fff2b0', 0.75),
}

HEAD = '''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>骸骨回廊</title>
<style>
'''


def read(p):
    return open(os.path.join(ROOT, p), encoding='utf-8').read()


def js_data_url(code):
    return 'data:text/javascript;base64,' + base64.b64encode(code.encode('utf-8')).decode('ascii')


def standalone(css, markup, game):
    """单文件版：引擎模块走 import map 的 data: 地址，模型以 JSON 嵌进页面，字体转成 base64。"""
    three = read('vendor/three.module.min.js')
    bgu = read('vendor/addons/utils/BufferGeometryUtils.js').replace("'../../three.module.min.js'", "'three'")
    gltf = (read('vendor/addons/loaders/GLTFLoader.js')
            .replace("'../../three.module.min.js'", "'three'")
            .replace("'../utils/BufferGeometryUtils.js'", "'three/bgu'"))
    skel = read('vendor/addons/utils/SkeletonUtils.js').replace("'../../three.module.min.js'", "'three'")
    importmap = json.dumps({'imports': {
        'three': js_data_url(three), 'three/bgu': js_data_url(bgu),
        'three/gltf': js_data_url(gltf), 'three/skeleton': js_data_url(skel)}})
    game = (game.replace("'./vendor/three.module.min.js'", "'three'")
                .replace("'./vendor/addons/loaders/GLTFLoader.js'", "'three/gltf'")
                .replace("'./vendor/addons/utils/SkeletonUtils.js'", "'three/skeleton'"))
    assert './vendor/' not in game, 'unreplaced import'

    font = base64.b64encode(open(os.path.join(ROOT, 'fonts/fusion-pixel-12px-proportional-zh_hans.woff2'), 'rb').read()).decode('ascii')
    css = css.replace('url("fonts/fusion-pixel-12px-proportional-zh_hans.woff2")', f'url("data:font/woff2;base64,{font}")')
    assert 'url("fonts/' not in css

    # 模型清单直接从 game.js 的 ASSETS 里读，保证两边一致
    assets = re.findall(r"(\w+): \['(models/[^']+\.json)'", game)
    assert len(assets) >= 10, assets
    blobs = ''.join(
        f'<script type="application/json" id="asset-{k}">' + read(p).replace('</', '<\\/') + '</script>\n'
        for k, p in assets)
    return (HEAD + css + '</style>\n\n' + markup + '\n' + blobs +
            f'<script type="importmap">{importmap}</script>\n<script type="module">\n' + game + '</script>\n')


def main():
    css = read('src/ui.css')
    for k, v in FRAMES.items():
        css = css.replace(k, v)
    leftover = [k for k in FRAMES if k in css]
    assert not leftover, leftover
    markup, game = read('src/markup.html'), read('src/game.js')
    outputs = {
        'index.html': HEAD + css + '</style>\n\n' + markup + '\n<script type="module">\n' + game + '</script>\n',
        '骸骨回廊.html': standalone(css, markup, game),
    }
    for name, html in outputs.items():
        open(os.path.join(ROOT, name), 'w', encoding='utf-8', newline='\n').write(html)
        print(name, f'{len(html.encode("utf-8")) / 1e6:.1f} MB')


main()
