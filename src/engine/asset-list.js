// 模型清单（纯数据，网页和构建脚本共用）。
// KayKit 模型已转成内嵌数据的 glTF JSON（public/models/），并去掉了用不到的动画。
// 第二项是文件字节数，用来计算加载进度。新增模型用 npm run convert:model 转换。
export const ASSETS = {
  knight: ['models/Knight.json', 941716], mage: ['models/Mage.json', 756798],
  minion: ['models/Skeleton_Minion.json', 1002867], smage: ['models/Skeleton_Mage.json', 766248],
  warrior: ['models/Skeleton_Warrior.json', 1178129], rogue: ['models/Skeleton_Rogue.json', 1019546],
  floor: ['models/floor_tile_large.json', 37071], wall: ['models/wall.json', 70459], doorway: ['models/wall_doorway.json', 133026],
  gated: ['models/wall_gated.json', 61429], torch: ['models/torch_mounted.json', 43875], pillar: ['models/pillar.json', 33676],
  barrel: ['models/barrel_large.json', 58641], boxes: ['models/box_stacked.json', 195540], banner: ['models/banner_red.json', 31876],
  rubble: ['models/rubble_half.json', 51373], chest: ['models/chest.json', 107416],
};
export const CHAR_KEYS = ['knight', 'mage', 'minion', 'smage', 'warrior', 'rogue'];
// 敌人模型占了一大半体积，但标题画面用不到：先加载英雄和场景，敌人在玩家看标题、选英雄时后台下载
export const ENEMY_KEYS = ['minion', 'smage', 'warrior', 'rogue'];
// 场景小模型有 11 个，构建版把它们合成一个文件：网络延迟高时，请求个数比文件大小更影响速度
export const SCENERY_KEYS = Object.keys(ASSETS).filter(k => !CHAR_KEYS.includes(k));
export const SCENERY_BUNDLE = 'models/scenery.json';
// 标题画面要等的文件（构建版）：页面一打开就开始下载，不用等游戏脚本跑起来
export const FIRST_URLS = [ASSETS.knight[0], ASSETS.mage[0], SCENERY_BUNDLE];
