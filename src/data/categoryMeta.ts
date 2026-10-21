import type { CategoryType } from '../types';

export const CATEGORY_COLORS = [
  '#D97B4F',
  '#4E89C7',
  '#C66B87',
  '#7B6FC2',
  '#B38257',
  '#4B9A8A',
  '#D0605E',
  '#5A7FA8',
  '#C79A43',
  '#66926B',
  '#C8759D',
  '#6C7BB8',
];

const EXACT_ICONS: Record<string, string> = {
  餐饮: 'utensils',
  交通: 'bus',
  购物: 'shopping-bag',
  娱乐: 'gamepad',
  住房: 'house',
  生活缴费: 'receipt',
  医疗: 'heart-pulse',
  学习: 'book',
  旅行: 'plane',
  通讯: 'smartphone',
  宠物: 'paw',
  运动: 'dumbbell',
  服饰: 'shirt',
  数码: 'laptop',
  人情: 'gift',
  其他: 'shapes',
  工资: 'briefcase',
  奖金: 'award',
  理财收益: 'trending-up',
  兼职: 'clock',
  红包: 'gift',
  退款: 'rotate-ccw',
  其他收入: 'circle-plus',
  彩票: 'ticket',
  充值: 'wallet-cards',
  咖啡: 'coffee',
  零食: 'cookie',
  水果: 'apple',
  蔬菜: 'carrot',
  居家: 'sofa',
  汽车: 'car',
  日用: 'package',
  捐赠: 'hand-heart',
  社交: 'users',
  礼金: 'gift',
  对象: 'heart',
  亲友: 'users',
  婚礼: 'heart-handshake',
  孕产: 'baby',
  父母: 'users',
  孩子: 'baby',
  礼物: 'gift',
};

const ICON_RULES: Array<[RegExp, string]> = [
  [/彩票|抽奖/, 'ticket'],
  [/充值|会员|订阅/, 'wallet-cards'],
  [/外卖|餐饮|早餐|午餐|晚餐|夜宵|美食|咖啡|奶茶|吃饭|饭/, 'utensils'],
  [/零食|小吃/, 'cookie'],
  [/水果/, 'apple'],
  [/蔬菜|买菜|菜场/, 'carrot'],
  [/交通|打车|公交|地铁|出租|滴滴|停车|高速|加油|油费/, 'bus'],
  [/汽车|车险|保养|洗车/, 'car'],
  [/购物|淘宝|京东|拼多多|超市|商场/, 'shopping-bag'],
  [/娱乐|游戏|电影|KTV|唱歌|演出|小说/, 'gamepad'],
  [/住房|房租|房贷|物业/, 'house'],
  [/生活缴费|水费|电费|燃气|取暖/, 'receipt'],
  [/医疗|看病|药|医院|体检|挂号|牙/, 'heart-pulse'],
  [/学习|教育|书|课程|培训|考试|多邻国/, 'book'],
  [/旅行|旅游|酒店|机票|景点|度假/, 'plane'],
  [/通讯|话费|流量|宽带|网费/, 'smartphone'],
  [/宠物|猫|狗|铲屎/, 'paw'],
  [/运动|健身|瑜伽|跑步|球/, 'dumbbell'],
  [/服饰|衣服|鞋|包|穿搭/, 'shirt'],
  [/数码|电子|电脑|相机|耳机/, 'laptop'],
  [/居家|家具|家装|日用|家居/, 'sofa'],
  [/捐赠|公益|慈善/, 'hand-heart'],
  [/社交|聚会|请客|朋友/, 'users'],
  [/工资|薪资|薪酬|薪水/, 'briefcase'],
  [/奖金|年终奖|绩效/, 'award'],
  [/理财|投资|收益|利息|基金|股票|分红/, 'trending-up'],
  [/兼职|副业|外快/, 'clock'],
  [/退款|报销|返还/, 'rotate-ccw'],
  [/红包|礼金|礼物|人情/, 'gift'],
  [/婚礼|结婚|婚庆/, 'heart-handshake'],
  [/孕产|怀孕|产检/, 'baby'],
  [/孩子|宝宝|母婴|奶粉|尿布/, 'baby'],
  [/父母|爸妈|长辈/, 'users'],
  [/对象|恋爱|情侣/, 'heart'],
  [/其他|其它/, 'shapes'],
];

export function iconForCategory(name: string): string {
  const clean = name.trim();
  if (EXACT_ICONS[clean]) return EXACT_ICONS[clean];
  for (const [pattern, icon] of ICON_RULES) {
    if (pattern.test(clean)) return icon;
  }
  return 'tag';
}

export function colorForCategory(name: string, type: CategoryType): string {
  let hash = type === 'income' ? 7 : 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

export const ACCOUNT_COLORS = ['#4B9A8A', '#4E89C7', '#C79A43', '#D97B4F', '#7B6FC2', '#C66B87'];

export function iconForAccount(name: string): string {
  if (/微信|wechat/i.test(name)) return 'message-circle';
  if (/支付宝|alipay/i.test(name)) return 'wallet';
  if (/银行|储蓄|信用卡|借记/.test(name)) return 'landmark';
  if (/现金|钱包/.test(name)) return 'banknote';
  if (/未关联|未指定|默认/.test(name)) return 'circle-help';
  return 'credit-card';
}

export function colorForAccount(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 33 + name.charCodeAt(i)) >>> 0;
  }
  return ACCOUNT_COLORS[hash % ACCOUNT_COLORS.length];
}

export function normalizeCategoryName(name: string, type: CategoryType): string {
  const clean = name.replace(/[\s​]+/g, '').trim();
  if (!clean) return type === 'income' ? '其他收入' : '其他';
  if (type === 'expense' && (clean === '其它' || clean === '其他')) return '其他';
  if (type === 'income' && (clean === '其它' || clean === '其他')) return '其他收入';
  return clean;
}

export function normalizeAccountName(name: string): string {
  const clean = name.replace(/\s+/g, '').trim();
  if (!clean || /未关联|未指定|无账户/.test(clean)) return '未关联';
  if (/微信支付|微信零钱/.test(clean)) return '微信';
  if (/支付宝余额|余额宝/.test(clean)) return '支付宝';
  return clean;
}

export function isIncomeCategoryName(name: string): boolean {
  return /工资|薪资|薪酬|奖金|收入|红包|礼金|退款|报销|理财|收益|利息|分红|兼职|外快|入账/.test(name);
}
