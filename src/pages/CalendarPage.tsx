import { useEffect, useMemo, useState } from 'react';
import { useLedger } from '../store/LedgerContext';
import { navigate, useRoute } from '../store/router';
import { useToast } from '../store/ToastContext';
import { daysInMonth, monthLabel, monthOf, todayISO, weekdayCN } from '../lib/date';
import { getActiveMonth, setActiveMonth } from '../lib/activeMonth';
import { formatAmount } from '../lib/money';
import { sortTransactions } from '../lib/stats';
import { buildMonthCalendar, defaultCalendarDay, expenseHeat, WEEKDAY_LABELS } from '../lib/calendar';
import { Icon } from '../components/Icon';
import { EmptyState, MonthSwitcher, TopBar } from '../components/Common';
import { ConfirmSheet } from '../components/Sheet';
import { TransactionRow } from '../components/TransactionRow';

export function CalendarPage() {
  const { state, deleteTransaction } = useLedger();
  const route = useRoute();
  const toast = useToast();
  const queryMonth = route.query.get('month');
  const initialMonth = queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) ? queryMonth : getActiveMonth();
  const [month, setMonthState] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    const dayValue = route.query.get('day');
    if (!dayValue || !dayValue.startsWith(initialMonth)) return null;
    const day = Number(dayValue.slice(8, 10));
    return day >= 1 && day <= daysInMonth(initialMonth) ? day : null;
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const monthsWithData = useMemo(
    () => new Set(state.transactions.map((transaction) => monthOf(transaction.date))),
    [state.transactions],
  );
  const monthTransactions = useMemo(
    () => state.transactions.filter((transaction) => transaction.date.startsWith(month)),
    [state.transactions, month],
  );
  const calendar = useMemo(() => buildMonthCalendar(monthTransactions, month), [monthTransactions, month]);
  const categoryMap = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  const accountMap = useMemo(() => new Map(state.accounts.map((account) => [account.id, account])), [state.accounts]);

  const defaultDay = defaultCalendarDay(calendar);
  const activeDay = selectedDay ?? defaultDay;
  const selectedDate = `${month}-${String(activeDay).padStart(2, '0')}`;
  const selectedDayData = calendar.days.find((day) => day.day === activeDay) ?? calendar.days[0];
  const selectedTransactions = useMemo(
    () => sortTransactions(monthTransactions.filter((transaction) => transaction.date === selectedDate)),
    [monthTransactions, selectedDate],
  );
  const recordedDays = calendar.days.filter((day) => day.count > 0).length;
  const monthExpense = calendar.days.reduce((total, day) => total + day.expense, 0);
  const monthIncome = calendar.days.reduce((total, day) => total + day.income, 0);
  const targetTransaction = deleteTarget
    ? state.transactions.find((transaction) => transaction.id === deleteTarget)
    : undefined;

  useEffect(() => {
    setActiveMonth(month);
  }, [month]);

  const changeMonth = (next: string) => {
    setMonthState(next);
    setSelectedDay(null);
  };

  const addForSelectedDay = () => {
    navigate(`/record?date=${selectedDate}&from=calendar`);
  };

  return (
    <main className="page detail-page calendar-page">
      <TopBar
        title="账单日历"
        subtitle="按天翻看你的生活"
        right={<button type="button" className="icon-button accent" onClick={addForSelectedDay} aria-label="在选中日期记一笔"><Icon name="plus" size={21} /></button>}
      />

      <header className="calendar-heading">
        <div>
          <p className="eyebrow">CALENDAR</p>
          <h1>{monthLabel(month)}</h1>
        </div>
        <MonthSwitcher month={month} onChange={changeMonth} monthsWithData={monthsWithData} label="日历月份" />
      </header>

      <section className="calendar-summary" aria-label="本月日历概览">
        <div>
          <span>支出</span>
          <strong>¥{formatAmount(monthExpense)}</strong>
        </div>
        <div>
          <span>收入</span>
          <strong>¥{formatAmount(monthIncome)}</strong>
        </div>
        <div>
          <span>记账</span>
          <strong>{recordedDays} 天</strong>
        </div>
      </section>

      <section className="calendar-card" aria-label={`${monthLabel(month)}账单日历`}>
        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="calendar-grid">
          {calendar.cells.map((day, index) => {
            if (!day) return <span key={`blank-${index}`} className="calendar-blank" aria-hidden="true" />;
            const heat = expenseHeat(day.expense, calendar.maxExpense);
            const selected = day.day === activeDay;
            const isToday = day.date === todayISO();
            return (
              <button
                key={day.date}
                type="button"
                className={`calendar-day ${selected ? 'selected' : ''} ${isToday ? 'today' : ''} ${day.count ? 'has-data' : ''}`}
                style={heat > 0 ? { backgroundColor: `rgba(18, 107, 91, ${0.045 + heat * 0.15})` } : undefined}
                onClick={() => setSelectedDay(day.day)}
                aria-pressed={selected}
                aria-label={`${day.date}，支出 ${formatAmount(day.expense)} 元，收入 ${formatAmount(day.income)} 元，${day.count} 笔`}
              >
                <span className="calendar-day-number">{day.day}</span>
                <span className="calendar-day-dots">
                  {day.expense > 0 ? <i className="expense-dot" /> : null}
                  {day.income > 0 ? <i className="income-dot" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>颜色越深，支出越多</span>
          <span className="calendar-legend-keys">
            <span><i className="calendar-key-dot expense" />支出</span>
            <span><i className="calendar-key-dot income" />收入</span>
          </span>
        </div>
      </section>

      <section className="calendar-day-detail">
        <header className="calendar-day-head">
          <div>
            <p className="eyebrow">{selectedDate === todayISO() ? 'TODAY' : 'DAY DETAIL'}</p>
            <h2>{Number(selectedDate.slice(5, 7))}月{activeDay}日 · {weekdayCN(selectedDate)}</h2>
          </div>
          <button type="button" className="text-button add-day-button" onClick={addForSelectedDay}>
            <Icon name="plus" size={14} /> 在这天记一笔
          </button>
        </header>

        <div className="calendar-day-totals">
          <span>支出 <strong>¥{formatAmount(selectedDayData?.expense ?? 0)}</strong></span>
          <span>收入 <strong>¥{formatAmount(selectedDayData?.income ?? 0)}</strong></span>
          <span>{selectedTransactions.length} 笔</span>
        </div>

        {selectedTransactions.length ? (
          <div className="day-rows card-list">
            {selectedTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                category={transaction.categoryId ? categoryMap.get(transaction.categoryId) : undefined}
                account={accountMap.get(transaction.accountId)}
                toAccount={transaction.toAccountId ? accountMap.get(transaction.toAccountId) : undefined}
                onEdit={() => navigate(`/record/${transaction.id}?from=calendar&month=${month}&day=${selectedDate}`)}
                onDelete={() => setDeleteTarget(transaction.id)}
              />
            ))}
          </div>
        ) : (
          <div className="calendar-empty">
            <EmptyState
              title="这一天还没有账单"
              description="日子还长，想起什么，随手记下来。"
              icon="calendar"
              action={
                <button type="button" className="button primary" onClick={addForSelectedDay}>
                  <Icon name="plus" size={17} /> 记一笔
                </button>
              }
            />
          </div>
        )}
      </section>

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
