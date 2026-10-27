// 房间布局。w、d 是地砖格数（每格 4 米，宽度取奇数让北门居中）。
// props: [模型, x, z, 朝向]；torches / banners: [墙面 N/W/E, 沿墙位置]
export const LAYOUTS = [
  { id: 'hall', name: '幽暗门厅', w: 5, d: 5,
    props: [['barrel', -8.3, -8.3], ['barrel', -6.6, -8.6], ['boxes', 7.6, -7.4, 0.5], ['rubble', -10, 6, 0], ['barrel', 8.4, 7.6]],
    torches: [['N', -6], ['N', 6], ['W', -3], ['E', -3]], banners: [['N', -3.2], ['N', 3.2]] },
  { id: 'corridor', name: '石柱长廊', w: 7, d: 5,
    props: [['pillar', -6, -3], ['pillar', 6, -3], ['pillar', -6, 4.5], ['pillar', 6, 4.5], ['boxes', -11.4, -7.4, 0.3], ['barrel', 12, -8.2], ['barrel', 12.2, 7.8], ['rubble', 10, 3, Math.PI]],
    torches: [['N', -10], ['N', -5], ['N', 5], ['N', 10], ['W', 0]], banners: [['N', -3.2], ['N', 3.2], ['E', -4]] },
  { id: 'cross', name: '十字墓室', w: 7, d: 7,
    props: [['pillar', -2.2, -2.2], ['pillar', 2.2, -2.2], ['pillar', -2.2, 2.2], ['pillar', 2.2, 2.2], ['boxes', -11.5, -11.5, 0], ['boxes', 11.5, 11.5, 1.2], ['barrel', 11.8, -12], ['barrel', -12, 11.8]],
    torches: [['N', -8], ['N', 8], ['W', -6], ['E', -6], ['E', 6]], banners: [['N', -3.2], ['N', 3.2]] },
  { id: 'gallery', name: '石棺回廊', w: 9, d: 5,
    props: [['barrel', -13, -5], ['barrel', -13, 0], ['barrel', -13, 5], ['barrel', 13, -5], ['barrel', 13, 0], ['barrel', 13, 5], ['pillar', -6, 0], ['pillar', 6, 0]],
    torches: [['N', -12], ['N', -6], ['N', 6], ['N', 12], ['W', 0]], banners: [['N', -3.2], ['N', 3.2], ['N', -9], ['N', 9]] },
  { id: 'well', name: '枯井密室', w: 5, d: 7,
    props: [['rubble', -10, -6, 0], ['rubble', 10, 4, Math.PI], ['pillar', 0, -1], ['barrel', -8, 10], ['barrel', 8, -10.5]],
    torches: [['N', -6], ['N', 6], ['W', -7], ['E', -7], ['W', 5]], banners: [['N', -3.2], ['N', 3.2]] },
  { id: 'ossuary', name: '藏骨堂', w: 7, d: 5,
    props: [['boxes', -9, -6.5, 0.2], ['boxes', 9, -6.5, -0.2], ['barrel', -3.5, 3], ['barrel', 3.5, 3], ['rubble', -14, -2, 0], ['rubble', 14, -2, Math.PI]],
    torches: [['N', -10], ['N', -5], ['N', 5], ['N', 10], ['E', 3]], banners: [['N', -3.2], ['N', 3.2], ['W', 3]] },
];

// 首领房：四根石柱可以挡弹幕
export const ARENA = { id: 'arena', name: '首领之间', w: 7, d: 7,
  props: [['pillar', -8, -7.5], ['pillar', 8, -7.5], ['pillar', -8, 7], ['pillar', 8, 7], ['barrel', -12.4, -12.2], ['barrel', 12.4, -12.2]],
  torches: [['N', -9], ['N', 9], ['W', -5], ['E', -5], ['W', 6]], banners: [['N', -3.2], ['N', 3.2], ['W', 2], ['E', 2]] };

// 道具的碰撞半径
export const PROP_R = { barrel: 0.95, boxes: 1.9, pillar: 0.85, rubble: 1.5, chest: 1.1 };

// 战役的三层：敌人池、首领、首领房名
export const FLOORS = [
  { name: '地牢浅层', pool: ['minion', 'minion', 'mage', 'rogue'], boss: 'guardian', arena: '守卫之厅' },
  { name: '骸骨回廊', pool: ['minion', 'mage', 'rogue', 'warrior'], boss: 'warlord', arena: '战将擂台' },
  { name: '白骨王座', pool: ['minion', 'mage', 'mage', 'rogue', 'warrior', 'warrior'], boss: 'archlich', arena: '大巫祭坛' },
];
