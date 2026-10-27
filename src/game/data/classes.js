// 可选英雄。icon 是 10×10 像素图（字符画），颜色见 ROLE_PAL。
export const ROLE_PAL = { W: '#fff6e0', S: '#c9d1e0', G: '#f2c14e', B: '#8a5a2c', P: '#b98cff', Y: '#fff2b0', C: '#6fd3ff' };

export const CLASSES = {
  mage: {
    name: '法师', role: '远程 · 奥术', rarity: 'r-arcane', model: 'mage', hide: ['Spellbook', 'Spellbook_open', '1H_Wand'],
    desc: '站定后自动向最近的敌人发射奥术飞弹。射程远，但身板脆弱，翻滚距离一般。',
    hp: 4, speed: 6.4, roll: { speed: 14, dur: 0.3, cd: 0.95 },
    attack: 'ranged', range: 13, fireRate: 4, damage: 1,
    stats: { 生命: 2, 射程: 5, 伤害: 3, 翻滚: 2 },
    icon: ['....PP....', '...PYYP...', '..PYPPYP..', '...PYYP...', '....PP....', '....B.....', '....B.....', '....B.....', '....B.....', '....B.....'],
  },
  knight: {
    name: '骑士', role: '近战 · 剑盾', rarity: 'r-frost', model: 'knight', hide: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword'],
    desc: '站定后自动挥剑横扫身前的敌人，剑光能斩碎飞来的弹幕。翻滚更远、冷却更短，生命更厚。',
    hp: 6, speed: 6.8, roll: { speed: 19, dur: 0.34, cd: 0.5 },
    attack: 'melee', reach: 2.8, swingRate: 1.8, damage: 3,
    stats: { 生命: 4, 射程: 1, 伤害: 5, 翻滚: 5 },
    icon: ['........WW', '.......WSW', '......WSW.', '.....WSW..', '..G.WSW...', '...GSW....', '...BGG....', '..B..G....', '.B........', 'B.........'],
  },
};
