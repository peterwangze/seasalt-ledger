import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Account,
  Category,
  ImportBatch,
  ImportRecord,
  LedgerState,
  Settings,
  Transaction,
  TransactionInput,
} from '../types';
import { createInitialState } from '../data/defaults';
import { colorForAccount, colorForCategory, iconForAccount, iconForCategory, normalizeAccountName, normalizeCategoryName } from '../data/categoryMeta';
import { uid } from '../lib/id';
import { createDemoState } from '../lib/demo';
import { loadState, requestPersistentStorage, saveState } from '../lib/storage';

export interface ImportCommitResult {
  added: number;
  categoriesCreated: number;
  accountsCreated: number;
  batchId: string;
}

interface LedgerContextValue {
  state: LedgerState;
  ready: boolean;
  storageError: string | null;
  addTransaction: (input: TransactionInput) => Transaction;
  updateTransaction: (id: string, input: TransactionInput) => void;
  deleteTransaction: (id: string) => void;
  commitImport: (
    records: ImportRecord[],
    meta: { fileName: string; fileCount: number; hash: string },
  ) => ImportCommitResult;
  addCategory: (input: Pick<Category, 'name' | 'type' | 'icon' | 'color'>) => Category;
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'color'>>) => void;
  deleteCategory: (id: string) => void;
  addAccount: (input: Pick<Account, 'name' | 'icon' | 'color'>) => Account;
  updateAccount: (id: string, patch: Partial<Pick<Account, 'name' | 'icon' | 'color'>>) => void;
  deleteAccount: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearAllData: () => void;
  restoreState: (next: LedgerState) => void;
  loadDemo: () => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LedgerState>(() => createInitialState());
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const saveTimer = useRef<number | null>(null);

  const commit = useCallback((next: LedgerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadState();
        if (cancelled) return;
        if (loaded) {
          stateRef.current = loaded;
          setState(loaded);
        }
        void requestPersistentStorage();
      } catch {
        if (!cancelled) setStorageError('读取本地数据失败，已打开一个空白账本。');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveState(state)
        .then(() => setStorageError(null))
        .catch((error: unknown) => {
          setStorageError(error instanceof Error ? error.message : '保存失败，请导出备份。');
        });
    }, 180);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state, ready]);

  const addTransaction = useCallback((input: TransactionInput): Transaction => {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: uid('tx'),
      ...input,
      note: input.note.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const current = stateRef.current;
    commit({ ...current, transactions: [...current.transactions, transaction] });
    return transaction;
  }, [commit]);

  const updateTransaction = useCallback((id: string, input: TransactionInput) => {
    const current = stateRef.current;
    commit({
      ...current,
      transactions: current.transactions.map((transaction) =>
        transaction.id === id
          ? {
              ...transaction,
              ...input,
              note: input.note.trim(),
              updatedAt: new Date().toISOString(),
            }
          : transaction,
      ),
    });
  }, [commit]);

  const deleteTransaction = useCallback((id: string) => {
    const current = stateRef.current;
    commit({ ...current, transactions: current.transactions.filter((transaction) => transaction.id !== id) });
  }, [commit]);

  const commitImport = useCallback((
    records: ImportRecord[],
    meta: { fileName: string; fileCount: number; hash: string },
  ): ImportCommitResult => {
    const current = stateRef.current;
    const categories = [...current.categories];
    const accounts = [...current.accounts];
    const categoryMap = new Map(categories.map((category) => [`${category.type}::${category.name}`, category]));
    const accountMap = new Map(accounts.map((account) => [account.name, account]));
    let categoriesCreated = 0;
    let accountsCreated = 0;
    const now = Date.now();
    const batchId = uid('batch');

    const getCategory = (rawName: string, type: 'expense' | 'income'): Category => {
      const name = normalizeCategoryName(rawName, type);
      const key = `${type}::${name}`;
      const existing = categoryMap.get(key);
      if (existing) return existing;
      const category: Category = {
        id: uid('cat'),
        name,
        type,
        icon: iconForCategory(name),
        color: colorForCategory(name, type),
        custom: true,
        createdAt: new Date(now).toISOString(),
      };
      categories.push(category);
      categoryMap.set(key, category);
      categoriesCreated += 1;
      return category;
    };

    const getAccount = (rawName: string): Account => {
      const name = normalizeAccountName(rawName);
      const existing = accountMap.get(name);
      if (existing) return existing;
      const account: Account = {
        id: uid('acc'),
        name,
        icon: iconForAccount(name),
        color: colorForAccount(name),
        custom: true,
        createdAt: new Date(now).toISOString(),
      };
      accounts.push(account);
      accountMap.set(name, account);
      accountsCreated += 1;
      return account;
    };

    const importedTransactions: Transaction[] = records.map((record, index) => {
      const category = getCategory(record.categoryName, record.type);
      const account = getAccount(record.accountName);
      const createdAt = new Date(now - index * 1000).toISOString();
      return {
        id: uid('tx'),
        type: record.type,
        amount: record.amount,
        categoryId: category.id,
        accountId: account.id,
        date: record.date,
        time: record.time,
        note: record.note.trim(),
        createdAt,
        updatedAt: createdAt,
        importRef: {
          batchId,
          fingerprint: record.fingerprint,
          occurrence: record.occurrence,
          sourceCategory: record.categoryName,
          sourceAccount: record.accountName,
          sourceFile: record.sourceFile,
          sourceRow: record.sourceRow,
        },
      };
    });

    const batch: ImportBatch = {
      id: batchId,
      hash: meta.hash,
      fileName: meta.fileName,
      fileCount: meta.fileCount,
      importedAt: new Date(now).toISOString(),
      count: importedTransactions.length,
    };

    commit({
      ...current,
      categories,
      accounts,
      transactions: [...current.transactions, ...importedTransactions],
      importBatches: [...current.importBatches, batch],
    });

    return {
      added: importedTransactions.length,
      categoriesCreated,
      accountsCreated,
      batchId,
    };
  }, [commit]);

  const addCategory = useCallback((input: Pick<Category, 'name' | 'type' | 'icon' | 'color'>): Category => {
    const current = stateRef.current;
    const name = normalizeCategoryName(input.name, input.type);
    if (!name) throw new Error('请输入分类名称');
    if (current.categories.some((category) => category.type === input.type && category.name === name)) {
      throw new Error('这个分类已经存在了');
    }
    const category: Category = {
      ...input,
      name,
      id: uid('cat'),
      custom: true,
      createdAt: new Date().toISOString(),
    };
    commit({ ...current, categories: [...current.categories, category] });
    return category;
  }, [commit]);

  const updateCategory = useCallback((id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'color'>>) => {
    const current = stateRef.current;
    const target = current.categories.find((category) => category.id === id);
    if (!target) throw new Error('分类不存在');
    const name = patch.name === undefined ? target.name : normalizeCategoryName(patch.name, target.type);
    if (!name) throw new Error('请输入分类名称');
    if (current.categories.some((category) => category.id !== id && category.type === target.type && category.name === name)) {
      throw new Error('这个分类已经存在了');
    }
    commit({
      ...current,
      categories: current.categories.map((category) =>
        category.id === id ? { ...category, ...patch, name } : category,
      ),
    });
  }, [commit]);

  const deleteCategory = useCallback((id: string) => {
    const current = stateRef.current;
    const target = current.categories.find((category) => category.id === id);
    if (!target) return;
    if (!target.custom) throw new Error('内置分类不能删除');
    if (current.transactions.some((transaction) => transaction.categoryId === id)) {
      throw new Error('这个分类下还有账单，暂时不能删除');
    }
    commit({ ...current, categories: current.categories.filter((category) => category.id !== id) });
  }, [commit]);

  const addAccount = useCallback((input: Pick<Account, 'name' | 'icon' | 'color'>): Account => {
    const current = stateRef.current;
    const name = input.name.trim();
    if (!name) throw new Error('请输入账户名称');
    if (current.accounts.some((account) => account.name === name)) throw new Error('这个账户已经存在了');
    const account: Account = {
      ...input,
      name,
      id: uid('acc'),
      custom: true,
      createdAt: new Date().toISOString(),
    };
    commit({ ...current, accounts: [...current.accounts, account] });
    return account;
  }, [commit]);

  const updateAccount = useCallback((id: string, patch: Partial<Pick<Account, 'name' | 'icon' | 'color'>>) => {
    const current = stateRef.current;
    const target = current.accounts.find((account) => account.id === id);
    if (!target) throw new Error('账户不存在');
    const name = patch.name === undefined ? target.name : patch.name.trim();
    if (!name) throw new Error('请输入账户名称');
    if (current.accounts.some((account) => account.id !== id && account.name === name)) {
      throw new Error('这个账户已经存在了');
    }
    commit({
      ...current,
      accounts: current.accounts.map((account) => (account.id === id ? { ...account, ...patch, name } : account)),
    });
  }, [commit]);

  const deleteAccount = useCallback((id: string) => {
    const current = stateRef.current;
    const target = current.accounts.find((account) => account.id === id);
    if (!target) return;
    if (!target.custom) throw new Error('内置账户不能删除');
    if (current.accounts.length <= 1) throw new Error('至少保留一个账户');
    if (current.transactions.some((transaction) => transaction.accountId === id || transaction.toAccountId === id)) {
      throw new Error('这个账户下还有账单，暂时不能删除');
    }
    const accounts = current.accounts.filter((account) => account.id !== id);
    const defaultAccountId = current.settings.defaultAccountId === id ? accounts[0].id : current.settings.defaultAccountId;
    commit({ ...current, accounts, settings: { ...current.settings, defaultAccountId } });
  }, [commit]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const current = stateRef.current;
    commit({ ...current, settings: { ...current.settings, ...patch } });
  }, [commit]);

  const clearAllData = useCallback(() => {
    commit(createInitialState());
  }, [commit]);

  const restoreState = useCallback((next: LedgerState) => {
    commit({ ...next, version: 1 });
  }, [commit]);

  const loadDemo = useCallback(() => {
    if (stateRef.current.transactions.length > 0) throw new Error('账本里已经有账单了');
    commit(createDemoState());
  }, [commit]);

  const value = useMemo<LedgerContextValue>(() => ({
    state,
    ready,
    storageError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    commitImport,
    addCategory,
    updateCategory,
    deleteCategory,
    addAccount,
    updateAccount,
    deleteAccount,
    updateSettings,
    clearAllData,
    restoreState,
    loadDemo,
  }), [
    state,
    ready,
    storageError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    commitImport,
    addCategory,
    updateCategory,
    deleteCategory,
    addAccount,
    updateAccount,
    deleteAccount,
    updateSettings,
    clearAllData,
    restoreState,
    loadDemo,
  ]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const context = useContext(LedgerContext);
  if (!context) throw new Error('useLedger must be used inside LedgerProvider');
  return context;
}
