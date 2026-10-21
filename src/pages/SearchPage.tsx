import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Transaction } from '../types';
import { useLedger } from '../store/LedgerContext';
import { navigate } from '../store/router';
import { useToast } from '../store/ToastContext';
import { currentMonth, dayHeading, monthLabel, numericDate, shortDate } from '../lib/date';
import { formatAmount, sum } from '../lib/money';
import { groupByDay, sortTransactions } from '../lib/stats';
import { ConfirmSheet } from '../components/Sheet';
import { TransactionRow } from '../components/TransactionRow';
import { EmptyState, Segmented } from '../components/Common';
import { Icon } from '../components/Icon';

type TypeFilter = 'all' | 'expense' | 'income';
type Scope = 'all' | 'month';

export function SearchPage() {
  const { state, deleteTransaction } = useLedger();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [scope, setScope] = useState<Scope>('all');
  const [visibleCount, setVisibleCount] = useState(80);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const categoryMap = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  const accountMap = useMemo(() => new Map(state.accounts.map((account) => [account.id, account])), [state.accounts]);
  const monthsWithData = useMemo(
    () => [...new Set(state.transactions.map((transaction) => transaction.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)),
    [state.transactions],
  );

  const results = useMemo(() => {
    const needle = deferredQuery.toLowerCase();
    if (!needle) return [];
    const month = currentMonth();
    const filtered = state.transactions.filter((transaction) => {
      if (scope === 'month' && !transaction.date.startsWith(month)) return false;
      if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
      const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : undefined;
      const account = accountMap.get(transaction.accountId);
      const toAccount = transaction.toAccountId ? accountMap.get(transaction.toAccountId) : undefined;
      const amountText = formatAmount(transaction.amount).replace(/,/g, '');
      const haystack = [
        transaction.note,
        category?.name ?? '',
        account?.name ?? '',
        toAccount?.name ?? '',
        transaction.type === 'expense' ? '支出' : transaction.type === 'income' ? '收入' : '转账',
        numericDate(transaction.date),
        shortDate(transaction.date),
        transaction.date,
        amountText,
        String(transaction.amount),
        transaction.importRef?.sourceCategory ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
    return sortTransactions(filtered);
  }, [state.transactions, deferredQuery, typeFilter, scope, categoryMap, accountMap]);

  useEffect(() => {
    setVisibleCount(80);
  }, [deferredQuery, typeFilter, scope]);

  const shown = results.slice(0, visibleCount);
  const groups = useMemo(() => groupByDay(shown), [shown]);
  const resultTotal = sum(results.map((transaction) => transaction.amount));
  const deleteTransactionItem = deleteTarget ? state.transactions.find((transaction) => transaction.id === deleteTarget) : undefined;
  const suggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of state.transactions) {
      const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : undefined;
      if (category) counts.set(category.name, (counts.get(category.name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [state.transactions, categoryMap]);

  return (
    <main className="page search-page">
      <header className="search-heading">
        <p className="eyebrow">FIND A MEMORY</p>
        <h1>搜索账单</h1>
        <div className="search-field">
          <Icon name="search" size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜备注、分类、账户或金额"
            autoFocus
            enterKeyHint="search"
            aria-label="搜索账单"
          />
          {query ? (
            <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="清空搜索">
              <Icon name="x" size={15} />
            </button>
          ) : null}
        </div>
        <div className="search-filters">
          <Segmented
            value={typeFilter}
            onChange={setTypeFilter}
            ariaLabel="搜索类型"
            options={[
              { value: 'all', label: '全部' },
              { value: 'expense', label: '支出' },
              { value: 'income', label: '收入' },
            ]}
          />
          <button
            type="button"
            className={`scope-toggle ${scope === 'month' ? 'active' : ''}`}
            onClick={() => setScope((current) => (current === 'all' ? 'month' : 'all'))}
          >
            <Icon name="calendar" size={14} />
            {scope === 'all' ? '全部时间' : monthLabel(currentMonth())}
          </button>
        </div>
      </header>

      {!deferredQuery ? (
        <div className="search-landing">
          <div className="search-orbit" aria-hidden="true">
            <span />
            <span />
            <Icon name="search" size={28} />
          </div>
          <h2>翻一翻旧日的账单</h2>
          <p>输入关键词，找到那顿晚餐、那趟打车，或者某个具体的金额。</p>
          {suggestions.length ? (
            <div className="search-suggestions">
              <span>试试搜索</span>
              <div>
                {suggestions.map((name) => (
                  <button key={name} type="button" onClick={() => setQuery(name)}>{name}</button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="search-hints">
            <div><Icon name="tag" size={16} /><span>分类名</span><em>例如「餐饮」</em></div>
            <div><Icon name="wallet" size={16} /><span>账户名</span><em>例如「微信」</em></div>
            <div><Icon name="search" size={16} /><span>金额</span><em>例如「18」</em></div>
          </div>
        </div>
      ) : (
        <>
          <div className="search-summary">
            <div>
              <strong>{results.length}</strong>
              <span>笔相关账单</span>
            </div>
            <div>
              <strong>¥{formatAmount(resultTotal)}</strong>
              <span>金额合计</span>
            </div>
            <span className="search-scope">{monthsWithData.length ? `${monthsWithData.length} 个月` : '暂无数据'}</span>
          </div>

          {groups.length ? (
            <div className="transaction-groups search-results">
              {groups.map((group) => (
                <section className="day-group" key={group.date}>
                  <header className="day-header">
                    <div className="day-label"><span>{dayHeading(group.date)}</span></div>
                    <div className="day-totals"><span>{group.transactions.length} 笔</span></div>
                  </header>
                  <div className="day-rows card-list">
                    {group.transactions.map((transaction: Transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        category={transaction.categoryId ? categoryMap.get(transaction.categoryId) : undefined}
                        account={accountMap.get(transaction.accountId)}
                        toAccount={transaction.toAccountId ? accountMap.get(transaction.toAccountId) : undefined}
                        onEdit={() => navigate(`/record/${transaction.id}`)}
                        onDelete={() => setDeleteTarget(transaction.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {results.length > shown.length ? (
                <button type="button" className="button soft full load-more" onClick={() => setVisibleCount((count) => count + 80)}>
                  再显示 80 笔（还有 {results.length - shown.length} 笔）
                </button>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="没有找到相关账单"
              description="换个关键词试试，或把时间范围切到全部。"
              icon="search"
              action={<button type="button" className="button soft" onClick={() => { setQuery(''); setTypeFilter('all'); setScope('all'); }}>重新搜索</button>}
            />
          )}
        </>
      )}

      <p className="local-note"><Icon name="shield-check" size={13} /> 搜索在本设备完成，不会上传关键词</p>

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        title="删除这笔账单？"
        description={deleteTransactionItem ? `${deleteTransactionItem.note || '这笔账单'} · ¥${formatAmount(deleteTransactionItem.amount)}，删除后无法恢复。` : '删除后无法恢复。'}
        confirmLabel="删除"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteTransaction(deleteTarget);
            toast('账单已删除');
          }
        }}
      />
    </main>
  );
}
