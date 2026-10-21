import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../../types';
import {
  activeMonthCountAll,
  categoryBreakdown,
  getTransactionIndex,
  groupByDay,
  monthTotals,
  monthlyTotalsForYear,
  transactionDateRange,
  uniqueDays,
  weeklyTotals,
  yearlyTotals,
} from '../stats';

const categories: Category[] = [
  { id: 'food', name: '餐饮', type: 'expense', icon: 'utensils', color: '#D97B4F' },
  { id: 'salary', name: '工资', type: 'income', icon: 'briefcase', color: '#4B9A8A' },
];

function tx(
  id: string,
  date: string,
  type: 'expense' | 'income',
  amount: number,
  categoryId: string,
  createdAt = '2026-10-01T00:00:00.000Z',
): Transaction {
  return {
    id,
    type,
    amount,
    categoryId,
    accountId: 'acc',
    date,
    note: '',
    createdAt,
    updatedAt: createdAt,
  };
}

describe('ledger stats', () => {
  const transactions = [
    tx('1', '2026-10-01', 'expense', 20, 'food', '2026-10-01T02:00:00.000Z'),
    tx('2', '2026-10-01', 'expense', 30.5, 'food', '2026-10-01T03:00:00.000Z'),
    tx('3', '2026-10-02', 'income', 1000, 'salary', '2026-10-02T01:00:00.000Z'),
  ];

  it('totals expenses, income and balance', () => {
    expect(monthTotals(transactions)).toMatchObject({
      expense: 50.5,
      income: 1000,
      balance: 949.5,
      count: 3,
    });
  });

  it('groups by day with daily totals', () => {
    const groups = groupByDay(transactions);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2026-10-02');
    expect(groups[1]).toMatchObject({ date: '2026-10-01', expense: 50.5, income: 0 });
  });

  it('calculates category share', () => {
    const slices = categoryBreakdown(transactions, categories, 'expense');
    expect(slices).toHaveLength(1);
    expect(slices[0].total).toBe(50.5);
    expect(slices[0].percent).toBe(100);
  });

  it('counts unique days', () => {
    expect(uniqueDays(transactions)).toBe(2);
  });

  it('groups a month into readable weeks', () => {
    const weeks = weeklyTotals(transactions, '2026-10', 'expense');
    expect(weeks).toHaveLength(5);
    expect(weeks[0].total).toBe(50.5);
    expect(weeks[1].total).toBe(0);
    expect(weeks[4].startDate).toBe('2026-10-29');
    expect(weeks[4].endDate).toBe('2026-10-31');
  });

  it('builds annual monthly series', () => {
    const months = monthlyTotalsForYear(transactions, '2026');
    expect(months).toHaveLength(12);
    expect(months[9]).toMatchObject({
      month: '2026-10',
      expense: 50.5,
      income: 1000,
      balance: 949.5,
      count: 3,
    });
  });

  it('indexes months, years and dates for large ledgers', () => {
    const index = getTransactionIndex(transactions);
    expect(index.byMonth.get('2026-10')).toHaveLength(3);
    expect(index.byYear.get('2026')).toHaveLength(3);
    expect(index.byDate.get('2026-10-01')).toHaveLength(2);
    expect(index.monthSet.has('2026-10')).toBe(true);
    expect(activeMonthCountAll(transactions)).toBe(1);
    expect(getTransactionIndex(transactions)).toBe(index);
  });

  it('aggregates all-time yearly totals and date range', () => {
    const all = [
      ...transactions,
      tx('4', '2024-01-15', 'expense', 12, 'food'),
      tx('5', '2025-06-20', 'income', 200, 'salary'),
    ];
    expect(yearlyTotals(all)).toEqual([
      { year: 2024, expense: 12, income: 0, balance: -12, count: 1 },
      { year: 2025, expense: 0, income: 200, balance: 200, count: 1 },
      { year: 2026, expense: 50.5, income: 1000, balance: 949.5, count: 3 },
    ]);
    expect(transactionDateRange(all)).toEqual({ min: '2024-01-15', max: '2026-10-02' });
  });
});
