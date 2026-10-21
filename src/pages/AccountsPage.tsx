import { useMemo, useState } from 'react';
import type { Account } from '../types';
import { useLedger } from '../store/LedgerContext';
import { useToast } from '../store/ToastContext';
import { ACCOUNT_COLORS } from '../data/categoryMeta';
import { Icon } from '../components/Icon';
import { AccountAvatar, EmptyState, TopBar } from '../components/Common';
import { ConfirmSheet, Sheet } from '../components/Sheet';

const ACCOUNT_ICONS = [
  { name: 'message-circle', label: '微信' },
  { name: 'wallet', label: '钱包' },
  { name: 'landmark', label: '银行卡' },
  { name: 'banknote', label: '现金' },
  { name: 'credit-card', label: '信用卡' },
  { name: 'circle-help', label: '其他' },
];

interface EditorState {
  id?: string;
  name: string;
  icon: string;
  color: string;
}

export function AccountsPage() {
  const { state, addAccount, updateAccount, deleteAccount, updateSettings } = useLedger();
  const toast = useToast();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of state.transactions) {
      counts.set(transaction.accountId, (counts.get(transaction.accountId) ?? 0) + 1);
      if (transaction.toAccountId) {
        counts.set(transaction.toAccountId, (counts.get(transaction.toAccountId) ?? 0) + 1);
      }
    }
    return counts;
  }, [state.transactions]);

  const accounts = useMemo(
    () => [...state.accounts].sort((a, b) => {
      if (a.id === state.settings.defaultAccountId) return -1;
      if (b.id === state.settings.defaultAccountId) return 1;
      return (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0);
    }),
    [state.accounts, state.settings.defaultAccountId, usage],
  );

  const openNew = () => {
    setEditor({ name: '', icon: 'wallet', color: ACCOUNT_COLORS[0] });
  };

  const save = () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      toast('给账户起个名字吧', 'error');
      return;
    }
    try {
      if (editor.id) {
        updateAccount(editor.id, { name: editor.name, icon: editor.icon, color: editor.color });
        toast('账户已更新', 'success');
      } else {
        addAccount({ name: editor.name, icon: editor.icon, color: editor.color });
        toast('账户已添加', 'success');
      }
      setEditor(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : '保存失败', 'error');
    }
  };

  return (
    <main className="page manager-page">
      <TopBar
        title="账户管理"
        subtitle={`${state.accounts.length} 个账户`}
        right={<button type="button" className="icon-button accent" onClick={openNew} aria-label="新增账户"><Icon name="plus" size={21} /></button>}
      />
      <p className="manager-intro">账户用来区分钱从哪里花出。导入账单时会自动创建「未关联」账户。</p>

      {accounts.length ? (
        <div className="manager-list card-list">
          {accounts.map((account) => {
            const count = usage.get(account.id) ?? 0;
            const isDefault = state.settings.defaultAccountId === account.id;
            return (
              <div className="manager-row" key={account.id}>
                <AccountAvatar account={account} size={42} />
                <div className="manager-row-main">
                  <div>
                    <strong>{account.name}</strong>
                    {isDefault ? <span className="mini-tag default">默认</span> : null}
                    {account.custom ? <span className="mini-tag">自定义</span> : <span className="mini-tag builtin">内置</span>}
                  </div>
                  <small>{count} 笔账单</small>
                </div>
                <div className="manager-actions">
                  {!isDefault ? (
                    <button
                      type="button"
                      className="text-button small"
                      onClick={() => {
                        updateSettings({ defaultAccountId: account.id });
                        toast('默认账户已更新');
                      }}
                    >
                      设为默认
                    </button>
                  ) : null}
                  {account.custom ? (
                    <>
                      <button type="button" className="round-action" aria-label={`编辑${account.name}`} onClick={() => setEditor({
                        id: account.id,
                        name: account.name,
                        icon: account.icon,
                        color: account.color,
                      })}>
                        <Icon name="pencil" size={15} />
                      </button>
                      {count === 0 ? (
                        <button type="button" className="round-action danger" aria-label={`删除${account.name}`} onClick={() => setDeleteTarget(account)}>
                          <Icon name="trash" size={15} />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="还没有账户" description="添加一个账户，记账时就能用上。" icon="wallet" action={<button type="button" className="button primary" onClick={openNew}><Icon name="plus" size={17} /> 新增账户</button>} />
      )}

      <p className="manager-note"><Icon name="circle-help" size={14} /> 有账单的账户不能删除；内置账户可以设为默认账户。</p>

      <Sheet
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor?.id ? '编辑账户' : '新增账户'}
        subtitle="账户只用于分类整理，不计算余额"
        footer={<button type="button" className="button primary full" onClick={save}>{editor?.id ? '保存修改' : '添加账户'}</button>}
      >
        {editor ? (
          <div className="category-editor">
            <div className="editor-preview">
              <span className="avatar" style={{ width: 64, height: 64, color: editor.color, backgroundColor: `${editor.color}18` }}>
                <Icon name={editor.icon} size={29} />
              </span>
              <strong>{editor.name || '账户预览'}</strong>
              <small>账户</small>
            </div>
            <label className="field">
              <span>名称</span>
              <input
                value={editor.name}
                onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                placeholder="例如：招商银行卡、现金、饭卡"
                maxLength={12}
                autoFocus
              />
            </label>
            <div className="editor-group">
              <span className="editor-label">颜色</span>
              <div className="color-palette">
                {ACCOUNT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={editor.color === color ? 'active' : ''}
                    style={{ background: color }}
                    onClick={() => setEditor({ ...editor, color })}
                    aria-label={`选择颜色 ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="editor-group">
              <span className="editor-label">图标</span>
              <div className="icon-palette">
                {ACCOUNT_ICONS.map((choice) => (
                  <button
                    key={choice.name}
                    type="button"
                    className={editor.icon === choice.name ? 'active' : ''}
                    onClick={() => setEditor({ ...editor, icon: choice.name })}
                    aria-label={choice.label}
                    title={choice.label}
                  >
                    <Icon name={choice.name} size={19} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Sheet>

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        title={`删除「${deleteTarget?.name ?? ''}」？`}
        description="这个账户还没有被任何账单使用，删除后不可恢复。"
        confirmLabel="删除账户"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          try {
            deleteAccount(deleteTarget.id);
            toast('账户已删除');
          } catch (error) {
            toast(error instanceof Error ? error.message : '删除失败', 'error');
          }
        }}
      />
    </main>
  );
}
