import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';
import { buildMonthCalendar, defaultCalendarDay, expenseHeat } from '../calendar';

function tx(id: string, date: string, type: 'expense' | 'income', amount: number): Transaction {
  return {
    id,
    type,
    amount,
    categoryId: 'food',
    accountId: 'acc',
    date,
    note: '',
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe('month calendar', () => {
  const transactions = [
    tx('1', '2024-06-01', 'expense', 20),
    tx('2', '2024-06-01', 'expense', 30),
    tx('3', '2024-06-15', 'income', 500),
    tx('4', '2024-06-30', 'expense', 100),
  ];

  it('builds weekday offsets and daily totals', () => {
    const calendar = buildMonthCalendar(transactions, '2024-06');
    // 2024-06-01 was a Saturday.
    expect(calendar.leadingBlanks).toBe(6);
    expect(calendar.days).toHaveLength(30);
    expect(calendar.cells.length % 7).toBe(0);
    expect(calendar.days[0]).toMatchObject({ date: '2024-06-01', expense: 50, income: 0, count: 2 });
    expect(calendar.days[14]).toMatchObject({ expense: 0, income: 500, count: 1 });
    expect(calendar.maxExpense).toBe(100);
  });

  it('selects the biggest spending day for a historical month', () => {
    const calendar = buildMonthCalendar(transactions, '2024-06');
    expect(defaultCalendarDay(calendar)).toBe(30);
  });

  it('normalizes heat into a usable range', () => {
    expect(expenseHeat(0, 100)).toBe(0);
    expect(expenseHeat(100, 100)).toBe(1);
    expect(expenseHeat(25, 100)).toBe(0.5);
  });
});
