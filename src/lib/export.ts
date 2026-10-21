import { Capacitor } from '@capacitor/core';
import type { LedgerState } from '../types';
import { numericDate, todayISO } from './date';
import { formatAmount } from './money';

function triggerDownload(content: BlobPart, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * Android / iOS WebViews cannot reliably save <a download> blobs, so native
 * builds write to the app cache and open the system share / save sheet.
 */
async function deliverFile(text: string, fileName: string, mime: string): Promise<'shared' | 'downloaded'> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    await Filesystem.writeFile({
      path: fileName,
      data: utf8ToBase64(text),
      directory: Directory.Cache,
      recursive: true,
    });
    const file = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
    await Share.share({
      title: fileName,
      dialogTitle: '保存或分享海盐账本导出',
      url: file.uri,
    });
    return 'shared';
  }

  triggerDownload(text, fileName, mime);
  return 'downloaded';
}

function csvEscape(value: string | number): string {
  let text = String(value ?? '');
  // Prevent spreadsheet formula injection when opening the export in Excel.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function downloadJsonBackup(state: LedgerState): Promise<'shared' | 'downloaded'> {
  const payload = {
    format: 'seasalt-ledger-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  return deliverFile(
    JSON.stringify(payload, null, 2),
    `海盐账本-完整备份-${todayISO()}.json`,
    'application/json;charset=utf-8',
  );
}

export async function downloadCsv(state: LedgerState): Promise<'shared' | 'downloaded'> {
  const categoryMap = new Map(state.categories.map((category) => [category.id, category]));
  const accountMap = new Map(state.accounts.map((account) => [account.id, account]));
  const rows = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.createdAt.localeCompare(b.createdAt));
  const header = ['日期', '时间', '收支类型', '分类', '账户', '转入账户', '金额', '备注', '来源', '记录时间'];
  const lines = [header.map(csvEscape).join(',')];
  for (const transaction of rows) {
    const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : undefined;
    const account = accountMap.get(transaction.accountId);
    const toAccount = transaction.toAccountId ? accountMap.get(transaction.toAccountId) : undefined;
    lines.push([
      numericDate(transaction.date),
      transaction.time ?? '',
      transaction.type === 'expense' ? '支出' : transaction.type === 'income' ? '收入' : '转账',
      transaction.type === 'transfer' ? '转账' : category?.name ?? '未分类',
      account?.name ?? '',
      toAccount?.name ?? '',
      formatAmount(transaction.amount).replace(/,/g, ''),
      transaction.note,
      transaction.importRef?.sourceFile ?? '手动记录',
      transaction.createdAt,
    ].map(csvEscape).join(','));
  }
  return deliverFile(
    `\uFEFF${lines.join('\r\n')}\r\n`,
    `海盐账本-全部账单-${todayISO()}.csv`,
    'text/csv;charset=utf-8',
  );
}
