import { useEffect, useMemo, useState } from 'react';
import { useLedger } from '../store/LedgerContext';
import { navigate } from '../store/router';
import {
  currentMonth,
  daysInMonth,
  monthLabel,
  monthNumberLabel,
  numericDate,
  todayISO,
} from '../lib/date';
import { getActiveMonth, setActiveMonth } from '../lib/activeMonth';
import { formatAmount, formatNumber, percent, sum } from '../lib/money';
import {
  activeMonthCount,
  categoryBreakdown,
  comparisonWindow,
  dayCountForAverage,
  getTransactionIndex,
  monthTotals,
  monthlyTotalsForYear,
  totalThroughDay,
  transactionDateRange,
  transactionsInMonth,
  transactionsInYear,
  uniqueDays,
  weeklyTotals,
  yearAverageDivisor,
  yearComparison,
  yearlyTotals,
} from '../lib/stats';
import type { CategorySlice } from '../lib/stats';
import { EmptyState, MonthSwitcher, Segmented, YearSwitcher } from '../components/Common';
import { Icon } from '../components/Icon';

type FlowType = 'expense' | 'income';
type StatsMode = 'month' | 'year' | 'all';
type StatsScope = 'month' | 'year' | 'all';

const OTHER_COLOR = '#B7B1A5';

interface ChartSlice {
  name: string;
  color: string;
  total: number;
  percent: number;
  count: number;
  offset: number;
}

function makeChartSlices(slices: CategorySlice[], total: number): ChartSlice[] {
  const top = slices.slice(0, 5);
  const rest = slices.slice(5);
  const restTotal = sum(rest.map((slice) => slice.total));
  const restCount = rest.reduce((count, slice) => count + slice.count, 0);
  const base = [
    ...top.map((slice) => ({
      name: slice.category.name,
      color: slice.category.color,
      total: slice.total,
      percent: slice.percent,
      count: slice.count,
    })),
    ...(restTotal > 0
      ? [{
          name: '其他分类',
          color: OTHER_COLOR,
          total: restTotal,
          percent: percent(restTotal, total),
          count: restCount,
        }]
      : []),
  ];
  let offset = 0;
  return base.map((slice) => {
    const item = { ...slice, offset };
    offset += slice.percent;
    return item;
  });
}

