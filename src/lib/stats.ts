import type { Category, Transaction } from '../types';
import { daysInMonth, monthOf, parseISODate, todayISO } from './date';
import { percent, roundMoney, sum } from './money';

export interface MonthTotals {
  expense: number;
  income: number;
  balance: number;
  transfer: number;
  count: number;
}

export interface TransactionIndex {
  byMonth: Map<string, Transaction[]>;
  byYear: Map<string, Transaction[]>;
  byDate: Map<string, Transaction[]>;
  monthSet: Set<string>;
  yearSet: Set<number>;
  categoryCounts: {
    expense: Map<string, number>;
    income: Map<string, number>;
  };
}

const transactionIndexCache = new WeakMap<Transaction[], TransactionIndex>();

/**
 * Builds month/year/day indexes once per transactions array. Pages mount and
 * unmount on every tab switch, so recomputing six years of data each time is
 * unnecessary work.
 */
export function getTransactionIndex(transactions: Transaction[]): TransactionIndex {
  const cached = transactionIndexCache.get(transactions);
  if (cached) return cached;

  const byMonth = new Map<string, Transaction[]>();
  const byYear = new Map<string, Transaction[]>();
  const byDate = new Map<string, Transaction[]>();
  const monthSet = new Set<string>();
  const yearSet = new Set<number>();
  const categoryCounts = {
    expense: new Map<string, number>(),
    income: new Map<string, number>(),
  };

  for (const transaction of transactions) {
    const month = transaction.date.slice(0, 7);
    const year = transaction.date.slice(0, 4);
    const monthList = byMonth.get(month) ?? [];
    monthList.push(transaction);
    byMonth.set(month, monthList);
    const yearList = byYear.get(year) ?? [];
    yearList.push(transaction);
    byYear.set(year, yearList);
    const dateList = byDate.get(transaction.date) ?? [];
    dateList.push(transaction);
    byDate.set(transaction.date, dateList);
    monthSet.add(month);
    yearSet.add(Number(year));
    if (transaction.categoryId && (transaction.type === 'expense' || transaction.type === 'income')) {
      const counts = categoryCounts[transaction.type];
      counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
    }
  }

  const index: TransactionIndex = { byMonth, byYear, byDate, monthSet, yearSet, categoryCounts };
  transactionIndexCache.set(transactions, index);
  return index;
}

export function transactionsInMonth(transactions: Transaction[], month: string): Transaction[] {
  return getTransactionIndex(transactions).byMonth.get(month) ?? [];
}

export function monthTotals(transactions: Transaction[]): MonthTotals {
  let expense = 0;
  let income = 0;
  let transfer = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'expense') expense += transaction.amount;
    else if (transaction.type === 'income') income += transaction.amount;
    else transfer += transaction.amount;
  }
  return {
    expense: roundMoney(expense),
    income: roundMoney(income),
    balance: roundMoney(income - expense),
    transfer: roundMoney(transfer),
    count: transactions.length,
  };
}

export interface DayGroup {
  date: string;
  transactions: Transaction[];
  expense: number;
  income: number;
}

export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const map = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const list = map.get(transaction.date) ?? [];
    list.push(transaction);
    map.set(transaction.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const sorted = [...list].sort(compareTransactions);
      return {
        date,
        transactions: sorted,
        expense: sum(sorted.filter((item) => item.type === 'expense').map((item) => item.amount)),
        income: sum(sorted.filter((item) => item.type === 'income').map((item) => item.amount)),
      };
    });
}

export function compareTransactions(a: Transaction, b: Transaction): number {
  const dateCompare = b.date.localeCompare(a.date);
  if (dateCompare !== 0) return dateCompare;
  const timeA = a.time || '00:00';
  const timeB = b.time || '00:00';
  const timeCompare = timeB.localeCompare(timeA);
  if (timeCompare !== 0) return timeCompare;

  // Shark exports often contain no time column. For rows from the same source
  // file, the later row is the later record in that export, so show it first.
  const aSource = a.importRef;
  const bSource = b.importRef;
  if (aSource && bSource && aSource.sourceFile === bSource.sourceFile
    && aSource.sourceRow !== undefined && bSource.sourceRow !== undefined) {
    const rowCompare = bSource.sourceRow - aSource.sourceRow;
    if (rowCompare !== 0) return rowCompare;
  }
  return b.createdAt.localeCompare(a.createdAt);
}

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(compareTransactions);
}

