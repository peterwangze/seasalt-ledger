import { useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import type { Account, Category, Transaction } from '../types';
import { formatAmount } from '../lib/money';
import { CategoryAvatar } from './Common';
import { Icon } from './Icon';

const ACTION_WIDTH = 132;

export function TransactionRow({
  transaction,
  category,
  account,
  toAccount,
  onEdit,
  onDelete,
  compact = false,
}: {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  toAccount?: Account;
  onEdit: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, offset: 0, active: false, horizontal: false, moved: false });
  const suppressClick = useRef(false);

  const fallbackCategory: Pick<Category, 'icon' | 'color' | 'name'> = category ?? {
    icon: transaction.type === 'transfer' ? 'arrow-left-right' : 'shapes',
    color: '#8B938E',
    name: transaction.type === 'transfer' ? '转账' : '未分类',
  };

  const title = transaction.type === 'transfer'
    ? '转账'
    : fallbackCategory.name;
  const subtitle = transaction.type === 'transfer'
    ? `${account?.name ?? '账户'} → ${toAccount?.name ?? '账户'}`
    : transaction.note || (account && account.name !== '未关联' ? account.name : '无备注');
  const showAccountChip = transaction.type !== 'transfer'
    && Boolean(transaction.note)
    && Boolean(account)
    && account?.name !== '未关联';

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.tx-actions')) return;
    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      offset,
      active: true,
      horizontal: false,
      moved: false,
    };
    suppressClick.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start.active) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(dx) < 7 || Math.abs(dx) <= Math.abs(dy)) return;
      start.horizontal = true;
      start.moved = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const next = Math.max(-ACTION_WIDTH, Math.min(0, start.offset + dx));
    setOffset(next);
  };

  const finishGesture = () => {
    const start = startRef.current;
    if (!start.active) return;
    start.active = false;
    if (start.horizontal) {
      setOffset((current) => (current < -44 ? -ACTION_WIDTH : 0));
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 350);
    }
    setDragging(false);
  };

  const handleClick = () => {
    if (suppressClick.current) return;
    if (offset < 0) {
      setOffset(0);
      return;
    }
    onEdit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit();
    }
    if (event.key === 'Escape' && offset < 0) setOffset(0);
  };

  return (
    <div className={`tx-swipe ${dragging ? 'dragging' : ''} ${compact ? 'compact' : ''}`}>
      {onDelete ? (
        <div className="tx-actions" aria-hidden={offset === 0}>
          <button
            type="button"
            className="tx-action edit"
            tabIndex={offset < 0 ? 0 : -1}
            onClick={() => {
              setOffset(0);
              onEdit();
            }}
          >
            <Icon name="pencil" size={17} />
            编辑
          </button>
          <button
            type="button"
            className="tx-action delete"
            tabIndex={offset < 0 ? 0 : -1}
            onClick={() => {
              setOffset(0);
              onDelete();
            }}
          >
            <Icon name="trash" size={17} />
            删除
          </button>
        </div>
      ) : null}
      <div
        className={`tx-row ${offset < 0 ? 'swiped' : ''}`}
        style={offset < 0 || dragging
          ? { transform: `translateX(${offset}px)`, transition: dragging ? 'none' : undefined }
          : undefined}
        role="button"
        tabIndex={0}
        aria-label={`${title}，${transaction.type === 'income' ? '收入' : transaction.type === 'expense' ? '支出' : '转账'} ${formatAmount(transaction.amount)} 元`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
      >
        <CategoryAvatar category={fallbackCategory} size={42} />
        <div className="tx-main">
          <div className="tx-title-line">
            <strong>{title}</strong>
          </div>
          <div className="tx-sub-line">
            <span className="tx-note">{subtitle}</span>
            {showAccountChip ? <span className="tx-account">{account?.name}</span> : null}
          </div>
        </div>
        <div className="tx-amount">
          <span className={transaction.type}>
            {transaction.type === 'expense' ? '−' : transaction.type === 'income' ? '+' : ''}
            ¥{formatAmount(transaction.amount)}
          </span>
          {transaction.time ? <small>{transaction.time}</small> : null}
        </div>
      </div>
    </div>
  );
}
