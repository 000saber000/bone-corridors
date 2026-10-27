import { rand } from '../utils.js';

// 菜单、选择、祝福、结算界面上缓缓升起的像素火星（按步进动画，保持像素感）
export function initEmbers() {
  document.querySelectorAll('.embers').forEach(box => {
    for (let i = 0; i < 18; i++) {
      const e = document.createElement('i');
      const big = Math.random() < 0.3;
      e.style.left = rand(2, 98) + '%';
      e.style.width = e.style.height = big ? '8px' : '4px';
      e.style.background = e.style.color = ['#ff7a3d', '#f2c14e', '#ffb35c'][i % 3];
      e.style.boxShadow = '0 0 8px currentColor';
      const dur = rand(7, 14);
      e.style.animationDuration = dur + 's';
      e.style.animationDelay = -rand(0, dur) + 's';
      e.style.animationTimingFunction = `steps(${Math.round(dur * 12)})`;
      box.appendChild(e);
    }
  });
}
