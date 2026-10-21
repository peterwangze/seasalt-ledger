import type { ImportMapping } from '../../types';

export interface RawTable {
  fileName: string;
  sheetName?: string;
  headers: string[];
  rows: unknown[][];
  headerRow: number;
  allHeaders: string[];
}

export interface ParsedDelimited {
  rows: string[][];
  delimiter: string;
}

const HEADER_HINTS = [
  '日期', '时间', '收支类型', '收支', '账单类型', '交易类型', '类型', '金额',
  '支出', '收入', '支出金额', '收入金额', '交易金额', '类别', '分类', '账户',
  '支付方式', '备注', '说明', '商户', '交易对方', '对方',
];

function normalizeHeaderKey(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/[\s*＊]/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[:：]/g, '')
    .toLowerCase();
}

function countDelimiters(text: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') i += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      count += 1;
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      break;
    }
  }
  return count;
}

export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 5000);
  const counts = [
    { delimiter: ',', count: countDelimiters(sample, ',') },
    { delimiter: '\t', count: countDelimiters(sample, '\t') },
    { delimiter: ';', count: countDelimiters(sample, ';') },
    { delimiter: '|', count: countDelimiters(sample, '|') },
  ].sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ',';
}

export function parseDelimitedText(text: string, delimiter?: string): ParsedDelimited {
  const actualDelimiter = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    const hasContent = row.some((cell) => cell.trim() !== '');
    if (hasContent) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.trim() === '') {
      inQuotes = true;
    } else if (char === actualDelimiter) {
      pushField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      pushRow();
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  return { rows, delimiter: actualDelimiter };
}

export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    try {
      return new TextDecoder('gb18030').decode(bytes).replace(/^\uFEFF/, '');
    } catch {
      throw new Error('无法识别文件编码，请另存为 UTF-8 CSV 或 Excel 后重试');
    }
  }
}

function headerScore(row: unknown[]): number {
  let score = 0;
  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    const key = normalizeHeaderKey(String(cell));
    if (!key) continue;
    if (HEADER_HINTS.some((hint) => key === normalizeHeaderKey(hint) || key.includes(normalizeHeaderKey(hint)))) {
      score += 1;
    }
  }
  return score;
}

