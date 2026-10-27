// 敌人属性。src 是模型，cost 是随机配怪时占用的难度预算，带 boss 的是首领。
export const ENEMY = {
  minion:   { src: 'minion',  hp: 3,   r: 0.6,  scale: 1,    cost: 1 },
  mage:     { src: 'smage',   hp: 4,   r: 0.6,  scale: 1,    cost: 1.6 },
  rogue:    { src: 'rogue',   hp: 3,   r: 0.55, scale: 1,    cost: 1.5 },
  warrior:  { src: 'warrior', hp: 7,   r: 0.72, scale: 1.12, cost: 2.4 },
  guardian: { src: 'minion',  hp: 80,  r: 1.05, scale: 1.65, tint: 0xff8c80, boss: '骸骨守卫' },
  warlord:  { src: 'warrior', hp: 120, r: 1.15, scale: 1.85, tint: 0xffb070, boss: '骸骨战将' },
  archlich: { src: 'smage',   hp: 150, r: 1.1,  scale: 1.9,  tint: 0xc9a0ff, boss: '骸骨大巫' },
};

// 无尽深渊里首领的出场顺序
export const BOSS_ORDER = ['guardian', 'warlord', 'archlich'];
