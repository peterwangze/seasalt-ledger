import type { LedgerState, Transaction } from '../types';
import { createInitialState } from '../data/defaults';
import { addMonths, daysInMonth, parseISODate, todayISO } from './date';
import { uid } from './id';

interface DemoRow {
  type: 'expense' | 'income';
  amount: number;
  categoryId: string;
  note: string;
  time?: string;
  accountId?: string;
  /** Days back from today. */
  back: number;
}

const CURRENT_ROWS: DemoRow[] = [
  { type: 'expense', amount: 32, categoryId: 'cat-food', note: '手冲咖啡和可颂', time: '08:26', back: 0 },
  { type: 'expense', amount: 18, categoryId: 'cat-transport', note: '地铁通勤', time: '09:02', back: 0 },
  { type: 'expense', amount: 68, categoryId: 'cat-food', note: '晚饭 · 越南粉', time: '19:12', back: 1 },
  { type: 'expense', amount: 45, categoryId: 'cat-fun', note: '周末电影', time: '21:40', back: 2 },
  { type: 'expense', amount: 268, categoryId: 'cat-shopping', note: '替换旧台灯', time: '14:08', back: 3 },
  { type: 'expense', amount: 26.5, categoryId: 'cat-food', note: '楼下水果店', time: '18:22', back: 4 },
  { type: 'income', amount: 386.4, categoryId: 'cat-invest', note: '基金分红', back: 5 },
  { type: 'expense', amount: 128, categoryId: 'cat-study', note: '一本想看很久的书', time: '20:16', back: 6 },
  { type: 'expense', amount: 3200, categoryId: 'cat-home', note: '房租', time: '10:00', back: 7 },
  { type: 'expense', amount: 89, categoryId: 'cat-health', note: '常备药和维生素', time: '17:32', back: 8 },
  { type: 'expense', amount: 42, categoryId: 'cat-food', note: '工作日午餐', time: '12:18', back: 9 },
  { type: 'expense', amount: 186.6, categoryId: 'cat-bills', note: '水电燃气', time: '09:45', back: 10 },
  { type: 'income', amount: 28000, categoryId: 'cat-salary', note: '这个月也辛苦啦', time: '10:28', back: 11 },
  { type: 'expense', amount: 35, categoryId: 'cat-transport', note: '打车去朋友家', time: '20:05', back: 12 },
  { type: 'expense', amount: 156, categoryId: 'cat-food', note: '和朋友吃火锅', time: '19:30', back: 13 },
  { type: 'expense', amount: 42.9, categoryId: 'cat-comm', note: '月度套餐', time: '08:00', back: 14 },
  { type: 'expense', amount: 66, categoryId: 'cat-pet', note: '猫砂和罐头', time: '16:20', back: 15 },
  { type: 'expense', amount: 22, categoryId: 'cat-social', note: '给同事的生日礼物', time: '13:10', back: 16 },
  { type: 'expense', amount: 199, categoryId: 'cat-clothes', note: '换季的薄外套', time: '15:22', back: 18 },
  { type: 'expense', amount: 12, categoryId: 'cat-sport', note: '共享单车月卡', time: '07:50', back: 20 },
  { type: 'expense', amount: 28, categoryId: 'cat-food', note: '早餐和豆浆', time: '08:14', back: 21 },
  { type: 'expense', amount: 599, categoryId: 'cat-digital', note: '降噪耳机', time: '22:06', back: 23 },
];

const PREVIOUS_ROWS: DemoRow[] = [
  { type: 'expense', amount: 3200, categoryId: 'cat-home', note: '房租', back: 34 },
  { type: 'expense', amount: 1280, categoryId: 'cat-travel', note: '周末去海边', back: 37 },
  { type: 'income', amount: 28000, categoryId: 'cat-salary', note: '工资', back: 39 },
  { type: 'expense', amount: 428, categoryId: 'cat-shopping', note: '日用品补货', back: 41 },
  { type: 'expense', amount: 320, categoryId: 'cat-food', note: '朋友聚餐', back: 44 },
  { type: 'expense', amount: 198, categoryId: 'cat-bills', note: '电费', back: 47 },
  { type: 'expense', amount: 120, categoryId: 'cat-transport', note: '交通卡充值', back: 50 },
];

function dateBack(back: number): { date: string; time?: string } {
  const date = parseISODate(todayISO());
  date.setDate(date.getDate() - back);
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  };
}

export function createDemoState(): LedgerState {
  const base = createInitialState();
  const now = Date.now();
  const transactions: Transaction[] = [];
  const rows = [...CURRENT_ROWS, ...PREVIOUS_ROWS];

  rows.forEach((row, index) => {
    const { date } = dateBack(row.back);
    const created = new Date(now - index * 60_000).toISOString();
    transactions.push({
      id: uid('demo'),
      type: row.type,
      amount: row.amount,
      categoryId: row.categoryId,
      accountId: row.accountId ?? (index % 4 === 0 ? 'acc-alipay' : 'acc-wechat'),
      date,
      time: row.time,
      note: row.note,
      createdAt: created,
      updatedAt: created,
    });
  });

  return {
    ...base,
    settings: {
      ...base.settings,
      monthlyBudget: 8000,
    },
    transactions,
  };
}

/** Keep month helpers referenced for future demo variations. */
export const demoMonths = {
  current: todayISO().slice(0, 7),
  previous: addMonths(todayISO().slice(0, 7), -1),
  daysInMonth,
};
