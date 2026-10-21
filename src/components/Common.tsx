import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Account, Category, ImportIssue } from '../types';
import { addMonths, monthLabel, todayISO } from '../lib/date';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export function CategoryAvatar({
  category,
  size = 40,
}: {
  category: Pick<Category, 'icon' | 'color' | 'name'>;
  size?: number;
}) {
  return (
    <span
      className="avatar category-avatar"
      style={{
        width: size,
        height: size,
        color: category.color,
        backgroundColor: `${category.color}18`,
      }}
      aria-hidden="true"
    >
      <Icon name={category.icon} size={Math.round(size * 0.46)} strokeWidth={1.9} />
    </span>
  );
}

export function AccountAvatar({
  account,
  size = 38,
}: {
  account: Pick<Account, 'icon' | 'color' | 'name'>;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        color: account.color,
        backgroundColor: `${account.color}18`,
      }}
      aria-hidden="true"
    >
      <Icon name={account.icon} size={Math.round(size * 0.46)} strokeWidth={1.9} />
    </span>
  );
}

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
  backLabel = '返回',
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  backLabel?: string;
}) {
  return (
    <header className="top-bar">
      <button
        type="button"
        className="icon-button"
        aria-label={backLabel}
        onClick={() => {
          if (onBack) onBack();
          else if (window.history.length > 1) window.history.back();
          else window.location.hash = '#/';
        }}
      >
        <Icon name="chevron-left" size={22} strokeWidth={2} />
      </button>
      <div className="top-bar-title">
        {title ? <h1>{title}</h1> : null}
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="top-bar-right">{right}</div>
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: string; count?: number }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={`segmented ${className}`} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={15} /> : null}
          <span>{option.label}</span>
          {option.count !== undefined ? <em>{option.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  icon = 'waves',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-art" aria-hidden="true">
        <span className="empty-orbit orbit-one" />
        <span className="empty-orbit orbit-two" />
        <span className="empty-icon"><Icon name={icon} size={30} strokeWidth={1.5} /></span>
        <span className="empty-dot" />
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action || secondaryAction ? (
        <div className="empty-actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export function MonthSwitcher({
  month,
  onChange,
  monthsWithData,
  label = '账单月份',
}: {
  month: string;
  onChange: (month: string) => void;
  monthsWithData?: Set<string>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="month-switcher" onClick={() => setOpen(true)}>
        <span className="month-switcher-label">{label}</span>
        <span className="month-switcher-value">
          {monthLabel(month)}
          <Icon name="chevron-down" size={15} strokeWidth={2.2} />
        </span>
      </button>
      <MonthPicker
        open={open}
        month={month}
        monthsWithData={monthsWithData}
        onClose={() => setOpen(false)}
        onChange={(next) => {
          onChange(next);
          setOpen(false);
        }}
      />
    </>
  );
}

export function YearSwitcher({
  year,
  onChange,
  yearsWithData,
  label = '统计年份',
}: {
  year: string | number;
  onChange: (year: string) => void;
  yearsWithData?: Set<number>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const numericYear = Number(year);
  const years = useMemo(() => {
    const values = new Set<number>();
    const dataYears = [...(yearsWithData ?? [])];
    const min = dataYears.length ? Math.min(...dataYears) : currentYear - 3;
    const max = dataYears.length ? Math.max(...dataYears) : currentYear + 1;
    for (let value = Math.min(min, numericYear - 1); value <= Math.max(max, numericYear + 1, currentYear); value += 1) {
      values.add(value);
    }
    values.add(numericYear);
    return [...values].sort((a, b) => b - a);
  }, [yearsWithData, numericYear, currentYear]);

  return (
    <>
      <button type="button" className="month-switcher" onClick={() => setOpen(true)}>
        <span className="month-switcher-label">{label}</span>
        <span className="month-switcher-value">
          {Number(year)}年
          <Icon name="chevron-down" size={15} strokeWidth={2.2} />
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="选择年份" subtitle="看一整年的花费与收获" className="year-sheet">
        <div className="year-grid">
          {years.map((value) => {
            const selected = value === numericYear;
            const hasData = yearsWithData?.has(value);
            return (
              <button
                key={value}
                type="button"
                className={`year-cell ${selected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(String(value));
                  setOpen(false);
                }}
              >
                <strong>{value}</strong>
                <span>{value === currentYear ? '今年' : '年'}</span>
                {hasData ? <i className="month-dot" /> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="year-current-button"
          onClick={() => {
            onChange(String(currentYear));
            setOpen(false);
          }}
        >
          回到今年
        </button>
      </Sheet>
    </>
  );
}

export function MonthPicker({
  open,
  month,
  monthsWithData,
  onChange,
  onClose,
}: {
  open: boolean;
  month: string;
  monthsWithData?: Set<string>;
  onChange: (month: string) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const todayMonth = todayISO().slice(0, 7);

  useEffect(() => {
    if (open) setYear(Number(month.slice(0, 4)));
  }, [open, month]);

  const years = useMemo(() => {
    const values: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let value = currentYear - 6; value <= currentYear + 2; value += 1) values.push(value);
    if (!values.includes(year)) values.push(year);
    return values.sort((a, b) => a - b);
  }, [year]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="选择月份"
      subtitle="轻点月份，查看那一页的生活"
      className="month-sheet"
    >
      <div className="year-switcher">
        <button type="button" className="icon-button" onClick={() => setYear((value) => value - 1)} aria-label="上一年">
          <Icon name="chevron-left" size={20} />
        </button>
        <div className="year-display">
          <strong>{year}</strong>
          <span>年</span>
        </div>
        <button type="button" className="icon-button" onClick={() => setYear((value) => value + 1)} aria-label="下一年">
          <Icon name="chevron-right" size={20} />
        </button>
      </div>
      <div className="month-grid">
        {MONTH_NAMES.map((name, index) => {
          const value = `${year}-${String(index + 1).padStart(2, '0')}`;
          const selected = value === month;
          const hasData = monthsWithData?.has(value);
          const isCurrent = value === todayMonth;
          return (
            <button
              key={value}
              type="button"
              className={`month-cell ${selected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => onChange(value)}
            >
              <span>{name.replace('月', '')}</span>
              <small>{index + 1}月</small>
              {hasData ? <i className="month-dot" /> : null}
            </button>
          );
        })}
      </div>
      <div className="month-sheet-foot">
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setYear(Number(todayMonth.slice(0, 4)));
            onChange(todayMonth);
          }}
        >
          回到本月
        </button>
        <div className="year-quick">
          {years.slice(-5).map((value) => (
            <button
              key={value}
              type="button"
              className={value === year ? 'year-chip active' : 'year-chip'}
              onClick={() => setYear(value)}
            >
              {String(value).slice(2)}
            </button>
          ))}
        </div>
      </div>
      <div className="month-legend">
        <span><i className="month-dot" /> 有账单</span>
        <span><i className="month-dot current-dot" /> 本月</span>
        <button type="button" className="text-button" onClick={() => onChange(addMonths(month, -1))}>
          上一月
        </button>
      </div>
    </Sheet>
  );
}

export function ImportIssueList({ issues }: { issues: ImportIssue[] }) {
  if (!issues.length) return null;
  return (
    <details className="issue-details">
      <summary>查看跳过原因</summary>
      <ul>
        {issues.slice(0, 12).map((issue, index) => (
          <li key={`${issue.file}-${issue.row}-${index}`}>
            <span>{issue.file}{issue.row ? ` 第 ${issue.row} 行` : ''}</span>
            <em>{issue.reason}</em>
          </li>
        ))}
      </ul>
      {issues.length > 12 ? <p>仅显示前 12 条问题，其余行已跳过。</p> : null}
    </details>
  );
}