export function frequentCategories(
  transactions: Transaction[],
  categories: Category[],
  type: 'expense' | 'income',
  limit = 7,
): Category[] {
  const counts = getTransactionIndex(transactions).categoryCounts[type];
  return categories
    .filter((category) => category.type === type)
    .sort((a, b) => {
      const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return 0;
    })
    .slice(0, limit);
}

export interface CategorySlice {
  category: Category;
  total: number;
  count: number;
  percent: number;
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: 'expense' | 'income',
): CategorySlice[] {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const totals = new Map<string, { total: number; count: number }>();
  for (const transaction of transactions) {
    if (transaction.type !== type || !transaction.categoryId) continue;
    const previous = totals.get(transaction.categoryId) ?? { total: 0, count: 0 };
    previous.total += transaction.amount;
    previous.count += 1;
    totals.set(transaction.categoryId, previous);
  }
  const all = [...totals.entries()]
    .map(([id, value]) => ({
      category: categoryMap.get(id) ?? {
        id,
        name: '未分类',
        type,
        icon: 'shapes',
        color: '#8B938E',
      },
      total: roundMoney(value.total),
      count: value.count,
      percent: 0,
    }))
    .sort((a, b) => b.total - a.total);
  const overall = sum(all.map((item) => item.total));
  return all.map((item) => ({ ...item, percent: percent(item.total, overall) }));
}

export interface DailyPoint {
  day: number;
  date: string;
  total: number;
}

export function dailyTotals(
  transactions: Transaction[],
  month: string,
  type: 'expense' | 'income',
): DailyPoint[] {
  const count = daysInMonth(month);
  const values = new Array<number>(count).fill(0);
  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    const day = Number(transaction.date.slice(8, 10));
    if (day >= 1 && day <= count) values[day - 1] += transaction.amount;
  }
  return values.map((total, index) => ({
    day: index + 1,
    date: `${month}-${String(index + 1).padStart(2, '0')}`,
    total: roundMoney(total),
  }));
}

export interface WeekPoint {
  week: number;
  startDate: string;
  endDate: string;
  total: number;
}

export function weeklyTotals(
  transactions: Transaction[],
  month: string,
  type: 'expense' | 'income',
): WeekPoint[] {
  const count = daysInMonth(month);
  const result: WeekPoint[] = [];
  for (let start = 1; start <= count; start += 7) {
    const end = Math.min(start + 6, count);
    const startDate = `${month}-${String(start).padStart(2, '0')}`;
    const endDate = `${month}-${String(end).padStart(2, '0')}`;
    const total = sum(
      transactions
        .filter((transaction) => {
          const day = Number(transaction.date.slice(8, 10));
          return transaction.type === type && day >= start && day <= end;
        })
        .map((transaction) => transaction.amount),
    );
    result.push({ week: result.length + 1, startDate, endDate, total });
  }
  return result;
}

export function comparisonWindow(month: string): { currentDays: number; previousMonth: string } {
  const current = todayISO().slice(0, 7);
  let currentDays = daysInMonth(month);
  if (month === current) {
    currentDays = parseISODate(todayISO()).getDate();
  } else if (month > current) {
    currentDays = 0;
  }
  const [y, m] = month.split('-').map(Number);
  const previousDate = new Date(y, m - 2, 1);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
  return { currentDays, previousMonth };
}

export function totalThroughDay(transactions: Transaction[], type: 'expense' | 'income', maxDay: number): number {
  return sum(
    transactions
      .filter((transaction) => transaction.type === type && Number(transaction.date.slice(8, 10)) <= maxDay)
      .map((transaction) => transaction.amount),
  );
}

export function dayCountForAverage(month: string): number {
  const current = todayISO().slice(0, 7);
  if (month === current) return parseISODate(todayISO()).getDate();
  if (month > current) return 0;
  return daysInMonth(month);
}

export function uniqueDays(transactions: Transaction[]): number {
  return new Set(transactions.map((transaction) => transaction.date)).size;
}

export interface MonthPoint {
  month: string;
  monthNumber: number;
  expense: number;
  income: number;
  balance: number;
  count: number;
}

export function transactionsInYear(transactions: Transaction[], year: string | number): Transaction[] {
  return getTransactionIndex(transactions).byYear.get(String(year)) ?? [];
}

export interface YearPoint {
  year: number;
  expense: number;
  income: number;
  balance: number;
  count: number;
}

