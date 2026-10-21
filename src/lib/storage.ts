import type { LedgerState } from '../types';
import { createInitialState } from '../data/defaults';

const DB_NAME = 'seasalt-ledger';
const DB_VERSION = 1;
const STORE_NAME = 'ledger';
const STATE_KEY = 'current';
const FALLBACK_KEY = 'seasalt-ledger-state-v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

export function normalizeLedgerState(raw: unknown): LedgerState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<LedgerState>;
  if (!Array.isArray(data.transactions) || !Array.isArray(data.categories) || !Array.isArray(data.accounts)) {
    return null;
  }
  const initial = createInitialState();
  const categories = data.categories.filter((item) => item && item.id && item.name && item.type);
  const accounts = data.accounts.filter((item) => item && item.id && item.name);
  return {
    version: 1,
    transactions: data.transactions.filter((item) => item && item.id && item.date && item.type),
    categories: categories.length ? categories : initial.categories,
    accounts: accounts.length ? accounts : initial.accounts,
    settings: {
      ...initial.settings,
      ...(data.settings && typeof data.settings === 'object' ? data.settings : {}),
    },
    importBatches: Array.isArray(data.importBatches) ? data.importBatches : [],
  };
}

export async function loadState(): Promise<LedgerState | null> {
  try {
    const db = await openDatabase();
    const stored = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (stored) return normalizeLedgerState(stored);
  } catch {
    // Fall through to localStorage for browsers where IndexedDB is blocked.
  }

  try {
    const text = localStorage.getItem(FALLBACK_KEY);
    if (text) return normalizeLedgerState(JSON.parse(text));
  } catch {
    // Ignore corrupt fallback data.
  }
  return null;
}

export async function saveState(state: LedgerState): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(state, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return;
  } catch {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
      return;
    } catch {
      throw new Error('本地存储空间不足，请先导出备份。');
    }
  }
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Persistence is a best-effort enhancement.
  }
}
