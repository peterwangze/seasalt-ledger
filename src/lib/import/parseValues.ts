const pad = (n: number) => String(n).padStart(2, '0');

export interface ParsedDateTime {
  date: string;
  time?: string;
}

function normalizeDateText(input: string): string {
  return input
    .replace(/\uFEFF/g, '')
    .replace(/[：]/g, ':')
    .replace(/[／]/g, '/')
    .replace(/[．]/g, '.')
    .replace(/[－—–]/g, '-')
    .replace(/[　]/g, ' ')
    .replace(/星期[一二三四五六日天]/g, '')
    .trim();
}

function makeDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function applyPeriod(hour: number, period: string): number {
  if (/下午|晚上|傍晚|pm/i.test(period) && hour < 12) return hour + 12;
  if (/上午|早上|凌晨|am/i.test(period) && hour === 12) return 0;
  return hour;
}

function parseTimeText(input: string): string | undefined {
  const text = normalizeDateText(input);
  if (!text) return undefined;
  const periodMatch = text.match(/(上午|下午|晚上|傍晚|早上|凌晨|am|pm)/i);
  const period = periodMatch?.[1] ?? '';
  let hour = 0;
  let minute = 0;
  let found = false;
  const colonMatch = text.match(/(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?/);
  if (colonMatch) {
    hour = Number(colonMatch[1]);
    minute = Number(colonMatch[2]);
    found = true;
  } else {
    const chineseMatch = text.match(/(\d{1,2})\s*[时点]\s*(\d{1,2})?\s*分?/);
    if (chineseMatch) {
      hour = Number(chineseMatch[1]);
      minute = chineseMatch[2] ? Number(chineseMatch[2]) : 0;
      found = true;
    }
  }
  if (!found) return undefined;
  hour = applyPeriod(hour, period);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return `${pad(hour)}:${pad(minute)}`;
}

export function parseTimeValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fraction = value >= 1 ? value % 1 : value;
    if (!fraction && value === 0) return undefined;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    return `${pad(hour)}:${pad(minute)}`;
  }
  const text = String(value).trim();
  if (!text) return undefined;
  return parseTimeText(text);
}

function fromDateObject(value: Date, separateTime?: unknown): ParsedDateTime | null {
  if (Number.isNaN(value.getTime())) return null;
  const date = makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (!date) return null;
  let time = separateTime !== undefined && separateTime !== '' ? parseTimeValue(separateTime) : undefined;
  if (!time) {
    const hour = value.getHours();
    const minute = value.getMinutes();
    if (hour !== 0 || minute !== 0) time = `${pad(hour)}:${pad(minute)}`;
  }
  return { date, time };
}

function fromExcelSerial(serial: number, separateTime?: unknown): ParsedDateTime | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 200000) return null;
  const wholeDays = Math.floor(serial);
  const fraction = serial - wholeDays;
  const ms = Math.round((wholeDays - 25569) * 86400 * 1000);
  const dateObject = new Date(ms);
  const date = makeDate(dateObject.getUTCFullYear(), dateObject.getUTCMonth() + 1, dateObject.getUTCDate());
  if (!date) return null;
  let time: string | undefined;
  if (separateTime !== undefined && separateTime !== '') {
    time = parseTimeValue(separateTime);
  }
  if (!time && fraction > 0) {
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    if (hour !== 0 || minute !== 0) time = `${pad(hour)}:${pad(minute)}`;
  }
  return { date, time };
}

export function parseDateValue(value: unknown, separateTime?: unknown, fallbackYear?: number): ParsedDateTime | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return fromDateObject(value, separateTime);

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) {
      return fromDateObject(new Date(value), separateTime);
    }
    if (value > 1_000_000_000) {
      return fromDateObject(new Date(value * 1000), separateTime);
    }
    return fromExcelSerial(value, separateTime);
  }

  let text = normalizeDateText(String(value));
  if (!text) return null;

  // Unix timestamps in text form.
  if (/^\d{10}$/.test(text)) {
    return fromDateObject(new Date(Number(text) * 1000), separateTime);
  }
  if (/^\d{13}$/.test(text)) {
    return fromDateObject(new Date(Number(text)), separateTime);
  }
  // Compact YYYYMMDD.
  if (/^\d{8}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(4, 6));
    const day = Number(text.slice(6, 8));
    const date = makeDate(year, month, day);
    return date ? { date, time: parseTimeValue(separateTime) } : null;
  }
  // Excel serial dates exported as strings.
  if (/^\d{5,6}$/.test(text)) {
    const serial = Number(text);
    if (serial >= 20000 && serial <= 80000) {
      return fromExcelSerial(serial, separateTime);
    }
  }

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  const fullMatch = text.match(/(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*日?/);
  if (fullMatch) {
    year = Number(fullMatch[1]);
    month = Number(fullMatch[2]);
    day = Number(fullMatch[3]);
  } else {
    const monthDayMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
    if (monthDayMatch) {
      year = fallbackYear ?? new Date().getFullYear();
      month = Number(monthDayMatch[1]);
      day = Number(monthDayMatch[2]);
    } else {
      const slashMatch = text.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})/);
      if (slashMatch) {
        year = fallbackYear ?? new Date().getFullYear();
        month = Number(slashMatch[1]);
        day = Number(slashMatch[2]);
      }
    }
  }

  if (year === null || month === null || day === null) return null;
  if (year < 100) year += 2000;
  const date = makeDate(year, month, day);
  if (!date) return null;

  let time: string | undefined;
  if (separateTime !== undefined && separateTime !== '') {
    time = parseTimeValue(separateTime);
  }
  if (!time) {
    time = parseTimeText(text);
  }
  return { date, time: time === '00:00' ? undefined : time };
}

export type ParsedTransactionType = 'expense' | 'income' | 'transfer' | 'ignore' | null;

export function parseTransactionType(value: unknown): ParsedTransactionType {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\s+/g, '');
  if (!text) return null;
  if (/不计收支|不计入|不统计|ignore/i.test(text)) return 'ignore';
  if (/转账|内部转|转出|转入/.test(text) && !/转入收入|转出支出/.test(text)) return 'transfer';
  if (/收入|入账|收款|进账|赚/.test(text)) return 'income';
  if (/支出|出账|消费|付款|花/.test(text)) return 'expense';
  return null;
}

export function isNegativeAmount(value: unknown): boolean {
  if (typeof value === 'number') return value < 0;
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return /^[-−(（]/.test(text);
}