function CategoryDonutPanel({
  slices,
  total,
  type,
  scope,
}: {
  slices: CategorySlice[];
  total: number;
  type: FlowType;
  scope: StatsScope;
}) {
  const chartSlices = makeChartSlices(slices, total);
  return (
    <section className="panel donut-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">CATEGORIES</p>
          <h2>{type === 'expense' ? '钱花在了哪里' : '钱从哪里来'}</h2>
        </div>
        <span className="panel-badge">
          {scope === 'all' ? '全部' : scope === 'year' ? '全年' : '本月'} · {slices.length} 类
        </span>
      </div>
      <div className="donut-layout">
        <div className="donut-chart">
          <svg viewBox="0 0 120 120" role="img" aria-label={`${type === 'expense' ? '支出' : '收入'}分类占比`}>
            <circle cx="60" cy="60" r="46" fill="none" stroke="var(--line-soft)" strokeWidth="13" />
            {chartSlices.map((slice) => {
              const dash = Math.max(slice.percent - 1, 0.35);
              return (
                <circle
                  key={slice.name}
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="13"
                  pathLength="100"
                  strokeDasharray={`${dash} ${100 - dash}`}
                  strokeDashoffset={-slice.offset}
                  transform="rotate(-90 60 60)"
                  className="donut-segment"
                />
              );
            })}
          </svg>
          <div className="donut-center">
            <span>{type === 'expense' ? '支出' : '收入'}</span>
            <strong>¥{formatAmount(total)}</strong>
          </div>
        </div>
        <div className="donut-legend">
          {chartSlices.map((slice) => (
            <div className="legend-row" key={slice.name}>
              <span className="legend-name"><i style={{ background: slice.color }} />{slice.name}</span>
              <span className="legend-amount">¥{formatAmount(slice.total)}</span>
              <span className="legend-percent">{formatNumber(slice.percent, slice.percent >= 10 ? 0 : 1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RankingPanel({ slices, scope }: { slices: CategorySlice[]; scope: StatsScope }) {
  return (
    <section className="panel ranking-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">RANKING</p>
          <h2>{scope === 'all' ? '累计分类排行' : scope === 'year' ? '年度分类排行' : '分类排行'}</h2>
        </div>
        <span className="panel-badge">TOP {Math.min(slices.length, 8)}</span>
      </div>
      <div className="ranking-list">
        {slices.slice(0, 8).map((slice, index) => (
          <div className="ranking-row" key={slice.category.id}>
            <span className="rank-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="rank-main">
              <div className="rank-title">
                <span className="rank-name"><i style={{ background: slice.category.color }} />{slice.category.name}</span>
                <span className="rank-amount">¥{formatAmount(slice.total)} <em>{formatNumber(slice.percent, 1)}%</em></span>
              </div>
              <div className="rank-track">
                <span style={{ width: `${slice.percent}%`, background: slice.category.color }} />
              </div>
              <div className="rank-meta">{slice.count} 笔 · 平均 ¥{formatAmount(slice.total / slice.count)}</div>
            </div>
          </div>
        ))}
      </div>
      {slices.length > 8 ? (
        <p className="ranking-more">
          其余 {slices.length - 8} 个分类占 {formatNumber(100 - sum(slices.slice(0, 8).map((slice) => slice.percent)), 1)}%
        </p>
      ) : null}
    </section>
  );
}

export function StatsPage() {
  const { state } = useLedger();
  const [mode, setMode] = useState<StatsMode>('month');
  const [month, setMonthState] = useState(getActiveMonth);
  const [year, setYearState] = useState(() => getActiveMonth().slice(0, 4));
  const [type, setType] = useState<FlowType>('expense');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedAllYear, setSelectedAllYear] = useState<number | null>(null);
  const isYear = mode === 'year';
  const isAll = mode === 'all';
  const scope: StatsScope = isAll ? 'all' : isYear ? 'year' : 'month';

  const transactionIndex = useMemo(() => getTransactionIndex(state.transactions), [state.transactions]);
  const monthsWithData = transactionIndex.monthSet;
  const yearsWithData = transactionIndex.yearSet;

  const monthTransactions = useMemo(
    () => transactionsInMonth(state.transactions, month),
    [state.transactions, month],
  );
  const monthTotalsValue = useMemo(() => monthTotals(monthTransactions), [monthTransactions]);
  const monthSlices = useMemo(
    () => categoryBreakdown(monthTransactions, state.categories, type),
    [monthTransactions, state.categories, type],
  );
  const weekPoints = useMemo(
    () => weeklyTotals(monthTransactions, month, type),
    [monthTransactions, month, type],
  );
  const maxWeek = useMemo(
    () => weekPoints.reduce((best, point) => (point.total > best.total ? point : best), weekPoints[0]),
    [weekPoints],
  );

  const yearTransactions = useMemo(
    () => transactionsInYear(state.transactions, year),
    [state.transactions, year],
  );
  const yearTotalsValue = useMemo(() => monthTotals(yearTransactions), [yearTransactions]);
  const yearSlices = useMemo(
    () => categoryBreakdown(yearTransactions, state.categories, type),
    [yearTransactions, state.categories, type],
  );
  const yearMonths = useMemo(
    () => monthlyTotalsForYear(state.transactions, year),
    [state.transactions, year],
  );
  const yearChartPoints = useMemo(
    () => yearMonths.map((point) => ({ ...point, value: point[type] })),
    [yearMonths, type],
  );
  const maxYearMonth = useMemo(
    () => yearChartPoints.reduce((best, point) => (point.value > best.value ? point : best), yearChartPoints[0]),
    [yearChartPoints],
  );

  const allTotalsValue = useMemo(() => monthTotals(state.transactions), [state.transactions]);
  const allSlices = useMemo(
    () => categoryBreakdown(state.transactions, state.categories, type),
    [state.transactions, state.categories, type],
  );
  const allTypeTransactions = useMemo(
    () => state.transactions.filter((transaction) => transaction.type === type),
    [state.transactions, type],
  );
  const allTypeMonthCount = useMemo(
    () => new Set(allTypeTransactions.map((transaction) => transaction.date.slice(0, 7))).size,
    [allTypeTransactions],
  );
  const allYears = useMemo(() => yearlyTotals(state.transactions), [state.transactions]);
  const allYearChartPoints = useMemo(
    () => allYears.map((point) => ({ ...point, value: point[type] })),
    [allYears, type],
  );
  const maxAllYear = useMemo(
    () => allYearChartPoints.reduce((best, point) => (point.value > best.value ? point : best), allYearChartPoints[0]),
    [allYearChartPoints],
  );
  const allDateRange = useMemo(() => transactionDateRange(state.transactions), [state.transactions]);

  const totals = isAll ? allTotalsValue : isYear ? yearTotalsValue : monthTotalsValue;
  const slices = isAll ? allSlices : isYear ? yearSlices : monthSlices;
  const total = totals[type];
  const activeTransactions = useMemo(() => {
    if (isAll) return allTypeTransactions;
    return (isYear ? yearTransactions : monthTransactions).filter((transaction) => transaction.type === type);
  }, [isAll, allTypeTransactions, isYear, yearTransactions, monthTransactions, type]);
  const periodCount = activeTransactions.length;
  const largest = useMemo(
    () => activeTransactions.reduce((max, transaction) => Math.max(max, transaction.amount), 0),
    [activeTransactions],
  );
  const average = useMemo(() => {
    if (isAll) return allTypeMonthCount > 0 ? total / allTypeMonthCount : 0;
    if (isYear) return total / yearAverageDivisor(year);
    const days = dayCountForAverage(month);
    return days > 0 ? total / days : 0;
  }, [isAll, allTypeMonthCount, isYear, total, year, month]);
  const periodDays = useMemo(() => uniqueDays(activeTransactions), [activeTransactions]);
  const activeMonths = useMemo(
    () => (isAll ? allTypeMonthCount : activeMonthCount(yearTransactions, year)),
    [isAll, allTypeMonthCount, yearTransactions, year],
  );
  const yearLargestMonth = useMemo(() => {
    const point = yearChartPoints.reduce((best, item) => (item.value > best.value ? item : best), yearChartPoints[0]);
    return point?.value ? point : null;
  }, [yearChartPoints]);

  const comparison = useMemo(() => {
    if (isAll) return { percentChange: null as number | null, previous: 0, label: '' };
    if (isYear) {
      const result = yearComparison(state.transactions, year, type);
      return {
        percentChange: result.percentChange,
        previous: result.previous,
        label: result.label,
      };
    }
    const { currentDays, previousMonth } = comparisonWindow(month);
    if (currentDays <= 0) return { percentChange: null as number | null, previous: 0, label: '上月同期' };
    const previousTransactions = transactionsInMonth(state.transactions, previousMonth);
    const current = totalThroughDay(monthTransactions, type, currentDays);
    const previous = totalThroughDay(previousTransactions, type, Math.min(currentDays, daysInMonth(previousMonth)));
    const diff = current - previous;
    return {
      percentChange: previous > 0 ? (diff / previous) * 100 : null,
      previous,
      label: '较上月同期',
    };
  }, [isAll, isYear, state.transactions, year, type, month, monthTransactions]);

  useEffect(() => {
    if (isYear || isAll) return;
    const today = todayISO();
    const fallback = month === today.slice(0, 7)
      ? Math.ceil(Number(today.slice(8, 10)) / 7)
      : maxWeek?.week ?? 1;
    setSelectedWeek(fallback);
  }, [month, type, maxWeek, isYear, isAll]);

  useEffect(() => {
    if (!isYear) return;
    const currentYear = todayISO().slice(0, 4);
    const fallback = currentYear === year ? Number(todayISO().slice(5, 7)) : maxYearMonth?.monthNumber ?? 1;
    setSelectedMonth(fallback);
  }, [isYear, year, type, maxYearMonth]);

  useEffect(() => {
    if (!isAll) return;
    const currentYear = todayISO().slice(0, 4);
    const fallback = allYearChartPoints.find((point) => String(point.year) === currentYear)?.year
      ?? allYearChartPoints[allYearChartPoints.length - 1]?.year
      ?? null;
    setSelectedAllYear(fallback);
  }, [isAll, allYearChartPoints]);

  const selectedWeekPoint = weekPoints.find((point) => point.week === selectedWeek) ?? weekPoints[0];
  const selectedMonthPoint = yearChartPoints.find((point) => point.monthNumber === selectedMonth) ?? yearChartPoints[0];
  const selectedAllYearPoint = allYearChartPoints.find((point) => point.year === selectedAllYear)
    ?? allYearChartPoints[allYearChartPoints.length - 1];
  const hasData = slices.length > 0;
  const selectedMonthLabel = selectedMonthPoint ? monthNumberLabel(selectedMonthPoint.monthNumber) : '';
  const allRangeLabel = allDateRange.min && allDateRange.max
    ? `${numericDate(allDateRange.min)} — ${numericDate(allDateRange.max)}`
    : '全部时间';
  const comparisonTone = comparison.percentChange === null || comparison.percentChange === 0
    ? 'compare-flat'
    : (comparison.percentChange > 0) === (type === 'expense')
      ? 'compare-up'
      : 'compare-down';

  const changeMonth = (next: string) => {
    setMonthState(next);
    setActiveMonth(next);
    setYearState(next.slice(0, 4));
  };

  const openMonthFromYear = (monthNumber: number) => {
    const next = `${year}-${String(monthNumber).padStart(2, '0')}`;
    changeMonth(next);
    setMode('month');
  };

  return (
    <main className="page stats-page">
      <header className="page-heading stats-heading">
        <div>
          <p className="eyebrow">INSIGHTS</p>
          <h1>统计</h1>
          <p className="page-subtitle">看见花费的方向，也看见生活的样子。</p>
        </div>
        {isAll ? (
          <span className="stats-scope-pill">
            <Icon name="calendar" size={14} />
            全部时间
          </span>
        ) : isYear ? (
          <YearSwitcher
            year={year}
            onChange={(next) => {
              setYearState(next);
              const nextMonth = `${next}-${month.slice(5, 7)}`;
              setMonthState(nextMonth);
              setActiveMonth(nextMonth);
            }}
            yearsWithData={yearsWithData}
            label="统计年份"
          />
        ) : (
          <MonthSwitcher
            month={month}
            onChange={changeMonth}
            monthsWithData={monthsWithData}
            label="统计月份"
          />
        )}
      </header>

      <div className="stats-toolbar">
        <Segmented
          value={mode}
          onChange={setMode}
          ariaLabel="统计周期"
          className="stats-mode-switch"
          options={[
            { value: 'month', label: '月度' },
            { value: 'year', label: '年度' },
            { value: 'all', label: '全部' },
          ]}
        />
        <Segmented
          value={type}
          onChange={setType}
          ariaLabel="统计类型"
          className="stats-kind-switch"
          options={[
            { value: 'expense', label: '支出' },
            { value: 'income', label: '收入' },
          ]}
        />
      </div>

      <section className={`stats-hero ${type}`} aria-label={`${isAll ? '全部' : isYear ? '年度' : '月度'}收支统计`}>
        <div className="stats-hero-top">
          <span>
            {isAll
              ? `全部账单 · 总${type === 'expense' ? '支出' : '收入'}`
              : isYear
                ? `${year}年 · 总${type === 'expense' ? '支出' : '收入'}`
                : `${monthLabel(month)} · 总${type === 'expense' ? '支出' : '收入'}`}
          </span>
          <span className="stats-count">{periodCount} 笔</span>
        </div>
        <div className="stats-total">
          <span>¥</span>{formatAmount(total)}
        </div>
        <div className="stats-compare">
          {isAll ? (
            <span className="compare-flat">{allRangeLabel} · 累计 {activeMonths} 个月</span>
          ) : comparison.percentChange === null ? (
            <span className="compare-flat">{comparison.previous === 0 ? `${comparison.label.replace('较', '')}暂无记录` : `与${comparison.label.replace('较', '')}持平`}</span>
          ) : (
            <span className={comparisonTone}>
              <Icon name={comparison.percentChange >= 0 ? 'arrow-up-right' : 'arrow-down-left'} size={14} />
              {Math.abs(comparison.percentChange).toFixed(1)}%
              <em>{comparison.label}</em>
            </span>
          )}
        </div>
        {isAll ? (
          <div className="all-time-split" aria-label="全部账单累计收支">
            <div>
              <span>累计支出</span>
              <strong>¥{formatAmount(allTotalsValue.expense)}</strong>
            </div>
            <div>
              <span>累计收入</span>
              <strong>¥{formatAmount(allTotalsValue.income)}</strong>
            </div>
            <div>
              <span>累计结余</span>
              <strong>¥{formatAmount(allTotalsValue.balance)}</strong>
            </div>
          </div>
        ) : null}
        <div className="stats-mini-grid">
          <div>
            <span>{isAll ? '月均' : isYear ? '月均' : '日均'}{type === 'expense' ? '支出' : '收入'}</span>
            <strong>¥{formatAmount(average)}</strong>
          </div>
          <div>
            <span>{isAll ? '最大单笔' : isYear ? `最高月${type === 'expense' ? '支出' : '收入'}` : '最大单笔'}</span>
            <strong>{isAll ? `¥${formatAmount(largest)}` : isYear ? (yearLargestMonth ? `¥${formatAmount(yearLargestMonth.value)}` : '—') : `¥${formatAmount(largest)}`}</strong>
          </div>
          <div>
            <span>{isAll ? '记账天数' : isYear ? '记账天数' : type === 'expense' ? '结余' : '总支出'}</span>
            <strong>
              {isAll || isYear
                ? `${periodDays} 天`
                : type === 'expense'
                  ? `¥${formatAmount(totals.balance)}`
                  : `¥${formatAmount(totals.expense)}`}
            </strong>
          </div>
        </div>
        <svg viewBox="0 0 320 90" preserveAspectRatio="none" className="stats-hero-wave" aria-hidden="true">
          <path d="M-10 60C50 25 94 75 154 49C214 23 257 68 330 34" />
          <path d="M-10 79C54 48 100 88 165 67C230 46 274 80 330 57" />
        </svg>
      </section>

      {!hasData ? (
        <EmptyState
          title={
            isAll
              ? `账本里还没有${type === 'expense' ? '支出' : '收入'}`
              : isYear
                ? `这一年还没有${type === 'expense' ? '支出' : '收入'}`
                : `这个月还没有${type === 'expense' ? '支出' : '收入'}`
          }
          description={state.transactions.length ? '换个时间看看，或者记下今天的第一笔。' : '有了第一笔账单，这里就会长出属于你的统计。'}
          icon="chart-pie"
          action={isAll ? (
            <button type="button" className="button soft" onClick={() => navigate('/record')}>
              <Icon name="plus" size={16} /> 记一笔
            </button>
          ) : !isYear ? (
            <button type="button" className="button soft" onClick={() => navigate(`/calendar?month=${month}`)}>
              <Icon name="calendar" size={16} /> 查看账单日历
            </button>
          ) : undefined}
        />
      ) : (
        <>
          {isAll ? (
            <section className="panel year-trend-panel all-time-trend-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">ALL-TIME RHYTHM</p>
                  <h2>全部年度走势</h2>
                </div>
                <span className="trend-tooltip">
                  {selectedAllYearPoint ? `${selectedAllYearPoint.year}年 · ¥${formatAmount(selectedAllYearPoint.value)}` : ''}
                </span>
              </div>
              <div className="year-chart all-year-chart">
                {allYearChartPoints.map((point) => {
                  const height = maxAllYear?.value
                    ? Math.max((point.value / maxAllYear.value) * 100, point.value > 0 ? 4 : 0)
                    : 0;
                  const active = selectedAllYearPoint?.year === point.year;
                  const isCurrentYear = String(point.year) === todayISO().slice(0, 4);
                  return (
                    <button
                      key={point.year}
                      type="button"
                      className={`year-bar ${active ? 'active' : ''} ${point.value === 0 ? 'zero' : ''} ${isCurrentYear ? 'current' : ''}`}
                      onClick={() => {
                        setSelectedAllYear(point.year);
                        setYearState(String(point.year));
                        setMonthState(`${point.year}-${month.slice(5, 7)}`);
                        setMode('year');
                      }}
                      aria-label={`${point.year}年 ${formatAmount(point.value)} 元`}
                    >
                      <span className="year-bar-fill" style={{ height: `${height}%` }} />
                      <em>{point.year}</em>
                    </button>
                  );
                })}
              </div>
              <div className="year-chart-foot">
                <span><i className="trend-dot" /> 点击柱子查看该年度统计</span>
                <span className="trend-range">{allRangeLabel}</span>
              </div>
            </section>
          ) : isYear ? (
            <section className="panel year-trend-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">MONTHLY RHYTHM</p>
                  <h2>全年月度走势</h2>
                </div>
                <span className="trend-tooltip">
                  {selectedMonthPoint ? `${selectedMonthLabel} · ¥${formatAmount(selectedMonthPoint.value)}` : ''}
                </span>
              </div>
              <div className="year-chart">
                {yearChartPoints.map((point) => {
                  const height = maxYearMonth.value > 0
                    ? Math.max((point.value / maxYearMonth.value) * 100, point.value > 0 ? 4 : 0)
                    : 0;
                  const active = selectedMonthPoint?.monthNumber === point.monthNumber;
                  const isCurrentMonth = `${year}-${String(point.monthNumber).padStart(2, '0')}` === currentMonth();
                  return (
                    <button
                      key={point.month}
                      type="button"
                      className={`year-bar ${active ? 'active' : ''} ${point.value === 0 ? 'zero' : ''} ${isCurrentMonth ? 'current' : ''}`}
                      onClick={() => setSelectedMonth(point.monthNumber)}
                      aria-label={`${monthNumberLabel(point.monthNumber)} ${formatAmount(point.value)} 元`}
                    >
                      <span className="year-bar-fill" style={{ height: `${height}%` }} />
                      <em>{point.monthNumber}</em>
                    </button>
                  );
                })}
              </div>
              <div className="year-chart-foot">
                <span><i className="trend-dot" /> 点击柱子查看月份金额</span>
                {selectedMonthPoint ? (
                  <button type="button" className="text-button" onClick={() => openMonthFromYear(selectedMonthPoint.monthNumber)}>
                    查看 {selectedMonthLabel}统计 <Icon name="chevron-right" size={13} />
                  </button>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="panel trend-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">WEEKLY RHYTHM</p>
                  <h2>每周趋势</h2>
                </div>
                <span className="trend-tooltip">
                  {selectedWeekPoint ? `第${selectedWeekPoint.week}周 · ¥${formatAmount(selectedWeekPoint.total)}` : ''}
                </span>
              </div>
              <div className="trend-chart week-chart">
                {weekPoints.map((point) => {
                  const height = maxWeek.total > 0 ? Math.max((point.total / maxWeek.total) * 100, point.total > 0 ? 4 : 0) : 0;
                  const active = selectedWeekPoint?.week === point.week;
                  const rangeLabel = `${Number(point.startDate.slice(5, 7))}月${Number(point.startDate.slice(8, 10))}日–${Number(point.endDate.slice(8, 10))}日`;
                  return (
                    <button
                      key={point.week}
                      type="button"
                      className={`trend-bar ${active ? 'active' : ''} ${point.total === 0 ? 'zero' : ''}`}
                      onClick={() => setSelectedWeek(point.week)}
                      aria-label={`第${point.week}周 ${rangeLabel} ${formatAmount(point.total)} 元`}
                    >
                      <span className="trend-bar-fill" style={{ height: `${height}%` }} />
                    </button>
                  );
                })}
              </div>
              <div className="trend-axis week-axis">
                {weekPoints.map((point) => (
                  <span key={point.week}>{point.week}周</span>
                ))}
              </div>
              <div className="trend-foot">
                <span><i className="trend-dot" /> 点击柱子查看每周金额</span>
                <button type="button" className="text-button" onClick={() => navigate(`/calendar?month=${month}`)}>
                  <Icon name="calendar" size={13} /> 日历视图
                </button>
              </div>
            </section>
          )}

          <CategoryDonutPanel slices={slices} total={total} type={type} scope={scope} />
          <RankingPanel slices={slices} scope={scope} />

          {isAll || isYear ? (
            <section className="year-note-card">
              <div className="year-note-mark"><Icon name="waves" size={20} /></div>
              <div>
                <p className="eyebrow">{isAll ? 'ALL THESE YEARS' : 'A YEAR IN A FEW LINES'}</p>
                <h2>
                  {isAll
                    ? `${allDateRange.min ? allDateRange.min.slice(0, 4) : ''}${allDateRange.max ? `–${allDateRange.max.slice(0, 4)}` : ''} 年，你认真记下了 ${activeMonths} 个月`
                    : `${year} 年，你认真记下了 ${activeMonths} 个月`}
                </h2>
                <p>
                  共 {periodDays} 天、{periodCount} 笔{type === 'expense' ? '支出' : '收入'}。
                  {isYear && yearLargestMonth
                    ? `${monthNumberLabel(yearLargestMonth.monthNumber)}是${type === 'expense' ? '花费' : '收入'}最多的一个月。`
                    : ''}
                  {slices[0] ? `占比最高的是「${slices[0].category.name}」。` : ''}
                </p>
              </div>
            </section>
          ) : null}
        </>
      )}

      <p className="local-note"><Icon name="arrow-left-right" size={13} /> 转账不计入收支统计</p>
    </main>
  );
}
