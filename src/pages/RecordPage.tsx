import { useEffect, useMemo, useRef, useState } from 'react';
import type { TxType } from '../types';
import { DEFAULT_EXPENSE_CATEGORY_ID, DEFAULT_INCOME_CATEGORY_ID } from '../data/defaults';
import { useLedger } from '../store/LedgerContext';
import { navigate, useRoute } from '../store/router';
import { useToast } from '../store/ToastContext';
import { dateInputLabel, dateWithWeekday, isValidISODate, shortDate, todayISO, addDaysISO, weekdayCN } from '../lib/date';
import { evaluateAmountExpression, formatAmount, formatAmountExpression } from '../lib/money';
import { setActiveMonth } from '../lib/activeMonth';
import { frequentCategories, getTransactionIndex } from '../lib/stats';
import { AccountAvatar, CategoryAvatar, EmptyState, Segmented, TopBar } from '../components/Common';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';

const KEYPAD = ['1', '2', '3', '+', '4', '5', '6', '-', '7', '8', '9', '*', '.', '0', 'back', '/'] as const;
const OPERATORS = new Set(['+', '-', '*', '/']);
const NOTE_SUGGESTIONS = ['早餐', '午餐', '晚餐', '打车', '买菜', '咖啡', '房租', '工资'];

function lastOperand(raw: string): string {
  return raw.split(/[+\-*/]/).pop() ?? '';
}

function nextAmount(raw: string, key: string): string {
  if (key === 'back') return raw.slice(0, -1);
  if (OPERATORS.has(key)) {
    if (!raw) return `0${key}`;
    const last = raw.slice(-1);
    if (OPERATORS.has(last)) return `${raw.slice(0, -1)}${key}`;
    const cleaned = last === '.' ? raw.slice(0, -1) : raw;
    return cleaned.length >= 36 ? cleaned : `${cleaned}${key}`;
  }
  if (key === '.') {
    if (!raw) return '0.';
    if (OPERATORS.has(raw.slice(-1))) return `${raw}0.`;
    const current = lastOperand(raw);
    if (current.includes('.')) return raw;
    return `${raw}.`;
  }
  const current = lastOperand(raw);
  if (current.includes('.')) {
    const [, decimal] = current.split('.');
    if (decimal.length >= 2) return raw;
  } else {
    if (current === '0') return `${raw.slice(0, -1)}${key}`;
    if (current.length >= 9) return raw;
  }
  return raw.length >= 40 ? raw : `${raw}${key}`;
}

function keypadLabel(key: string): string {
  if (key === '*') return '×';
  if (key === '/') return '÷';
  return key;
}

function vibrate() {
  try {
    navigator.vibrate?.(7);
  } catch {
    // Haptics are optional.
  }
}

