// 调参面板里的可调数值，保存在浏览器本地
export const SLIDERS = [
  { key: 'moveMul',     label: '移速倍率',               min: 0.5, max: 2,   step: 0.05, def: 1 },
  { key: 'atkMul',      label: '攻速倍率',               min: 0.5, max: 3,   step: 0.05, def: 1 },
  { key: 'dmgMul',      label: '伤害倍率',               min: 0.5, max: 3,   step: 0.1,  def: 1 },
  { key: 'fireDelay',   label: '站定后出手延迟（秒）',   min: 0,   max: 0.6, step: 0.02, def: 0.12 },
  { key: 'rollDistMul', label: '翻滚距离倍率',           min: 0.5, max: 2,   step: 0.05, def: 1 },
  { key: 'rollCdMul',   label: '翻滚冷却倍率',           min: 0.3, max: 2,   step: 0.05, def: 1 },
  { key: 'enemySpeed',  label: '骷髅移速',               min: 1,   max: 7,   step: 0.1,  def: 3.2 },
  { key: 'bulletSpeed', label: '敌方弹速',               min: 3,   max: 14,  step: 0.5,  def: 7 },
  { key: 'enemyHpMul',  label: '敌人血量倍率',           min: 0.3, max: 3,   step: 0.1,  def: 1 },
  { key: 'hitstop',     label: '命中顿帧强度',           min: 0,   max: 2,   step: 0.1,  def: 1 },
  { key: 'hpBonus',     label: '额外生命（下局）',       min: 0,   max: 10,  step: 1,    def: 0 },
  { key: 'pixelate',    label: '3D 画面像素化（1 = 关）', min: 1,  max: 5,   step: 1,    def: 1 },
];
export const DEFAULTS = Object.fromEntries(SLIDERS.map(s => [s.key, s.def]));

// 隐私模式等情况下 localStorage 可能不可用，读写都要兜底
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

export const cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(store.get('bonecorr.cfg') || '{}')); } catch (e) {}
export const saveCfg = () => store.set('bonecorr.cfg', JSON.stringify(cfg));
export function resetCfg() { Object.assign(cfg, DEFAULTS); saveCfg(); }
