// 像素图：字符画 → SVG。'.' 透明，其他字符查调色板；outline 会自动加 1 像素黑描边。
export function pixSvg(rows, pal, { outline = false, cls = '' } = {}) {
  let grid = rows.map(r => [...r]);
  if (outline) {
    const h = grid.length + 2, w = grid[0].length + 2;
    const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (grid[y - 1] && grid[y - 1][x - 1]) || '.'));
    const filled = (x, y) => g[y] && g[y][x] && g[y][x] !== '.' && g[y][x] !== '#';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (g[y][x] === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g[y][x] = '#';
    }
    grid = g;
  }
  let r = '';
  grid.forEach((row, y) => row.forEach((c, x) => { if (c !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === '#' ? '#000' : pal[c]}"/>`; }));
  return `<svg class="${cls}" viewBox="0 0 ${grid[0].length} ${grid.length}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}

const HEART = ['.KK...KK.', 'KRRK.KRRK', 'KRWRKRRRK', 'KRRRRRRRK', '.KRRRRRK.', '..KRRRK..', '...KRK...', '....K....'];
export const HEART_FULL = pixSvg(HEART, { K: '#000', R: '#e5484d', W: '#ffd0d0' });
export const HEART_EMPTY = pixSvg(HEART, { K: '#000', R: '#3a2f45', W: '#4a3c5a' });
export const SKULL = pixSvg(['WWWWW', 'WKWKW', 'WWWWW', '.WKW.', '.W.W.'], { W: '#fff3d6', K: '#000' }, { outline: true });
const UI_W = { W: '#fff2b0' };
export const SOUND_ON = pixSvg(['....W.....', '...WW..W..', 'WWWWW...W.', 'WWWWW.W.W.', 'WWWWW.W.W.', 'WWWWW...W.', '...WW..W..', '....W.....'], UI_W);
export const SOUND_OFF = pixSvg(['....W.....', '...WW.....', 'WWWWW.W..W', 'WWWWW..WW.', 'WWWWW..WW.', 'WWWWW.W..W', '...WW.....', '....W.....'], UI_W);
export const PAUSE = pixSvg(['WW..WW', 'WW..WW', 'WW..WW', 'WW..WW', 'WW..WW', 'WW..WW'], UI_W);