/** Aggregates all transactions by calendar year, sorted oldest first. */
export function yearlyTotals(transactions: Transaction[]): YearPoint[] {
  const totals = new Map<number, YearPoint>();
  for (const transaction of transactions) {
    const year = Number(transaction.date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const point = totals.get(year) ?? { year, expense: 0, income: 0, balance: 0, count: 0 };
    if (transaction.type === 'expense') point.expense += transaction.amount;
    else if (transaction.type === 'income') point.income += transaction.amount;
    point.count += 1;
    totals.set(year, point);
  }
  return [...totals.values()]
    .sort((a, b) => a.year - b.year)
    .map((point) => ({
      ...point,
      expense: roundMoney(point.expense),
      income: roundMoney(point.income),
      balance: roundMoney(point.income - point.expense),
    }));
}

export function transactionDateRange(transactions: Transaction[]): { min?: string; max?: string } {
  let min: string | undefined;
  let max: string | undefined;
  for (const transaction of transactions) {
    if (!min || transaction.date < min) min = transaction.date;
    if (!max || transaction.date > max) max = transaction.date;
  }
  return { min, max };
}

export function monthlyTotalsForYear(transactions: Transaction[], year: string | number): MonthPoint[] {
  const result: MonthPoint[] = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, '0')}`,
    monthNumber: index + 1,
    expense: 0,
    income: 0,
    balance: 0,
    count: 0,
  }));
  for (const transaction of transactionsInYear(transactions, year)) {
    const monthNumber = Number(transaction.date.slice(5, 7));
    const point = result[monthNumber - 1];
    if (!point) continue;
    if (transaction.type === 'expense') point.expense += transaction.amount;
    else if (transaction.type === 'income') point.income += transaction.amount;
    point.count += 1;
  }
  return result.map((point) => ({
    ...point,
    expense: roundMoney(point.expense),
    income: roundMoney(point.income),
    balance: roundMoney(point.income - point.expense),
  }));
}

export function totalInYearThrough(
  transactions: Transaction[],
  year: string | number,
  type: 'expense' | 'income',
  cutoffDate: string,
): number {
  const prefix = `${year}-`;
  return sum(
    transactions
      .filter((transaction) => transaction.type === type && transaction.date.startsWith(prefix) && transaction.date <= cutoffDate)
      .map((transaction) => transaction.amount),
  );
}

export interface YearComparison {
  previous: number;
  diff: number;
  percentChange: number | null;
  label: string;
}

export function yearComparison(
  transactions: Transaction[],
  year: string | number,
  type: 'expense' | 'income',
): YearComparison {
  const now = todayISO();
  const currentYear = Number(now.slice(0, 4));
  const numericYear = Number(year);
  if (numericYear > currentYear) {
    return { previous: 0, diff: 0, percentChange: null, label: '上年同期' };
  }
  const isCurrent = numericYear === currentYear;
  const cutoff = isCurrent ? now : `${numericYear}-12-31`;
  const previousYear = numericYear - 1;
  const previousCutoff = isCurrent
    ? `${previousYear}-${now.slice(5)}`
    : `${previousYear}-12-31`;
  const current = totalInYearThrough(transactions, numericYear, type, cutoff);
  const previous = totalInYearThrough(transactions, previousYear, type, previousCutoff);
  const diff = roundMoney(current - previous);
  return {
    previous,
    diff,
    percentChange: previous > 0 ? (diff / previous) * 100 : null,
    label: isCurrent ? '较上年同期' : '较上年',
  };
}

export function yearAverageDivisor(year: string | number): number {
  const currentYear = Number(todayISO().slice(0, 4));
  const numericYear = Number(year);
  if (numericYear > currentYear) return 1;
  if (numericYear === currentYear) return Math.max(1, Number(todayISO().slice(5, 7)));
  return 12;
}

export function activeMonthCount(transactions: Transaction[], year: string | number): number {
  return new Set(transactionsInYear(transactions, year).map((transaction) => transaction.date.slice(0, 7))).size;
}

export function activeMonthCountAll(transactions: Transaction[]): number {
  return getTransactionIndex(transactions).monthSet.size;
}

export function currentStreak(transactions: Transaction[]): number {
  const days = new Set(transactions.map((transaction) => transaction.date));
  let cursor = todayISO();
  if (!days.has(cursor)) {
    const yesterday = parseISODate(cursor);
    yesterday.setDate(yesterday.getDate() - 1);
    cursor = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  }
  let streak = 0;
  while (days.has(cursor) && streak < 10000) {
    streak += 1;
    const date = parseISODate(cursor);
    date.setDate(date.getDate() - 1);
    cursor = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return streak;
}
