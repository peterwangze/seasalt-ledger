import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeText, detectImportSource, parseDelimitedText, tableFromRows } from '../import/table';
import { analyzeTables } from '../import/analyze';
import { parseDateValue, parseTimeValue, parseTransactionType } from '../import/parseValues';
import { parseAmount } from '../money';

function readFixtureTable() {
  const buffer = readFileSync(resolve('src/lib/__tests__/fixtures/shark-gbk.csv'));
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const text = decodeText(arrayBuffer);
  return tableFromRows('shark-gbk.csv', parseDelimitedText(text).rows);
}

describe('shark csv import', () => {
  it('decodes GBK and builds the table', () => {
    const table = readFixtureTable();
    expect(table.headers).toEqual(['日期', '收支类型', '类别', '账户', '金额', '备注']);
    expect(table.rows).toHaveLength(6);
  });

  it('keeps repeated purchases as separate records', () => {
    const result = analyzeTables([readFixtureTable()]);
    expect(result.summary.validCount).toBe(4);
    expect(result.summary.skippedCount).toBe(2);
    expect(result.summary.expenseCount).toBe(3);
    expect(result.summary.incomeCount).toBe(1);
    expect(result.summary.expenseTotal).toBe(51.5);
    expect(result.summary.incomeTotal).toBe(28000);
    expect(result.summary.minDate).toBe('2026-10-20');
    expect(result.summary.maxDate).toBe('2026-10-21');
    expect(result.summary.categoryNames).toContain('彩票');
    expect(result.summary.categoryNames).toContain('餐饮');
    const lottery = result.records.filter((record) => record.categoryName === '彩票');
    expect(lottery).toHaveLength(2);
    expect(lottery.map((record) => record.occurrence).sort()).toEqual([1, 2]);
  });

  it('accepts split expense and income columns', () => {
    const table = tableFromRows('split.csv', [
      ['日期', '分类', '支出金额', '收入金额', '备注'],
      ['2024-03-01', '餐饮', '25.5', '', '早餐'],
      ['2024-03-02', '工资', '', '10000', ''],
    ]);
    const result = analyzeTables([table]);
    expect(result.summary.validCount).toBe(2);
    expect(result.summary.expenseTotal).toBe(25.5);
    expect(result.summary.incomeTotal).toBe(10000);
    expect(result.records.map((record) => record.type)).toEqual(['expense', 'income']);
  });

  it('imports Suishouji exports with subcategories, member and project columns', () => {
    const table = tableFromRows('随手记账单.csv', [
      ['日期', '收支', '分类', '子分类', '金额', '备注', '账户', '成员', '项目'],
      ['2026-10-01', '支出', '餐饮', '午餐', '35.50', '牛肉面', '微信', '我', '日常'],
      ['2026-10-02', '收入', '工资', '月薪', '9500', '10月工资', '银行卡', '我', '工作'],
      ['2026-10-03', '支出', '交通', '地铁', '6', '', '支付宝', '我', '日常'],
    ]);
    expect(detectImportSource(table)).toBe('suishouji');
    const result = analyzeTables([table]);
    expect(result.summary.validCount).toBe(3);
    expect(result.summary.expenseTotal).toBe(41.5);
    expect(result.summary.incomeTotal).toBe(9500);
    expect(result.records.map((record) => record.type)).toEqual(['expense', 'income', 'expense']);
    expect(result.records.map((record) => record.categoryName)).toEqual(['午餐', '月薪', '地铁']);
    expect(result.records[0].accountName).toBe('微信');
  });

  it('finds the header after title rows and handles quoted notes', () => {
    const text = [
      '鲨鱼记账明细',
      '',
      '"日期","收支类型","类别","账户","金额","备注"',
      '"2026-10-21","支出","餐饮","微信","15","午餐,咖啡"',
      '"2026-10-22","收入","工资","银行卡","1000","第一行',
      '第二行"',
    ].join('\r\n');
    const parsed = parseDelimitedText(text);
    const table = tableFromRows('titled.csv', parsed.rows);
    expect(table.headerRow).toBe(1);
    const result = analyzeTables([table]);
    expect(result.summary.validCount).toBe(2);
    expect(result.records[0].note).toBe('午餐,咖啡');
    expect(result.records[1].note).toBe('第一行 第二行');
  });
});

describe('value parsing', () => {
  it('parses Chinese dates and times', () => {
    expect(parseDateValue('2021年12月31日')).toEqual({ date: '2021-12-31', time: undefined });
    expect(parseDateValue('2024/1/2 下午3:04')).toEqual({ date: '2024-01-02', time: '15:04' });
    expect(parseDateValue('2026-10-21T08:05:00')).toEqual({ date: '2026-10-21', time: '08:05' });
    expect(parseDateValue('2026.10.21', '19:30')).toEqual({ date: '2026-10-21', time: '19:30' });
    expect(parseDateValue('44197')).toEqual({ date: '2021-01-01', time: undefined });
    expect(parseDateValue('not a date')).toBeNull();
  });

  it('parses Excel time serials', () => {
    expect(parseTimeValue(0.5)).toBe('12:00');
    expect(parseTimeValue('8:05')).toBe('08:05');
  });

  it('parses amounts with currency and separators', () => {
    expect(parseAmount('¥1,234.56')).toBe(1234.56);
    expect(parseAmount('12元')).toBe(12);
    expect(parseAmount('(18.20)')).toBe(18.2);
    expect(parseAmount('abc')).toBeNull();
  });

  it('recognizes transaction types', () => {
    expect(parseTransactionType('支出')).toBe('expense');
    expect(parseTransactionType('收入')).toBe('income');
    expect(parseTransactionType('内部转账')).toBe('transfer');
    expect(parseTransactionType('不计收支')).toBe('ignore');
    expect(parseTransactionType('流出')).toBe('expense');
    expect(parseTransactionType('流入')).toBe('income');
  });
});
