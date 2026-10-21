export type TxType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  custom?: boolean;
  createdAt?: string;
}

export interface Account {
  id: string;
  name: string;
  icon: string;
  color: string;
  custom?: boolean;
  createdAt?: string;
}

export interface ImportRef {
  batchId: string;
  fingerprint: string;
  occurrence: number;
  sourceCategory?: string;
  sourceAccount?: string;
  sourceFile?: string;
  sourceRow?: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Always a positive amount. */
  amount: number;
  categoryId: string | null;
  accountId: string;
  toAccountId?: string | null;
  /** YYYY-MM-DD in local time. */
  date: string;
  /** HH:mm, optional. */
  time?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  importRef?: ImportRef;
}

export interface Settings {
  monthlyBudget: number;
  defaultAccountId: string;
}

export interface ImportBatch {
  id: string;
  hash: string;
  fileName: string;
  fileCount: number;
  importedAt: string;
  count: number;
}

export interface LedgerState {
  version: 1;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  settings: Settings;
  importBatches: ImportBatch[];
}

export interface TransactionInput {
  type: TxType;
  amount: number;
  categoryId: string | null;
  accountId: string;
  toAccountId?: string | null;
  date: string;
  time?: string;
  note: string;
}

export interface ImportRecord {
  date: string;
  time?: string;
  type: 'expense' | 'income';
  amount: number;
  categoryName: string;
  accountName: string;
  note: string;
  sourceFile: string;
  sourceRow: number;
  fingerprint: string;
  occurrence: number;
}

export interface ImportFileSummary {
  fileName: string;
  sheetName?: string;
  rowCount: number;
  validCount: number;
  skippedCount: number;
  expenseCount: number;
  incomeCount: number;
  expenseTotal: number;
  incomeTotal: number;
  minDate?: string;
  maxDate?: string;
  issues: ImportIssue[];
}

export interface ImportSummary {
  fileName: string;
  sheetName?: string;
  fileCount?: number;
  rowCount: number;
  validCount: number;
  skippedCount: number;
  expenseCount: number;
  incomeCount: number;
  expenseTotal: number;
  incomeTotal: number;
  minDate?: string;
  maxDate?: string;
  categoryNames: string[];
  accountNames: string[];
  issues: ImportIssue[];
  hash: string;
  sourceHeaders: string[];
  headerRow: number;
  mapping?: ImportMapping;
  files: ImportFileSummary[];
}

export interface ImportIssue {
  file: string;
  row: number;
  reason: string;
}

export interface ImportMapping {
  date: string;
  time: string;
  type: string;
  amount: string;
  expenseAmount: string;
  incomeAmount: string;
  category: string;
  account: string;
  note: string;
  merchant: string;
}

export interface AnalysisResult {
  records: ImportRecord[];
  summary: ImportSummary;
}