export function detectHeaderRow(rows: unknown[][]): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i += 1) {
    const score = headerScore(rows[i]);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best >= 0 && bestScore >= 2) return best;
  return rows.findIndex((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
}

export function makeUniqueHeaders(row: unknown[]): string[] {
  const used = new Map<string, number>();
  return row.map((cell, index) => {
    let name = String(cell ?? '').replace(/\uFEFF/g, '').replace(/\s+/g, ' ').trim();
    if (!name) name = `未命名列${index + 1}`;
    const previous = used.get(name) ?? 0;
    used.set(name, previous + 1);
    return previous === 0 ? name : `${name} (${previous + 1})`;
  });
}

export function tableFromRows(fileName: string, rows: unknown[][], sheetName?: string): RawTable {
  if (!rows.length) throw new Error('表格里没有可读取的内容');
  const headerRow = detectHeaderRow(rows);
  if (headerRow < 0) throw new Error('表格里没有可读取的内容');
  const headers = makeUniqueHeaders(rows[headerRow] ?? []);
  const dataRows = rows
    .slice(headerRow + 1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (!dataRows.length) throw new Error('只找到了表头，没有账单数据');
  return {
    fileName,
    sheetName,
    headers,
    rows: dataRows,
    headerRow,
    allHeaders: headers,
  };
}

async function readCsvFile(file: File): Promise<RawTable> {
  const buffer = await file.arrayBuffer();
  const text = decodeText(buffer);
  const parsed = parseDelimitedText(text);
  return tableFromRows(file.name, parsed.rows);
}

async function readWorkbookFile(file: File): Promise<RawTable> {
  const buffer = await file.arrayBuffer();
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
  if (!workbook.SheetNames.length) throw new Error('Excel 文件里没有工作表');
  let best: { rows: unknown[][]; sheet: string; score: number } | null = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    if (!rows.length) continue;
    let score = rows.length;
    if (rows.some((row) => headerScore(row) >= 2)) score += 10000;
    if (!best || score > best.score) best = { rows, sheet: sheetName, score };
  }
  if (!best) throw new Error('Excel 文件里没有可读取的内容');
  return tableFromRows(file.name, best.rows, best.sheet);
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function readTabularFile(file: File): Promise<RawTable> {
  if (file.size > MAX_FILE_BYTES) throw new Error('文件超过 25MB，请拆分后再导入');
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  if (extension === 'csv' || extension === 'txt' || file.type === 'text/csv' || file.type === 'text/plain') {
    return readCsvFile(file);
  }
  if (extension === 'xlsx' || extension === 'xls' || /sheet|excel/i.test(file.type)) {
    return readWorkbookFile(file);
  }
  throw new Error('暂不支持这种文件，请选择 CSV 或 Excel 文件');
}

export function normalizeKey(value: string): string {
  return normalizeHeaderKey(value);
}

export function findHeader(
  headers: string[],
  aliases: string[],
  options?: { rows?: unknown[][]; validate?: (values: string[]) => boolean },
): string {
  const scored = headers.map((header, index) => {
    const key = normalizeHeaderKey(header);
    let score = -1;
    aliases.forEach((alias, aliasIndex) => {
      const normalizedAlias = normalizeHeaderKey(alias);
      if (key === normalizedAlias) score = Math.max(score, 1000 - aliasIndex * 10);
      else if (key.includes(normalizedAlias) && normalizedAlias.length >= 2) score = Math.max(score, 500 - aliasIndex * 10);
    });
    return { header, index, score };
  }).filter((item) => item.score >= 0);

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  for (const candidate of scored) {
    if (!options?.validate) return candidate.header;
    const values = (options.rows ?? [])
      .slice(0, 40)
      .map((row) => String(row[candidate.index] ?? '').trim())
      .filter(Boolean);
    if (options.validate(values)) return candidate.header;
  }
  return '';
}

export function columnValues(table: RawTable, header: string, limit = 80): string[] {
  if (!header) return [];
  const index = table.headers.indexOf(header);
  if (index < 0) return [];
  return table.rows.slice(0, limit).map((row) => String(row[index] ?? '')).filter((value) => value.trim() !== '');
}

export function defaultMapping(table: RawTable): ImportMapping {
  const headers = table.headers;
  const looksLikeTime = (values: string[]) => values.length > 0 && values.every((value) => /^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim()));

  let date = findHeader(headers, [
    '交易日期', '记账日期', '账单日期', '消费日期', '发生日期', '日期', '交易时间', '记账时间', '创建时间', '时间', 'date',
  ]);
  let time = '';
  if (date) {
    const timeCandidate = findHeader(headers, ['交易时间', '记账时间', '时间', 'time'], {
      rows: table.rows,
      validate: looksLikeTime,
    });
    if (timeCandidate && timeCandidate !== date) {
      time = timeCandidate;
    }
    if (normalizeHeaderKey(date) === '时间' && !looksLikeTime(columnValues(table, date))) {
      const dateCandidate = findHeader(headers, ['日期', '交易日期', '记账日期', '账单日期', 'date']);
      if (dateCandidate) {
        date = dateCandidate;
      }
    }
  }

  const type = findHeader(headers, ['收支类型', '收支', '账单类型', '交易类型', '类型'], {
    rows: table.rows,
    validate: (values) => {
      const matched = values.filter((value) => /支出|收入|转账|消费|入账|出账|转出|转入/.test(value)).length;
      return matched > 0 && matched >= values.length * 0.4;
    },
  });

  const amountCandidate = findHeader(headers, [
    '交易金额', '收支金额', '账单金额', '发生金额', '金额', '数额', '价格', 'amount',
  ], {
    rows: table.rows,
    validate: (values) => values.some((value) => /\d/.test(value)),
  });
  // A column named "支出金额" or "收入金额" is a split column, not a generic amount.
  const amount = amountCandidate && !/^(支出|收入|入账|收款|付款|消费)/.test(normalizeHeaderKey(amountCandidate))
    ? amountCandidate
    : '';

  const expenseAmount = !amount
    ? findHeader(headers, ['支出金额', '支出', '消费金额', '付款金额'], {
        rows: table.rows,
        validate: (values) => values.some((value) => /\d/.test(value)),
      })
    : '';
  const incomeAmount = !amount
    ? findHeader(headers, ['收入金额', '收入', '入账金额', '收款金额'], {
        rows: table.rows,
        validate: (values) => values.some((value) => /\d/.test(value)),
      })
    : '';

  let category = findHeader(headers, ['类别', '分类', '账目分类', '账单分类', '消费分类', '支出分类', '收入分类', '项目', 'tag', 'category']);
  if (!category) {
    const typeCandidate = findHeader(headers, ['类型'], { rows: table.rows });
    if (typeCandidate && typeCandidate !== type) category = typeCandidate;
  }

  const account = findHeader(headers, ['账户名称', '资产账户', '账户', '支付方式', '付款方式', '账户类型', 'account']);
  const note = findHeader(headers, ['备注信息', '账单备注', '备注', '说明', '描述', '摘要', '详情', 'note', 'memo']);
  const merchant = findHeader(headers, ['交易对方', '交易对象', '商户', '商家', '对方', 'merchant']);

  return {
    date,
    time,
    type,
    amount,
    expenseAmount: amount ? '' : expenseAmount,
    incomeAmount: amount ? '' : incomeAmount,
    category,
    account,
    note,
    merchant,
  };
}

export function validateMapping(mapping: ImportMapping): string[] {
  const errors: string[] = [];
  if (!mapping.date) errors.push('请选择日期列');
  if (!mapping.amount && !mapping.expenseAmount && !mapping.incomeAmount) {
    errors.push('请选择金额列，或分别选择支出/收入金额列');
  }
  return errors;
}
