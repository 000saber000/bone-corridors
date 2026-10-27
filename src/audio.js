import { store } from './config.js';

// 所有音效都用 WebAudio 现场合成，不需要音频文件
export const sfx = {
  ctx: null, on: store.get('standfire.sound') !== 'off', noiseBuf: null,
  // 浏览器要求用户交互后才能出声，所以在点击“开始”等按钮时调用
  init() {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.noiseBuf) {
        const n = this.ctx.sampleRate * 0.6, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
      }
    } catch (e) { this.ctx = null; }
  },
  toggle() { this.on = !this.on; store.set('standfire.sound', this.on ? 'on' : 'off'); },
  tone(type, f0, f1, dur, vol, delay = 0) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, f0, f1, delay = 0) {
    const c = this.ctx; if (!c || !this.on || !this.noiseBuf) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.02);
  },
  bolt()  { this.tone('square', 1300, 620, 0.06, 0.018); this.noise(0.05, 0.03, 3000, 1500); },
  hit()   { this.tone('triangle', 260, 90, 0.08, 0.07); this.noise(0.06, 0.08, 1400, 500); },
  crit()  { this.tone('square', 1500, 2400, 0.09, 0.035); this.tone('triangle', 200, 60, 0.14, 0.09); this.noise(0.1, 0.1, 2500, 600); },
  slash() { this.noise(0.16, 0.12, 900, 4200); this.tone('sawtooth', 300, 140, 0.1, 0.02); },
  clank() { this.tone('square', 1250, 900, 0.12, 0.035); this.tone('square', 1870, 1500, 0.1, 0.02); this.noise(0.08, 0.06, 4000, 2500); },
  bones() { this.noise(0.3, 0.12, 1800, 500); this.tone('square', 200, 70, 0.16, 0.03); },
  hurt()  { this.tone('sawtooth', 180, 50, 0.32, 0.09); this.noise(0.2, 0.08, 600, 200); },
  roll()  { this.noise(0.26, 0.1, 500, 2200); },
  dodge() { this.tone('sine', 1400, 2100, 0.1, 0.03); },
  cast()  { this.tone('sine', 260, 760, 0.55, 0.025); },
  dash()  { this.noise(0.22, 0.09, 2400, 700); },
  slam()  { this.tone('sine', 90, 30, 0.6, 0.18); this.noise(0.5, 0.14, 400, 80); },
  enemyShot() { this.tone('triangle', 620, 260, 0.14, 0.03); },
  door()  { this.tone('sawtooth', 70, 38, 0.9, 0.07); this.noise(0.8, 0.06, 260, 90); },
  bless() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.22, 0.03, i * 0.06)); this.tone('sine', 262, 1047, 0.7, 0.04); },
  pick()  { this.tone('square', 880, 1320, 0.08, 0.035); },
  whoosh() { this.noise(0.7, 0.07, 400, 3200); this.tone('sine', 400, 1600, 0.7, 0.02); },
  win()   { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.06, i * 0.12)); },
  lose()  { [330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.95, 0.4, 0.07, i * 0.2)); },
};