export function RecordPage() {
  const { state, addTransaction, updateTransaction, deleteTransaction } = useLedger();
  const route = useRoute();
  const toast = useToast();
  const transactionId = route.segments[1];
  const existing = transactionId ? state.transactions.find((transaction) => transaction.id === transactionId) : undefined;
  const queryTypeRaw = route.query.get('type');
  const queryType: TxType | null = queryTypeRaw === 'income' || queryTypeRaw === 'transfer' || queryTypeRaw === 'expense'
    ? queryTypeRaw
    : null;
  const queryCategoryId = route.query.get('category');
  const queryCategory = queryCategoryId ? state.categories.find((category) => category.id === queryCategoryId) : undefined;
  const initialType: TxType = existing?.type ?? queryType ?? queryCategory?.type ?? 'expense';
  const queryDate = route.query.get('date');
  const initialDate = existing?.date ?? (queryDate && isValidISODate(queryDate) ? queryDate : todayISO());
  const initialCategoryId = existing?.categoryId
    ?? (queryCategory && queryCategory.type === initialType
      ? queryCategory.id
      : initialType === 'income'
        ? DEFAULT_INCOME_CATEGORY_ID
        : DEFAULT_EXPENSE_CATEGORY_ID);
  const fromCalendar = route.query.get('from') === 'calendar';

  const defaultAccount = state.accounts.find((account) => account.id === state.settings.defaultAccountId) ?? state.accounts[0];
  const [type, setType] = useState<TxType>(initialType);
  const [amountRaw, setAmountRaw] = useState(existing ? String(existing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [accountId, setAccountId] = useState(existing?.accountId ?? defaultAccount?.id ?? '');
  const [toAccountId, setToAccountId] = useState(
    existing?.toAccountId ?? state.accounts.find((account) => account.id !== (existing?.accountId ?? defaultAccount?.id))?.id ?? '',
  );
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(existing?.time ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [categorySheet, setCategorySheet] = useState(false);
  const [accountSheet, setAccountSheet] = useState<'account' | 'toAccount' | null>(null);
  const [noteSheet, setNoteSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<() => void>(() => undefined);

  const categoryMap = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  const accountMap = useMemo(() => new Map(state.accounts.map((account) => [account.id, account])), [state.accounts]);
  const selectedCategory = categoryId ? categoryMap.get(categoryId) : undefined;
  const selectedAccount = accountMap.get(accountId);
  const selectedToAccount = accountMap.get(toAccountId);
  const amountResult = evaluateAmountExpression(amountRaw);
  const amount = amountResult ?? 0;
  const hasExpression = /[+\-*/]/.test(amountRaw);
  const transactionIndex = useMemo(() => getTransactionIndex(state.transactions), [state.transactions]);

  const frequent = useMemo(() => {
    if (type === 'transfer') return [];
    const list = frequentCategories(state.transactions, state.categories, type, 11);
    if (selectedCategory && selectedCategory.type === type && !list.some((category) => category.id === selectedCategory.id)) {
      return [...list.slice(0, 10), selectedCategory];
    }
    return list.slice(0, 11);
  }, [state.transactions, state.categories, type, selectedCategory]);

  const recordContext = useMemo(() => {
    const month = date.slice(0, 7);
    const dayCount = transactionIndex.byDate.get(date)?.length ?? 0;
    let monthExpense = 0;
    for (const transaction of transactionIndex.byMonth.get(month) ?? []) {
      if (transaction.type === 'expense') monthExpense += transaction.amount;
    }
    return { monthExpense, dayCount };
  }, [transactionIndex, date]);

  const initialSnapshot = useMemo(() => JSON.stringify({
    type: existing?.type ?? initialType,
    amount: existing ? String(existing.amount) : '',
    categoryId: existing?.categoryId ?? initialCategoryId,
    accountId: existing?.accountId ?? defaultAccount?.id ?? '',
    toAccountId: existing?.toAccountId ?? '',
    date: existing?.date ?? initialDate,
    time: existing?.time ?? '',
    note: existing?.note ?? '',
  }), [existing, initialType, initialCategoryId, initialDate, defaultAccount?.id]);

  const currentSnapshot = JSON.stringify({
    type,
    amount: amountRaw,
    categoryId,
    accountId,
    toAccountId: type === 'transfer' ? toAccountId : '',
    date,
    time,
    note,
  });
  const dirty = currentSnapshot !== initialSnapshot;

  const handleBack = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    if (window.history.length > 1) window.history.back();
    else navigate('/');
  };

  const changeType = (next: TxType) => {
    if (next === type) return;
    setType(next);
    if (next === 'transfer') {
      if (!toAccountId || toAccountId === accountId) {
        const other = state.accounts.find((account) => account.id !== accountId);
        if (other) setToAccountId(other.id);
      }
      return;
    }
    const current = categoryId ? categoryMap.get(categoryId) : undefined;
    if (!current || current.type !== next) {
      const preferredId = next === 'income' ? DEFAULT_INCOME_CATEGORY_ID : DEFAULT_EXPENSE_CATEGORY_ID;
      const preferred = categoryMap.get(preferredId);
      setCategoryId(preferred?.id ?? state.categories.find((category) => category.type === next)?.id ?? null);
    }
  };

  const pressKey = (key: string) => {
    vibrate();
    setAmountRaw((current) => nextAmount(current, key));
  };

  const handleSave = () => {
    if (saving) return;
    if (!amount || amount <= 0) {
      toast('先输入金额吧', 'error');
      return;
    }
    if (!isValidISODate(date)) {
      toast('日期看起来不太对，请重新选择', 'error');
      return;
    }
    if (type !== 'transfer' && !categoryId) {
      toast('选择一个分类吧', 'error');
      return;
    }
    if (!accountId) {
      toast('选择一个账户吧', 'error');
      return;
    }
    if (type === 'transfer') {
      if (!toAccountId) {
        toast('选择转入账户', 'error');
        return;
      }
      if (toAccountId === accountId) {
        toast('转出和转入账户不能相同', 'error');
        return;
      }
    }
    setSaving(true);
    const input = {
      type,
      amount: Math.round(amount * 100) / 100,
      categoryId: type === 'transfer' ? null : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      date,
      time: time || undefined,
      note,
    };
    try {
      if (existing) {
        updateTransaction(existing.id, input);
        toast('账单已更新', 'success');
      } else {
        addTransaction(input);
        toast(type === 'expense' ? '支出已记下' : type === 'income' ? '收入已记下' : '转账已记下', 'success');
      }
      setActiveMonth(date.slice(0, 7));
      if (fromCalendar) {
        navigate(`/calendar?month=${date.slice(0, 7)}&day=${date}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = handleSave;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (categorySheet || accountSheet || noteSheet || dateSheet || confirmDelete || confirmDiscard) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const normalizedKey = event.key === 'x' || event.key === 'X' || event.key === '×'
        ? '*'
        : event.key === '÷'
          ? '/'
          : event.key;
      if (/^\d$/.test(normalizedKey) || normalizedKey === '.' || OPERATORS.has(normalizedKey)) {
        event.preventDefault();
        pressKey(normalizedKey);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        pressKey('back');
      } else if (event.key === 'Enter') {
        if (target?.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        saveRef.current();
      } else if (event.key === 'Escape') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (transactionId && !existing) {
    return (
      <main className="page detail-page">
        <TopBar title="编辑账单" />
        <EmptyState
          title="找不到这笔账单"
          description="它可能已经被删除了。"
          action={<button type="button" className="button primary" onClick={() => navigate('/')}>回到明细</button>}
        />
      </main>
    );
  }

  const allCategories = state.categories.filter((category) => category.type === (type === 'transfer' ? 'expense' : type));

  return (
    <main className="page record-page">
      <TopBar
        title={existing ? '编辑账单' : '记一笔'}
        onBack={handleBack}
        right={
          <div className="record-top-actions">
            {existing ? (
              <button type="button" className="icon-button subtle" onClick={() => setConfirmDelete(true)} aria-label="删除账单">
                <Icon name="trash" size={18} />
              </button>
            ) : null}
            <button type="button" className="save-button" onClick={handleSave} disabled={!amount}>
              保存
            </button>
          </div>
        }
      />

      <div className="record-body">
        <Segmented
          value={type}
          onChange={changeType}
          ariaLabel="账单类型"
          className="type-switch"
          options={[
            { value: 'expense', label: '支出' },
            { value: 'income', label: '收入' },
            { value: 'transfer', label: '转账' },
          ]}
        />

        <section className="amount-panel">
          <div className="amount-panel-top">
            <span>{type === 'expense' ? '支出金额' : type === 'income' ? '收入金额' : '转账金额'}</span>
            {type !== 'transfer' && selectedCategory ? (
              <span className="selected-category">
                <i style={{ background: selectedCategory.color }} />
                {selectedCategory.name}
              </span>
            ) : null}
          </div>
          <div
            className={`amount-value ${amountRaw ? 'has-value' : ''} ${hasExpression ? 'has-expression' : ''}`}
            aria-live="polite"
            aria-label={`金额 ${amountRaw || '0'} 元`}
          >
            <span className="amount-currency">¥</span>
            <span>{formatAmountExpression(amountRaw)}</span>
          </div>
          {hasExpression ? (
            <div className={`amount-result ${amountResult === null ? 'pending' : ''}`}>
              = {amountResult === null ? '…' : `¥${formatAmount(amountResult)}`}
            </div>
          ) : null}
          <div className="amount-under">
            <span>{dateInputLabel(date, time)}</span>
            <span>·</span>
            <span>{type === 'transfer' ? `${selectedAccount?.name ?? '账户'} → ${selectedToAccount?.name ?? '账户'}` : selectedAccount?.name ?? '请选择账户'}</span>
          </div>
        </section>

        {type !== 'transfer' ? (
          <section className="record-category-section">
            <div className="record-section-head">
              <h2>选择分类</h2>
              <button type="button" className="text-button" onClick={() => setCategorySheet(true)}>
                全部分类 <Icon name="chevron-right" size={13} />
              </button>
            </div>
            <div className="record-category-grid">
              {frequent.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`record-category ${categoryId === category.id ? 'selected' : ''}`}
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  <CategoryAvatar category={category} size={43} />
                  <span>{category.name}</span>
                  {categoryId === category.id ? <i className="category-check"><Icon name="check" size={9} strokeWidth={3} /></i> : null}
                </button>
              ))}
              <button type="button" className="record-category more" onClick={() => setCategorySheet(true)}>
                <span className="more-category-icon"><Icon name="tags" size={19} /></span>
                <span>全部</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="transfer-section">
            <div className="transfer-flow">
              <button type="button" className="transfer-account" onClick={() => setAccountSheet('account')}>
                <span className="transfer-account-label">转出账户</span>
                {selectedAccount ? (
                  <span className="transfer-account-value">
                    <AccountAvatar account={selectedAccount} size={36} />
                    <strong>{selectedAccount.name}</strong>
                  </span>
                ) : <span className="transfer-empty">选择账户</span>}
              </button>
              <button
                type="button"
                className="swap-accounts"
                aria-label="交换转出和转入账户"
                onClick={() => {
                  const from = accountId;
                  setAccountId(toAccountId);
                  setToAccountId(from);
                }}
              >
                <Icon name="arrow-left-right" size={18} />
              </button>
              <button type="button" className="transfer-account" onClick={() => setAccountSheet('toAccount')}>
                <span className="transfer-account-label">转入账户</span>
                {selectedToAccount ? (
                  <span className="transfer-account-value">
                    <AccountAvatar account={selectedToAccount} size={36} />
                    <strong>{selectedToAccount.name}</strong>
                  </span>
                ) : <span className="transfer-empty">选择账户</span>}
              </button>
            </div>
            <p className="transfer-note">转账不计入收支统计，只会记录账户之间的流动。</p>
          </section>
        )}

        <section className="meta-row">
          <button type="button" className="meta-chip" onClick={() => setDateSheet(true)}>
            <Icon name="calendar" size={15} />
            {dateInputLabel(date, time)}
          </button>
          <button type="button" className="meta-chip" onClick={() => setAccountSheet('account')}>
            <Icon name="wallet" size={15} />
            {selectedAccount?.name ?? '选择账户'}
          </button>
          <button
            type="button"
            className={`meta-chip note ${note ? 'filled' : ''}`}
            onClick={() => {
              setDraftNote(note);
              setNoteSheet(true);
            }}
          >
            <Icon name="pencil" size={14} />
            <span>{note || '添加备注'}</span>
          </button>
        </section>

        <div className="record-context">
          <div>
            <span>当月已支出</span>
            <strong>¥{formatAmount(recordContext.monthExpense)}</strong>
          </div>
          <i />
          <div>
            <span>这一天已记</span>
            <strong>{recordContext.dayCount} 笔</strong>
          </div>
          <span className="record-context-mark"><Icon name="waves" size={17} /></span>
        </div>

        <div className="record-whisper">
          <span className="whisper-line" />
          <Icon name="sparkles" size={12} />
          <span>把日子，轻轻收好。</span>
          <span className="whisper-line" />
        </div>
      </div>

      <div className="keypad" role="group" aria-label="金额键盘">
        {KEYPAD.map((key) => (
          <button
            key={key}
            type="button"
            className={`keypad-key ${key === 'back' ? 'backspace' : OPERATORS.has(key) ? 'operator' : ''}`}
            onClick={() => pressKey(key)}
            aria-label={
              key === 'back'
                ? '退格'
                : key === '.'
                  ? '小数点'
                  : key === '+'
                    ? '加'
                    : key === '-'
                      ? '减'
                      : key === '*'
                        ? '乘'
                        : key === '/'
                          ? '除'
                          : key
            }
          >
            {key === 'back' ? <Icon name="chevron-left" size={24} strokeWidth={1.8} /> : keypadLabel(key)}
          </button>
        ))}
      </div>

      <Sheet open={categorySheet} onClose={() => setCategorySheet(false)} title="全部分类" subtitle="选择这一笔的分类">
        <div className="sheet-category-grid">
          {allCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`sheet-category ${categoryId === category.id ? 'selected' : ''}`}
              aria-pressed={categoryId === category.id}
              onClick={() => {
                setCategoryId(category.id);
                setCategorySheet(false);
              }}
            >
              <CategoryAvatar category={category} size={46} />
              <span>{category.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="manage-link"
          onClick={() => {
            setCategorySheet(false);
            navigate('/categories');
          }}
        >
          <Icon name="settings" size={16} /> 管理分类
        </button>
      </Sheet>

      <Sheet
        open={Boolean(accountSheet)}
        onClose={() => setAccountSheet(null)}
        title={accountSheet === 'toAccount' ? '选择转入账户' : type === 'transfer' ? '选择转出账户' : '选择账户'}
      >
        <div className="account-list">
          {state.accounts.map((account) => {
            const active = accountSheet === 'toAccount' ? toAccountId === account.id : accountId === account.id;
            const disabled = accountSheet === 'toAccount' && account.id === accountId;
            return (
              <button
                key={account.id}
                type="button"
                className={`account-choice ${active ? 'active' : ''}`}
                disabled={disabled}
                onClick={() => {
                  if (accountSheet === 'toAccount') setToAccountId(account.id);
                  else setAccountId(account.id);
                  setAccountSheet(null);
                }}
              >
                <AccountAvatar account={account} size={38} />
                <span>{account.name}</span>
                {disabled ? <small>转出账户</small> : active ? <Icon name="check" size={18} /> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="manage-link"
          onClick={() => {
            setAccountSheet(null);
            navigate('/accounts');
          }}
        >
          <Icon name="settings" size={16} /> 管理账户
        </button>
      </Sheet>

      <Sheet
        open={noteSheet}
        onClose={() => setNoteSheet(false)}
        title="添加备注"
        subtitle="给这笔账留一句小注"
        footer={
          <button
            type="button"
            className="button primary full"
            onClick={() => {
              setNote(draftNote.trim());
              setNoteSheet(false);
            }}
          >
            完成
          </button>
        }
      >
        <textarea
          className="note-textarea"
          value={draftNote}
          onChange={(event) => setDraftNote(event.target.value)}
          placeholder="例如：和朋友吃了一碗好吃的面"
          aria-label="账单备注"
          maxLength={100}
          rows={3}
          autoFocus
        />
        <div className="note-suggestions">
          {NOTE_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={draftNote === suggestion ? 'active' : ''}
              onClick={() => setDraftNote(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="input-hint"><span>{draftNote.length}/100</span><span>备注会显示在明细里</span></div>
      </Sheet>

      <Sheet
        open={dateSheet}
        onClose={() => setDateSheet(false)}
        title="日期和时间"
        subtitle={dateWithWeekday(date)}
        footer={<button type="button" className="button primary full" onClick={() => setDateSheet(false)}>完成</button>}
      >
        <div className="date-quick">
          {[
            ['今天', todayISO()],
            ['昨天', addDaysISO(todayISO(), -1)],
            ['前天', addDaysISO(todayISO(), -2)],
          ].map(([label, value]) => (
            <button
              key={label}
              type="button"
              className={date === value ? 'active' : ''}
              onClick={() => setDate(value)}
            >
              <span>{label}</span>
              <small>{shortDate(value)}</small>
            </button>
          ))}
        </div>
        <div className="form-grid two">
          <label className="field">
            <span>日期</span>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>时间 <em>可选</em></span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>
        <div className="date-footer-line">
          <span>{weekdayCN(date)}</span>
          {time ? <button type="button" className="text-button" onClick={() => setTime('')}>清除时间</button> : <span className="muted">不填时间也可以</span>}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title="删除这笔账单？"
        description="删除后无法恢复。"
        confirmLabel="删除"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (existing) {
            deleteTransaction(existing.id);
            toast('账单已删除');
            if (fromCalendar) navigate(`/calendar?month=${date.slice(0, 7)}&day=${date}`, { replace: true });
            else navigate('/', { replace: true });
          }
        }}
      />

      <ConfirmSheet
        open={confirmDiscard}
        title="放弃这次编辑？"
        description="还没保存的内容会丢失。"
        confirmLabel="放弃"
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          if (window.history.length > 1) window.history.back();
          else navigate('/');
        }}
      />
    </main>
  );
}
