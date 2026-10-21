import type {
  AnalysisResult,
  ImportFileSummary,
  ImportIssue,
  ImportMapping,
  ImportRecord,
  ImportSummary,
} from '../../types';
import { parseAmount, roundMoney } from '../money';
import { hashString } from '../id';
import {
  isIncomeCategoryName,
  normalizeAccountName,
  normalizeCategoryName,
} from '../../data/categoryMeta';
import { defaultMapping, validateMapping, type RawTable } from './table';
import {
  isNegativeAmount,
  parseDateValue,
  parseTransactionType,
} from './parseValues';

interface FileAnalysis {
  records: ImportRecord[];
  summary: ImportFileSummary;
  categories: Map<string, number>;
  accounts: Map<string, number>;
  issuesAll: ImportIssue[];
}

function fingerprintFor(record: Omit<ImportRecord, 'fingerprint' | 'occurrence'>): string {
  const base = [
    record.date,
    record.time ?? '',
    record.type,
    record.amount.toFixed(2),
    record.categoryName,
    record.accountName,
    record.note,
  ].join('|');
  return `${hashString(base)}${hashString(`${base}#seasalt`)}`;
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u00A0/g, ' ').trim();
}

function isSummaryRow(cells: unknown[]): boolean {
  const joined = cells.map(cellString).join('|');
  return /合计|总计|小计|汇总/.test(joined);
}

function analyzeTable(table: RawTable, mapping: ImportMapping): FileAnalysis {
  const records: ImportRecord[] = [];
  const issues: ImportIssue[] = [];
  const categories = new Map<string, number>();
  const accounts = new Map<string, number>();
  let expenseCount = 0;
  let incomeCount = 0;
  let expenseTotal = 0;
  let incomeTotal = 0;
  let minDate: string | undefined;
  let maxDate: string | undefined;
  let skipped = 0;

  const appendIssue = (row: number, reason: string) => {
    skipped += 1;
    if (issues.length < 30) {
      issues.push({ file: table.fileName, row, reason });
    }
  };

  const mappingErrors = validateMapping(mapping);
  if (mappingErrors.length) {
    appendIssue(0, mappingErrors.join('；'));
    return {
      records,
      summary: {
        fileName: table.fileName,
        sheetName: table.sheetName,
        rowCount: table.rows.length,
        validCount: 0,
        skippedCount: table.rows.length,
        expenseCount: 0,
        incomeCount: 0,
        expenseTotal: 0,
        incomeTotal: 0,
        issues,
      },
      categories,
      accounts,
      issuesAll: issues,
    };
  }

  const indexOf = (header: string) => (header ? table.headers.indexOf(header) : -1);
  const dateIndex = indexOf(mapping.date);
  const timeIndex = indexOf(mapping.time);
  const typeIndex = indexOf(mapping.type);
  const amountIndex = indexOf(mapping.amount);
  const expenseIndex = indexOf(mapping.expenseAmount);
  const incomeIndex = indexOf(mapping.incomeAmount);
  const categoryIndex = indexOf(mapping.category);
  const accountIndex = indexOf(mapping.account);
  const noteIndex = indexOf(mapping.note);
  const merchantIndex = indexOf(mapping.merchant);

  table.rows.forEach((row, rowIndex) => {
    const physicalRow = table.headerRow + rowIndex + 2;
    const dateRaw = dateIndex >= 0 ? row[dateIndex] : '';
    const timeRaw = timeIndex >= 0 ? row[timeIndex] : undefined;
    const parsedDate = parseDateValue(dateRaw, timeRaw);

    if (!parsedDate) {
      if (isSummaryRow(row)) {
        skipped += 1;
        return;
      }
      appendIssue(physicalRow, '日期无法识别');
      return;
    }

    const typeRaw = typeIndex >= 0 ? row[typeIndex] : undefined;
    const explicitType = parseTransactionType(typeRaw);
    if (explicitType === 'ignore') {
      appendIssue(physicalRow, '标记为不计收支，已跳过');
      return;
    }
    if (explicitType === 'transfer') {
      appendIssue(physicalRow, '转账记录需要在应用里手动补记，已跳过');
      return;
    }

    let amountValue: number | null = null;
    let splitType: 'expense' | 'income' | null = null;
    if (amountIndex >= 0) {
      amountValue = parseAmount(row[amountIndex]);
    } else {
      const expenseValue = expenseIndex >= 0 ? parseAmount(row[expenseIndex]) : null;
      const incomeValue = incomeIndex >= 0 ? parseAmount(row[incomeIndex]) : null;
      if (expenseValue && incomeValue) {
        appendIssue(physicalRow, '支出和收入金额同时有值，无法判断');
        return;
      }
      if (incomeValue) {
        amountValue = incomeValue;
        splitType = 'income';
      } else if (expenseValue) {
        amountValue = expenseValue;
        splitType = 'expense';
      }
    }

    if (amountValue === null || !Number.isFinite(amountValue) || amountValue <= 0) {
      appendIssue(physicalRow, '金额无法识别或为 0');
      return;
    }

    const categoryRaw = categoryIndex >= 0 ? cellString(row[categoryIndex]) : '';
    let type: 'expense' | 'income';
    if (explicitType === 'income' || explicitType === 'expense') {
      type = explicitType;
    } else if (splitType) {
      type = splitType;
    } else if (/收入/.test(mapping.amount) && !/支出/.test(mapping.amount)) {
      type = 'income';
    } else if (/支出/.test(mapping.amount)) {
      type = 'expense';
    } else if (categoryRaw && isIncomeCategoryName(categoryRaw)) {
      type = 'income';
    } else if (isNegativeAmount(amountIndex >= 0 ? row[amountIndex] : undefined)) {
      type = 'expense';
    } else {
      type = 'expense';
    }

    const categoryName = normalizeCategoryName(
      categoryRaw || (type === 'income' ? '其他收入' : '其他'),
      type,
    );
    const accountName = normalizeAccountName(accountIndex >= 0 ? cellString(row[accountIndex]) : '未关联');
    const rawNote = noteIndex >= 0 ? cellString(row[noteIndex]) : '';
    const merchant = merchantIndex >= 0 ? cellString(row[merchantIndex]) : '';
    let note = rawNote;
    if (merchant && !rawNote.includes(merchant)) {
      note = rawNote ? `${rawNote} · ${merchant}` : merchant;
    }
    note = note.replace(/\s+/g, ' ').trim().slice(0, 300);

    const base = {
      date: parsedDate.date,
      time: parsedDate.time,
      type,
      amount: roundMoney(amountValue),
      categoryName,
      accountName,
      note,
      sourceFile: table.fileName,
      sourceRow: physicalRow,
    };
    const fingerprint = fingerprintFor(base);
    records.push({ ...base, fingerprint, occurrence: 0 });

    if (type === 'expense') {
      expenseCount += 1;
      expenseTotal += amountValue;
    } else {
      incomeCount += 1;
      incomeTotal += amountValue;
    }
    if (!minDate || parsedDate.date < minDate) minDate = parsedDate.date;
    if (!maxDate || parsedDate.date > maxDate) maxDate = parsedDate.date;
    categories.set(categoryName, (categories.get(categoryName) ?? 0) + 1);
    accounts.set(accountName, (accounts.get(accountName) ?? 0) + 1);
  });

  return {
    records,
    summary: {
      fileName: table.fileName,
      sheetName: table.sheetName,
      rowCount: table.rows.length,
      validCount: records.length,
      skippedCount: skipped,
      expenseCount,
      incomeCount,
      expenseTotal: roundMoney(expenseTotal),
      incomeTotal: roundMoney(incomeTotal),
      minDate,
      maxDate,
      issues,
    },
    categories,
    accounts,
    issuesAll: issues,
  };
}

