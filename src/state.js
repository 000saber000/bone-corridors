import { store } from './config.js';

// 游戏运行时的可变状态集中放在这里，各模块通过 S.xxx 读写
export const S = {
  mode: 'loading',   // loading | menu | select | play | upgrade | transition | over-pending | over
  paused: false,
  T: 0,              // 本局游戏时间（秒），暂停、顿帧时不走
  run: null,         // { mode: 'campaign' | 'endless', cls, floor, room, depth }
  room: null,
  obstacles: [],
  player: null,
  enemies: [],
  mods: null,        // 本局已获得的祝福效果
  stats: { kills: 0, dodges: 0 },
  shake: 0, hitstop: 0, slowmo: 0, heroPulse: 0,
  selMode: 'campaign',
  selHero: store.get('bonecorr.hero') === 'knight' ? 'knight' : 'mage',
  lastLayout: null,
  offered: [],
  absorbing: false,
};

// 每帧更新的对象列表（只增删元素，不整体替换）
export const bolts = [];  // 法师飞弹
export const shots = [];  // 敌方弹幕
export const parts = [];  // 粒子
export const fx = [];     // 一次性特效（光环、剑光、光柱）
