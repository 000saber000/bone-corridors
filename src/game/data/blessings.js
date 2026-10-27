import { CLASSES } from './classes.js';

// 10×10 像素图标，渲染时自动加黑描边
export const ICON_PAL = { R: '#e5484d', O: '#ff8a3d', Y: '#fff2b0', W: '#fff6e0', G: '#f2c14e', B: '#8a5a2c', P: '#b98cff', C: '#6fd3ff', N: '#7bd66b', L: '#2f6a35', S: '#c9d1e0' };
export const ICON = {
  fire: ['....R.....', '...RO.....', '...ROR..R.', '..ROOR.RO.', '..ROYOROR.', '.ROYYYOOR.', '.ROYWWYOR.', '.ROYWWYOR.', '..ROYYOR..', '...RRRR...'],
  sword: CLASSES.knight.icon,
  split: ['Y...Y...Y.', 'YY..Y..YY.', '.Y..Y..Y..', '..Y.Y.Y...', '...YYY....', '....Y.....', '....Y.....', '....G.....', '...GGG....', '....G.....'],
  still: ['..PPPPPP..', '.P......P.', 'P..PPPP..P', 'P.P....P.P', 'P.P.WW.P.P', 'P.P.WW.P.P', 'P.P....P.P', 'P..PPPP..P', '.P......P.', '..PPPPPP..'],
  wave: ['..........', '..CC..CC..', '.C..CC..C.', '..........', '..CC..CC..', '.C..CC..C.', '..........', '....YY....', '...YYYY...', 'YYYYYYYYYY'],
  feather: ['.......WW.', '.....WWWW.', '....WWWCW.', '...WWWCW..', '..WWWCW...', '..WWCW....', '.WWCW.....', '.WCW......', '.C........', 'C.........'],
  heart: ['.RR....RR.', 'RWRR..RRRR', 'RWRRRRRRRR', 'RRRRRRRRRR', 'RRRRRRRRRR', '.RRRRRRRR.', '..RRRRRR..', '...RRRR...', '....RR....', '..........'],
  leaf: ['.......NNN', '.....NNNNN', '....NNNNNN', '...NNNNNNN', '..NNNNLNN.', '..NNNLNNN.', '.NNNLNNN..', '.NNLNN....', '.NL.......', 'L.........'],
  eye: ['..........', '...YYYY...', '..Y....Y..', '.Y..RR..Y.', 'Y..RWWR..Y', 'Y..RWWR..Y', '.Y..RR..Y.', '..Y....Y..', '...YYYY...', '..........'],
  skull: ['..WWWWWW..', '.WWWWWWWW.', 'WWWWWWWWWW', 'WW..WW..WW', 'WW..WW..WW', 'WWWWWWWWWW', '.WWW..WWW.', '..WWWWWW..', '..W.W.W.W.', '....R.R...'],
  pierce: ['..........', '......O...', '.......O..', 'OOOOOOOOO.', 'GGGGGGGGGO', 'OOOOOOOOO.', '.......O..', '......O...', '..........', '..........'],
  reach: ['.....CCC..', '.......CC.', '........C.', '.........C', '.........C', '.........C', '........C.', '.......CC.', '.....CCC..', '..........'],
  spin: ['...OOOO...', '..O....O..', '.O......O.', 'O...OO..O.', 'O..O..O...', 'O..O..O..O', '...O..O..O', '.O..OO..O.', '..O....O..', '...OOOO...'],
};

// 流派 → 卡片配色
export const RARITY = { '通用': 'r-gold', '站定流派': 'r-arcane', '翻滚流派': 'r-frost', '走位流派': 'r-moss', '职业专属': 'r-ember' };

// once：一局只能拿一次；cls：只给指定职业
export const BLESSINGS = [
  { id: 'rate',   icon: 'fire',    name: '疾咏',   tag: '通用',     desc: '攻击速度提高 30%。', apply: m => { m.rateMul *= 1.3; } },
  { id: 'dmg',    icon: 'sword',   name: '圣铸',   tag: '通用',     desc: '攻击伤害提高（法师 +1，骑士 +2）。', apply: m => { m.dmgAdd += 1; } },
  { id: 'crit',   icon: 'eye',     name: '锐眼',   tag: '通用',     desc: '暴击率 +15%，暴击造成双倍伤害。', apply: m => { m.critAdd += 0.15; } },
  { id: 'tough',  icon: 'heart',   name: '坚韧',   tag: '通用',     desc: '生命上限 +2，并回满生命。', apply: (m, p) => { p.maxHp += 2; p.hp = p.maxHp; } },
  { id: 'leech',  icon: 'skull',   name: '噬魂',   tag: '通用',     once: true, desc: '每击杀 10 个敌人，恢复 1 点生命。', apply: m => { m.leech = true; } },
  { id: 'charge', icon: 'still',   name: '静谧',   tag: '站定流派', once: true, desc: '连续站定超过 1.2 秒后，攻击伤害翻倍。', apply: m => { m.charge = true; } },
  { id: 'shock',  icon: 'wave',    name: '落地震', tag: '翻滚流派', once: true, desc: '翻滚结束时释放冲击波，击退周围敌人并造成 2 点伤害。', apply: m => { m.rollShock = true; } },
  { id: 'nimble', icon: 'feather', name: '轻身',   tag: '翻滚流派', desc: '翻滚冷却缩短 30%。', apply: m => { m.rollCdMul *= 0.7; } },
  { id: 'regen',  icon: 'leaf',    name: '行者',   tag: '走位流派', once: true, desc: '移动时每 6 秒恢复 1 点生命。', apply: m => { m.regen = true; } },
  { id: 'split',  icon: 'split',   name: '三叉光', tag: '职业专属', cls: 'mage', desc: '每次额外射出 1 枚飞弹，呈扇形散开。', apply: m => { m.extraShots += 1; } },
  { id: 'pierce', icon: 'pierce',  name: '贯穿',   tag: '职业专属', cls: 'mage', desc: '飞弹可以多穿透 1 个敌人。', apply: m => { m.pierce += 1; } },
  { id: 'reach',  icon: 'reach',   name: '剑气',   tag: '职业专属', cls: 'knight', desc: '挥砍范围扩大 1.2 格。', apply: m => { m.reachAdd += 1.2; } },
  { id: 'whirl',  icon: 'spin',    name: '回旋斩', tag: '职业专属', cls: 'knight', once: true, desc: '每第 3 次挥砍变为 360° 回旋斩。', apply: m => { m.spinEvery = 3; } },
];

// 新开一局时的祝福效果初始值
export const freshMods = () => ({
  rateMul: 1, dmgAdd: 0, extraShots: 0, pierce: 0, charge: false, rollShock: false, rollCdMul: 1, regen: false,
  reachAdd: 0, spinEvery: 0, leech: false, critAdd: 0, taken: [],
});
