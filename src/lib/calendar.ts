import type { Transaction } from '../types';
import { daysInMonth, parseISODate, todayISO } from './date';
import { roundMoney } from './money';

export interface CalendarCell {
  date: string;
  day: number;
  expense: number;
  income: number;
  count: number;
}

export interface MonthCalendar {
  month: string;
  leadingBlanks: number;
  days: CalendarCell[];
  cells: Array<CalendarCell | null>;
  maxExpense: number;
}

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export function buildMonthCalendar(transactions: Transaction[], month: string): MonthCalendar {
  const totals = new Map<string, { expense: number; income: number; count: number }>();
  for (const transaction of transactions) {
    if (!transaction.date.startsWith(month)) continue;
    const previous = totals.get(transaction.date) ?? { expense: 0, income: 0, count: 0 };
    if (transaction.type === 'expense') previous.expense += transaction.amount;
    else if (transaction.type === 'income') previous.income += transaction.amount;
    previous.count += 1;
    totals.set(transaction.date, previous);
  }

  const count = daysInMonth(month);
  const days: CalendarCell[] = [];
  for (let day = 1; day <= count; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const value = totals.get(date);
    days.push({
      date,
      day,
      expense: roundMoney(value?.expense ?? 0),
      income: roundMoney(value?.income ?? 0),
      count: value?.count ?? 0,
    });
  }

  const leadingBlanks = parseISODate(`${month}-01`).getDay();
  const cells: Array<CalendarCell | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return {
    month,
    leadingBlanks,
    days,
    cells,
    maxExpense: days.reduce((max, day) => Math.max(max, day.expense), 0),
  };
}

export function defaultCalendarDay(calendar: MonthCalendar): number {
  const today = todayISO();
  if (today.startsWith(calendar.month)) return parseISODate(today).getDate();
  const best = calendar.days.reduce((max, day) => (day.expense > max.expense ? day : max), calendar.days[0]);
  return best?.expense ? best.day : 1;
}

export function expenseHeat(expense: number, maxExpense: number): number {
  if (expense <= 0 || maxExpense <= 0) return 0;
  return Math.min(1, Math.sqrt(expense / maxExpense));
}
