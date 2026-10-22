import { useEffect, useMemo, useRef, useState } from 'react';
import type { LedgerState } from '../types';
import { useLedger } from '../store/LedgerContext';
import { navigate, useRoute } from '../store/router';
import { useToast } from '../store/ToastContext';
import { currentMonth, todayISO, uniqueMonthCount } from '../lib/date';
import { setActiveMonth } from '../lib/activeMonth';
import { formatAmount } from '../lib/money';
import { uniqueDays } from '../lib/stats';
import { normalizeLedgerState } from '../lib/storage';
import { downloadCsv, downloadJsonBackup } from '../lib/export';
import { BrandMark, Icon } from '../components/Icon';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { Segmented } from '../components/Common';

interface RestoreCandidate {
  fileName: string;
  state: LedgerState;
}

export function SettingsPage() {
  const { state, updateSettings, clearAllData, restoreState, storageError } = useLedger();
  const toast = useToast();
  const route = useRoute();
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<RestoreCandidate | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<'start' | 'import' | 'privacy'>('start');

  const totalTransactions = state.transactions.length;
  const days = useMemo(() => uniqueDays(state.transactions), [state.transactions]);
  const months = useMemo(() => uniqueMonthCount(state.transactions), [state.transactions]);
  const currentMonthTransactions = state.transactions.filter((transaction) => transaction.date.startsWith(currentMonth())).length;
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of state.transactions) {
      if (transaction.categoryId) counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [state.transactions]);

  useEffect(() => {
    if (route.query.get('focus') === 'budget') setBudgetOpen(true);
  }, [route.query]);

  useEffect(() => {
    if (budgetOpen) setBudgetDraft(state.settings.monthlyBudget ? String(state.settings.monthlyBudget) : '');
  }, [budgetOpen, state.settings.monthlyBudget]);

  const saveBudget = () => {
    const value = budgetDraft.trim() === '' ? 0 : Number(budgetDraft);
    if (!Number.isFinite(value) || value < 0) {
      toast('请输入有效的预算金额', 'error');
      return;
    }
    updateSettings({ monthlyBudget: Math.round(value * 100) / 100 });
    setBudgetOpen(false);
    toast(value > 0 ? '月度预算已更新' : '已关闭月度预算', 'success');
  };

  const exportJson = async () => {
    try {
      const mode = await downloadJsonBackup(state);
      toast(mode === 'shared' ? '备份已准备好，请在系统面板中保存' : '完整备份已生成', 'success');
    } catch {
      toast('导出失败，请重试', 'error');
    }
  };

  const exportCsv = async () => {
    try {
      const mode = await downloadCsv(state);
      toast(mode === 'shared' ? '账单已准备好，请在系统面板中保存' : '全部账单已导出为 CSV', 'success');
    } catch {
      toast('导出失败，请重试', 'error');
    }
  };

  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { format?: string; data?: unknown };
      if (parsed?.format !== 'seasalt-ledger-backup' || !parsed.data) {
        toast('这不是海盐账本的备份文件', 'error');
        return;
      }
      const normalized = normalizeLedgerState(parsed.data);
      if (!normalized) {
        toast('备份文件内容不完整，无法恢复', 'error');
        return;
      }
      setRestoreCandidate({ fileName: file.name, state: normalized });
    } catch {
      toast('备份文件读取失败，请检查文件是否完整', 'error');
    }
  };

  return (
    <main className="page settings-page">
      <header className="settings-heading">
        <div>
          <p className="eyebrow">YOUR LEDGER</p>
          <h1>我的</h1>
        </div>
        <span className="local-badge"><i />本地账本</span>
      </header>

      <section className="profile-card">
        <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="profile-waves" aria-hidden="true">
          <path d="M-10 90C50 55 100 110 165 80C230 50 280 100 345 65C380 46 400 55 420 68" />
          <path d="M-10 120C60 88 110 132 180 108C250 84 300 125 370 96C400 83 416 87 430 96" />
        </svg>
        <div className="profile-top">
          <BrandMark size={48} />
          <div className="profile-brand">
            <strong>海盐账本</strong>
            <span>把每一笔，过成生活</span>
          </div>
          <span className="profile-year">{new Date().getFullYear()}</span>
        </div>
        <div className="profile-stats">
          <div><strong>{totalTransactions.toLocaleString('zh-CN')}</strong><span>全部账单</span></div>
          <div><strong>{days}</strong><span>记账天数</span></div>
          <div><strong>{months}</strong><span>月份</span></div>
        </div>
        <p className="profile-foot">
          {totalTransactions
            ? `本月已记录 ${currentMonthTransactions} 笔 · 账本安放在这台设备上`
            : '账本还是空的，从第一笔开始吧'}
        </p>
      </section>

      {storageError ? (
        <div className="storage-error"><Icon name="circle-help" size={16} />{storageError}</div>
      ) : null}

      <section className="settings-section">
        <div className="settings-section-head">
          <h2>数据</h2>
          <span>搬进来，也留条后路</span>
        </div>
        <button type="button" className="import-banner" onClick={() => navigate('/import')}>
          <span className="import-banner-icon"><Icon name="file-spreadsheet" size={24} strokeWidth={1.6} /></span>
          <span className="import-banner-copy">
            <strong>导入旧账本</strong>
            <small>支持鲨鱼记账 / 随手记，多文件</small>
          </span>
          <span className="import-banner-tag">开始导入</span>
          <Icon name="chevron-right" size={17} />
        </button>
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={exportCsv}>
            <span className="settings-icon green"><Icon name="file-spreadsheet" size={19} /></span>
            <span className="settings-row-copy"><strong>导出全部账单</strong><small>CSV 表格，可用 Excel 打开</small></span>
            <Icon name="download" size={18} className="row-arrow" />
          </button>
          <button type="button" className="settings-row" onClick={exportJson}>
            <span className="settings-icon blue"><Icon name="database" size={19} /></span>
            <span className="settings-row-copy"><strong>备份整个账本</strong><small>JSON 完整备份，建议定期导出</small></span>
            <Icon name="download" size={18} className="row-arrow" />
          </button>
          <button type="button" className="settings-row" onClick={() => restoreInputRef.current?.click()}>
            <span className="settings-icon teal"><Icon name="upload" size={19} /></span>
            <span className="settings-row-copy"><strong>从备份恢复</strong><small>用 JSON 备份替换当前整个账本</small></span>
            <Icon name="chevron-right" size={17} className="row-arrow" />
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              void handleRestoreFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <h2>记账偏好</h2>
          <span>让账本更像你</span>
        </div>
        <div className="settings-card">
          <button
            type="button"
            className="settings-row"
            onClick={() => {
              setBudgetOpen(true);
            }}
          >
            <span className="settings-icon coral"><Icon name="sparkles" size={19} /></span>
            <span className="settings-row-copy">
              <strong>月度预算</strong>
              <small>{state.settings.monthlyBudget > 0 ? `每月 ¥${formatAmount(state.settings.monthlyBudget)}` : '还没设置预算'}</small>
            </span>
            <span className="row-value">{state.settings.monthlyBudget > 0 ? `¥${formatAmount(state.settings.monthlyBudget)}` : '设置'}</span>
            <Icon name="chevron-right" size={17} className="row-arrow" />
          </button>
          <button type="button" className="settings-row" onClick={() => navigate('/categories')}>
            <span className="settings-icon amber"><Icon name="tags" size={19} /></span>
            <span className="settings-row-copy"><strong>分类管理</strong><small>{state.categories.length} 个分类 · {categoryCounts.size} 个已使用</small></span>
            <Icon name="chevron-right" size={17} className="row-arrow" />
          </button>
          <button type="button" className="settings-row" onClick={() => navigate('/accounts')}>
            <span className="settings-icon violet"><Icon name="wallet" size={19} /></span>
            <span className="settings-row-copy"><strong>账户管理</strong><small>{state.accounts.length} 个账户</small></span>
            <Icon name="chevron-right" size={17} className="row-arrow" />
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <h2>关于</h2>
          <span>慢慢记，认真生活</span>
        </div>
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={() => setHelpOpen(true)}>
            <span className="settings-icon slate"><Icon name="circle-help" size={19} /></span>
            <span className="settings-row-copy"><strong>使用帮助</strong><small>记账、导入和备份的小说明</small></span>
            <Icon name="chevron-right" size={17} className="row-arrow" />
          </button>
          <button type="button" className="settings-row" onClick={() => setAboutOpen(true)}>
            <span className="settings-icon slate"><Icon name="waves" size={19} /></span>
            <span className="settings-row-copy"><strong>关于海盐账本</strong><small>版本 1.2.1 · 本地优先</small></span>
            <Icon name="chevron-right" size={17} className="row-arrow" />
          </button>
          <button type="button" className="settings-row danger-row" onClick={() => setClearOpen(true)}>
            <span className="settings-icon danger"><Icon name="trash" size={19} /></span>
            <span className="settings-row-copy"><strong>清空全部数据</strong><small>删除所有账单、分类与账户设置</small></span>
            <Icon name="chevron-right" size={17} className="row-arrow" />
          </button>
        </div>
      </section>

      <footer className="settings-footer">
        <BrandMark size={24} />
        <span>海盐账本 · SEA SALT LEDGER</span>
        <small>数据留在本设备，不上传云端</small>
      </footer>

      <Sheet
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        title="月度预算"
        subtitle="给这个月的花费，留一点边界"
        footer={
          <div className="mapping-footer">
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setBudgetDraft('');
                updateSettings({ monthlyBudget: 0 });
                setBudgetOpen(false);
                toast('已关闭月度预算');
              }}
            >
              关闭预算
            </button>
            <button type="button" className="button primary" onClick={saveBudget}>保存预算</button>
          </div>
        }
      >
        <label className="budget-input-wrap">
          <span>¥</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="100"
            placeholder="0"
            value={budgetDraft}
            onChange={(event) => setBudgetDraft(event.target.value)}
            autoFocus
          />
          <em>/ 月</em>
        </label>
        <div className="budget-presets">
          {[3000, 5000, 8000, 10000, 15000].map((value) => (
            <button
              key={value}
              type="button"
              className={Number(budgetDraft) === value ? 'active' : ''}
              onClick={() => setBudgetDraft(String(value))}
            >
              ¥{formatAmount(value).replace('.00', '')}
            </button>
          ))}
        </div>
        <p className="budget-help">预算会显示在首页结余卡片里，超出时会提醒你。</p>
      </Sheet>

      <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} title="使用帮助" subtitle="几分钟就能上手">
        <Segmented
          value={helpTab}
          onChange={setHelpTab}
          ariaLabel="帮助分类"
          className="help-tabs"
          options={[
            { value: 'start', label: '开始记账' },
            { value: 'import', label: '旧账本' },
            { value: 'privacy', label: '数据安全' },
          ]}
        />
        {helpTab === 'start' ? (
          <div className="help-content">
            <div><strong>记一笔</strong><p>点底部中间的「+」，选择支出或收入，输入金额、分类和日期即可。备注和账户可以帮助以后搜索。</p></div>
            <div><strong>看明细和统计</strong><p>首页按月展示明细，点月份可以切换。统计页会显示分类占比和每日花费趋势。左滑一条明细可以快速编辑或删除。</p></div>
            <div><strong>设置预算</strong><p>在「我的 → 月度预算」里设定金额，首页会显示预算使用进度。</p></div>
          </div>
        ) : null}
        {helpTab === 'import' ? (
          <div className="help-content">
            <div><strong>从旧记账 App 导出</strong><p>鲨鱼记账：我的 → 设置 → 导出数据；随手记：我的 → 设置 / 高级功能 → 备份与同步 → 导出数据 Excel。把 CSV / Excel 发到电脑。</p></div>
            <div><strong>一次导入多年</strong><p>在「导入旧账本」一次选中多个文件即可，系统会逐份识别。原分类、子分类、账户和备注都会保留，新分类会自动创建。</p></div>
            <div><strong>重复导入</strong><p>系统会和已导入的记录比对，发现疑似重复时默认跳过。如果同一天确实有两笔相同金额的账单，导入时仍会完整保留。</p></div>
            <div><strong>识别不准</strong><p>单文件导入时可以点「调整字段」，手动指定日期、金额、分类等列。</p></div>
          </div>
        ) : null}
        {helpTab === 'privacy' ? (
          <div className="help-content">
            <div><strong>数据就在这台设备</strong><p>海盐账本没有账号系统，也不连接服务器。账单保存在浏览器的 IndexedDB 中，不会上传。</p></div>
            <div><strong>请定期备份</strong><p>清除浏览器数据、换设备或卸载浏览器都可能让本地数据丢失。建议定期导出 JSON 完整备份和 CSV 账单。</p></div>
            <div><strong>导入文件也是本地的</strong><p>账单文件只在浏览器里解析，不会发送到任何地方。</p></div>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={aboutOpen} onClose={() => setAboutOpen(false)} title="海盐账本" subtitle="SEA SALT LEDGER">
        <div className="about-card">
          <div className="about-logo"><BrandMark size={58} /></div>
          <h3>把每一笔，过成生活。</h3>
          <p>一个轻盈、克制的本地记账本。没有社交，没有广告，没有云端账号，只有你自己的日子。</p>
          <div className="about-meta">
            <span>版本 1.2.1</span>
            <span>本地优先</span>
            <span>支持鲨鱼记账 / 随手记导入</span>
          </div>
          <p className="about-note">按自己的节奏记账，不必每一笔都完美。</p>
        </div>
      </Sheet>

      <ConfirmSheet
        open={Boolean(restoreCandidate)}
        title="用备份替换当前账本？"
        description={restoreCandidate
          ? `备份「${restoreCandidate.fileName}」包含 ${restoreCandidate.state.transactions.length.toLocaleString('zh-CN')} 笔账单。恢复后，当前账本里的所有内容会被替换。`
          : undefined}
        confirmLabel="恢复备份"
        onClose={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (!restoreCandidate) return;
          restoreState(restoreCandidate.state);
          const today = todayISO();
          const dates = restoreCandidate.state.transactions.map((transaction) => transaction.date).sort();
          const targetDate = [...dates].reverse().find((date) => date <= today) ?? dates[dates.length - 1] ?? today;
          setActiveMonth(targetDate.slice(0, 7));
          toast(`已恢复 ${restoreCandidate.state.transactions.length} 笔账单`, 'success');
          setRestoreCandidate(null);
          navigate('/');
        }}
      />

      <ConfirmSheet
        open={clearOpen}
        title="清空全部数据？"
        description="所有账单、分类、账户设置和预算都会被删除，且无法撤销。建议先到「我的」导出 JSON 备份。"
        confirmLabel="确认清空"
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearAllData();
          toast('账本已重置');
        }}
      />
    </main>
  );
}
