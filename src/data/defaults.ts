import type { Account, Category, LedgerState, Settings } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: '餐饮', type: 'expense', icon: 'utensils', color: '#D97B4F' },
  { id: 'cat-transport', name: '交通', type: 'expense', icon: 'bus', color: '#4E89C7' },
  { id: 'cat-shopping', name: '购物', type: 'expense', icon: 'shopping-bag', color: '#C66B87' },
  { id: 'cat-fun', name: '娱乐', type: 'expense', icon: 'gamepad', color: '#7B6FC2' },
  { id: 'cat-home', name: '住房', type: 'expense', icon: 'house', color: '#B38257' },
  { id: 'cat-bills', name: '生活缴费', type: 'expense', icon: 'receipt', color: '#4B9A8A' },
  { id: 'cat-health', name: '医疗', type: 'expense', icon: 'heart-pulse', color: '#D0605E' },
  { id: 'cat-study', name: '学习', type: 'expense', icon: 'book', color: '#5A7FA8' },
  { id: 'cat-travel', name: '旅行', type: 'expense', icon: 'plane', color: '#4E89C7' },
  { id: 'cat-comm', name: '通讯', type: 'expense', icon: 'smartphone', color: '#6C7BB8' },
  { id: 'cat-pet', name: '宠物', type: 'expense', icon: 'paw', color: '#C79A43' },
  { id: 'cat-sport', name: '运动', type: 'expense', icon: 'dumbbell', color: '#66926B' },
  { id: 'cat-clothes', name: '服饰', type: 'expense', icon: 'shirt', color: '#C8759D' },
  { id: 'cat-digital', name: '数码', type: 'expense', icon: 'laptop', color: '#73899B' },
  { id: 'cat-social', name: '人情', type: 'expense', icon: 'gift', color: '#D97B4F' },
  { id: 'cat-other', name: '其他', type: 'expense', icon: 'shapes', color: '#8B938E' },
  { id: 'cat-salary', name: '工资', type: 'income', icon: 'briefcase', color: '#4B9A8A' },
  { id: 'cat-bonus', name: '奖金', type: 'income', icon: 'award', color: '#C79A43' },
  { id: 'cat-invest', name: '理财收益', type: 'income', icon: 'trending-up', color: '#4E89C7' },
  { id: 'cat-side', name: '兼职', type: 'income', icon: 'clock', color: '#7B6FC2' },
  { id: 'cat-redpacket', name: '红包', type: 'income', icon: 'gift', color: '#D0605E' },
  { id: 'cat-refund', name: '退款', type: 'income', icon: 'rotate-ccw', color: '#66926B' },
  { id: 'cat-other-income', name: '其他收入', type: 'income', icon: 'circle-plus', color: '#8B938E' },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-wechat', name: '微信', icon: 'message-circle', color: '#4B9A8A' },
  { id: 'acc-alipay', name: '支付宝', icon: 'wallet', color: '#4E89C7' },
  { id: 'acc-bank', name: '银行卡', icon: 'landmark', color: '#C79A43' },
  { id: 'acc-cash', name: '现金', icon: 'banknote', color: '#66926B' },
  { id: 'acc-none', name: '未关联', icon: 'circle-help', color: '#8B938E' },
];

export const DEFAULT_SETTINGS: Settings = {
  monthlyBudget: 0,
  defaultAccountId: 'acc-wechat',
};

export function createInitialState(): LedgerState {
  return {
    version: 1,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    accounts: DEFAULT_ACCOUNTS.map((account) => ({ ...account })),
    settings: { ...DEFAULT_SETTINGS },
    importBatches: [],
  };
}

export const DEFAULT_EXPENSE_CATEGORY_ID = 'cat-food';
export const DEFAULT_INCOME_CATEGORY_ID = 'cat-salary';