export function analyzeTables(tables: RawTable[], mappingOverride?: ImportMapping): AnalysisResult {
  const single = tables.length === 1;
  const allRecords: ImportRecord[] = [];
  const allIssues: ImportIssue[] = [];
  const fileSummaries: ImportFileSummary[] = [];
  const categoryCounts = new Map<string, number>();
  const accountCounts = new Map<string, number>();
  let rowCount = 0;
  let skippedCount = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  let expenseTotal = 0;
  let incomeTotal = 0;
  let minDate: string | undefined;
  let maxDate: string | undefined;
  let firstMapping: ImportMapping | undefined;

  for (const table of tables) {
    const mapping = single && mappingOverride ? mappingOverride : defaultMapping(table);
    if (!firstMapping) firstMapping = mapping;
    const analysis = analyzeTable(table, mapping);
    allRecords.push(...analysis.records);
    allIssues.push(...analysis.issuesAll);
    fileSummaries.push(analysis.summary);
    rowCount += analysis.summary.rowCount;
    skippedCount += analysis.summary.skippedCount;
    expenseCount += analysis.summary.expenseCount;
    incomeCount += analysis.summary.incomeCount;
    expenseTotal += analysis.summary.expenseTotal;
    incomeTotal += analysis.summary.incomeTotal;
    if (analysis.summary.minDate && (!minDate || analysis.summary.minDate < minDate)) minDate = analysis.summary.minDate;
    if (analysis.summary.maxDate && (!maxDate || analysis.summary.maxDate > maxDate)) maxDate = analysis.summary.maxDate;
    for (const [name, count] of analysis.categories) {
      categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + count);
    }
    for (const [name, count] of analysis.accounts) {
      accountCounts.set(name, (accountCounts.get(name) ?? 0) + count);
    }
  }

  // Occurrence-aware fingerprints: identical rows in one import stay distinct,
  // while a repeated import can be recognised later.
  const occurrences = new Map<string, number>();
  for (const record of allRecords) {
    const next = (occurrences.get(record.fingerprint) ?? 0) + 1;
    occurrences.set(record.fingerprint, next);
    record.occurrence = next;
  }

  const hashBase = allRecords.map((record) => record.fingerprint).join('|');
  const hash = allRecords.length ? `${hashString(hashBase)}${hashString(hashBase.split('').reverse().join(''))}` : '';
  const fileNames = tables.map((table) => table.fileName).join('、');
  const categoryNames = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const accountNames = [...accountCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const summary: ImportSummary = {
    fileName: single ? tables[0]?.fileName ?? '' : fileNames,
    sheetName: single ? tables[0]?.sheetName : undefined,
    fileCount: tables.length,
    rowCount,
    validCount: allRecords.length,
    skippedCount,
    expenseCount,
    incomeCount,
    expenseTotal: roundMoney(expenseTotal),
    incomeTotal: roundMoney(incomeTotal),
    minDate,
    maxDate,
    categoryNames,
    accountNames,
    issues: allIssues.slice(0, 60),
    hash,
    sourceHeaders: tables[0]?.headers ?? [],
    headerRow: tables[0]?.headerRow ?? 0,
    mapping: single ? firstMapping : undefined,
    files: fileSummaries,
  };

  return { records: allRecords, summary };
}
