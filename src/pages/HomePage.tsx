import { useMemo, useState } from 'react';
import { useLedger } from '../store/LedgerContext';
import { navigate } from '../store/router';
import { useToast } from '../store/ToastContext';
import { currentMonth, dayHeading, daysInMonth, greeting, monthOf, monthOverline, todayISO } from '../lib/date';
import { getActiveMonth, setActiveMonth } from '../lib/activeMonth';
import { formatAmount, percent } from '../lib/money';
import { frequentCategories, groupByDay, monthTotals, transactionsInMonth } from '../lib/stats';
import { BrandMark, Icon } from '../components/Icon';
import { ConfirmSheet } from '../components/Sheet';
import { CategoryAvatar, EmptyState, MonthSwitcher } from '../components/Common';
import { TransactionRow } from '../components/TransactionRow';

type Filter = 'all' | 'expense' | 'income';

export function HomePage() {
  const { state, deleteTransaction, loadDemo } = useLedger();
  const toast = useToast();
  const [month, setMonthState] = useState(getActiveMonth);
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const monthsWithData = useMemo(
    () => new Set(state.transactions.map((transaction) => monthOf(transaction.date))),
    [state.transactions],
  );
  const monthTransactions = useMemo(
    () => transactionsInMonth(state.transactions, month),
    [state.transactions, month],
  );
  const totals = useMemo(() => monthTotals(monthTransactions), [monthTransactions]);
  const visible = useMemo(
    () => (filter === 'all' ? monthTransactions : monthTransactions.filter((transaction) => transaction.type === filter)),
    [monthTransactions, filter],
  );
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const categoryMap = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  const accountMap = useMemo(() => new Map(state.accounts.map((account) => [account.id, account])), [state.accounts]);
  const quickCategories = useMemo(
    () => frequentCategories(state.transactions, state.categories, 'expense', 4),
    [state.transactions, state.categories],
  );
  const budget = state.settings.monthlyBudget;
  const budgetPercent = percent(totals.expense, budget);
  const budgetLeft = budget - totals.expense;
  const emptyLedger = state.transactions.length === 0;
  const todayExpense = useMemo(
    () => monthTransactions
      .filter((transaction) => transaction.date === todayISO() && transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0),
    [monthTransactions],
  );
  const isCurrentView = month === currentMonth();
  const periodLabel = isCurrentView ? '本月' : '当月';
  const thirdStatValue = isCurrentView ? todayExpense : totals.expense / daysInMonth(month);
  const todayDay = Number(todayISO().slice(8, 10));
  const daysRemaining = Math.max(1, daysInMonth(month) - todayDay + 1);
  const budgetDaily = Math.max(0, budgetLeft) / daysRemaining;

  const targetTransaction = deleteTarget
    ? state.transactions.find((transaction) => transaction.id === deleteTarget)
    : undefined;

  return (
    <main className="page home-page">
      <header className="home-header">
        <div className="brand-lockup">
          <BrandMark size={38} />
          <div className="brand-copy">
            <strong>海盐账本</strong>
            <span>SEA SALT LEDGER</span>
          </div>
        </div>
        <div className="home-header-actions">
          <button type="button" className="icon-button subtle calendar-entry" onClick={() => navigate(`/calendar?month=${month}`)} aria-label="账单日历">
            <Icon name="calendar" size={19} />
          </button>
        </div>
      </header>

      <div className="home-intro">
        <div>
          <p className="eyebrow">{monthOverline(month)} · 账本</p>
          <h1>{greeting()}，好好生活</h1>
        </div>
        <MonthSwitcher
          month={month}
          onChange={(next) => {
            setMonthState(next);
            setActiveMonth(next);
          }}
          monthsWithData={monthsWithData}
          label="账单月份"
        />
      </div>

      <section className={`hero-card ${totals.balance < 0 ? 'negative' : ''}`} aria-label="本月收支概览">
        <div className="hero-sun" aria-hidden="true" />
        <svg className="hero-waves" viewBox="0 0 520 180" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-30 118C45 78 106 152 185 113C264 74 326 137 403 101C459 75 501 87 550 110" />
          <path d="M-40 143C37 103 115 169 196 132C278 95 342 159 419 123C473 98 514 110 555 132" />
          <path d="M-20 166C58 129 126 183 208 153C290 123 361 178 440 148C484 131 516 138 548 151" />
        </svg>
        <div className="hero-top">
          <span>{periodLabel}结余</span>
          <span className="hero-caption">{periodLabel} {monthTransactions.length} 笔</span>
        </div>
        <div className="hero-balance">
          <span className="hero-currency">¥</span>
          <strong>{formatAmount(Math.abs(totals.balance))}</strong>
          {totals.balance < 0 ? <span className="hero-negative">负</span> : null}
        </div>
        <div className="hero-summary">
          <div>
            <span><i className="summary-dot expense" />{periodLabel}支出</span>
            <strong>¥{formatAmount(totals.expense)}</strong>
          </div>
          <div>
            <span><i className="summary-dot income" />{periodLabel}收入</span>
            <strong>¥{formatAmount(totals.income)}</strong>
          </div>
          <div className="today-stat">
            <span>{isCurrentView ? '今日支出' : '日均支出'}</span>
            <strong>¥{formatAmount(thirdStatValue)}</strong>
          </div>
        </div>
        {budget > 0 ? (
          <div className="budget-strip">
            <div className="budget-strip-top">
              <span>月预算 ¥{formatAmount(budget)}</span>
              <span className={budgetLeft < 0 ? 'over' : ''}>
                {budgetLeft >= 0 ? `还剩 ¥${formatAmount(budgetLeft)}` : `超支 ¥${formatAmount(Math.abs(budgetLeft))}`}
              </span>
            </div>
            <div className={`budget-track ${budgetLeft < 0 ? 'over' : ''}`}>
              <span style={{ width: `${budgetPercent}%` }} />
            </div>
            {isCurrentView && budgetLeft >= 0 ? (
              <div className="budget-daily">
                <span>本月还剩 {daysRemaining} 天</span>
                <span>日均可用 ¥{formatAmount(budgetDaily)}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <button type="button" className="budget-hint" onClick={() => navigate('/settings?focus=budget')}>
            <Icon name="sparkles" size={13} />
            设一个月度预算，给花费一点方向
            <Icon name="chevron-right" size={13} />
          </button>
        )}
      </section>

      {state.transactions.length > 0 && quickCategories.length ? (
        <section className="quick-entry" aria-label="快捷记账">
          <div className="quick-entry-list">
            {quickCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="quick-entry-chip"
                onClick={() => navigate(`/record?type=expense&category=${category.id}`)}
              >
                <CategoryAvatar category={category} size={36} />
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ledger-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRANSACTIONS</p>
            <h2>{periodLabel}明细 <span>{monthTransactions.length}</span></h2>
          </div>
          <div className="filter-chips" role="group" aria-label="筛选收支类型">
            {([
              ['all', '全部'],
              ['expense', '支出'],
              ['income', '收入'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {groups.length ? (
          <div className="transaction-groups">
            {groups.map((group) => (
              <section className="day-group" key={group.date}>
                <header className="day-header">
                  <div className="day-label">
                    <span>{dayHeading(group.date)}</span>
                    {group.date === todayISO() ? <i className="today-dot" /> : null}
                  </div>
                  <div className="day-totals">
                    {group.expense > 0 ? <span>支出 {formatAmount(group.expense)}</span> : null}
                    {group.income > 0 ? <span className="income">收入 +{formatAmount(group.income)}</span> : null}
                  </div>
                </header>
                <div className="day-rows card-list">
                  {group.transactions.map((transaction) => (
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
          </div>
        ) : emptyLedger ? (
          <div className="onboarding-card">
            <EmptyState
              title="把第一笔，记在这里"
              description="先记下今天的第一笔。数据只留在你的设备里，安静又私密。"
              icon="fish"
              action={
                <button type="button" className="button primary" onClick={() => navigate('/record')}>
                  <Icon name="plus" size={17} /> 记第一笔
                </button>
              }
            />
            <button
              type="button"
              className="text-button demo-link"
              onClick={() => {
                try {
                  const targetMonth = currentMonth();
                  loadDemo();
                  setMonthState(targetMonth);
                  setActiveMonth(targetMonth);
                  toast('示例账本已就位，随便逛逛吧', 'success');
                } catch (error) {
                  toast(error instanceof Error ? error.message : '载入失败', 'error');
                }
              }}
            >
              先看看示例账本 <Icon name="chevron-right" size={13} />
            </button>
          </div>
        ) : (
          <EmptyState
            title={filter === 'all' ? '这个月还没有账单' : filter === 'expense' ? '这个月还没有支出' : '这个月还没有收入'}
            description="换个月份看看，或者把刚刚的消费记下来。"
            icon="calendar"
            action={
              <button type="button" className="button primary" onClick={() => navigate('/record')}>
                <Icon name="plus" size={17} /> 记一笔
              </button>
            }
          />
        )}
      </section>

      <p className="local-note">
        <Icon name="shield-check" size={13} />
        账单保存在本设备，不会上传
      </p>

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        title="删除这笔账单？"
        description={targetTransaction ? `${targetTransaction.note || '这笔账单'} · ¥${formatAmount(targetTransaction.amount)}，删除后无法恢复。` : '删除后无法恢复。'}
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
