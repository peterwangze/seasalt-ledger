const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function addYears(year: string | number, delta: number): string {
  return String(Number(year) + delta);
}

export function yearLabel(year: string | number): string {
  return `${Number(year)}年`;
}

export function monthNumberLabel(monthNumber: number): string {
  return `${monthNumber}月`;
}

export function addDaysISO(dateISO: string, delta: number): string {
  const date = parseISODate(dateISO);
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}

export function monthOverline(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${m}月 · ${y}`;
}

export function monthShort(month: string): string {
  const [, m] = month.split('-').map(Number);
  return `${m}月`;
}

export function weekdayCN(dateISO: string): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseISODate(dateISO).getDay()];
}

export function relativeDayLabel(dateISO: string): string {
  const today = todayISO();
  if (dateISO === today) return '今天';
  if (dateISO === addDaysISO(today, -1)) return '昨天';
  if (dateISO === addDaysISO(today, -2)) return '前天';
  const date = parseISODate(dateISO);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function dayHeading(dateISO: string): string {
  return `${relativeDayLabel(dateISO)} · ${weekdayCN(dateISO)}`;
}

export function dateWithWeekday(dateISO: string): string {
  const date = parseISODate(dateISO);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdayCN(dateISO)}`;
}

export function shortDate(dateISO: string): string {
  const date = parseISODate(dateISO);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function numericDate(dateISO: string): string {
  const date = parseISODate(dateISO);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function dateInputLabel(dateISO: string, time?: string): string {
  const date = parseISODate(dateISO);
  const base = dateISO === todayISO()
    ? '今天'
    : dateISO === addDaysISO(todayISO(), -1)
      ? '昨天'
      : `${date.getMonth() + 1}月${date.getDate()}日`;
  return time ? `${base} ${time}` : base;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

export function monthsBetween(start: string, end: string): string[] {
  const result: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 600) {
    result.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return result;
}

export function isFutureDate(dateISO: string): boolean {
  return dateISO > todayISO();
}

export function uniqueMonthCount(items: Array<{ date: string }>): number {
  return new Set(items.map((item) => item.date.slice(0, 7))).size;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}
