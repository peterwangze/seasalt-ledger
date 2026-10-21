import { currentMonth } from './date';

const KEY = 'seasalt-active-month';

export function getActiveMonth(): string {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored && /^\d{4}-\d{2}$/.test(stored)) return stored;
  } catch {
    // Session storage can be unavailable in strict privacy modes.
  }
  return currentMonth();
}

export function setActiveMonth(month: string): void {
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  try {
    sessionStorage.setItem(KEY, month);
  } catch {
    // Non-critical preference.
  }
}
