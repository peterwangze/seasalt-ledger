import { useMemo, useRef, useState, type DragEvent } from 'react';
import type { AnalysisResult, ImportMapping } from '../types';
import { useLedger } from '../store/LedgerContext';
import { navigate } from '../store/router';
import { useToast } from '../store/ToastContext';
import { numericDate, todayISO } from '../lib/date';
import { setActiveMonth } from '../lib/activeMonth';
import { formatAmount } from '../lib/money';
import { analyzeTables } from '../lib/import/analyze';
import { defaultMapping, detectImportSource, readTabularFile, type ImportSource, type RawTable } from '../lib/import/table';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { ImportIssueList, Segmented, TopBar } from '../components/Common';

interface FileError {
  fileName: string;
  message: string;
}

function formatImportRange(minDate?: string, maxDate?: string): string {
  if (!minDate || !maxDate) return '—';
  if (minDate === maxDate) return numericDate(minDate);
  const minYear = Number(minDate.slice(0, 4));
  const maxYear = Number(maxDate.slice(0, 4));
  if (minYear !== maxYear) {
    return `${minDate.slice(0, 4)}.${minDate.slice(5, 7)} — ${maxDate.slice(0, 4)}.${maxDate.slice(5, 7)}`;
  }
  if (minDate.slice(0, 7) === maxDate.slice(0, 7)) {
    return `${minYear}年${Number(minDate.slice(5, 7))}月${Number(minDate.slice(8, 10))}日 — ${Number(maxDate.slice(8, 10))}日`;
  }
  return `${minYear}年${Number(minDate.slice(5, 7))}月${Number(minDate.slice(8, 10))}日 — ${Number(maxDate.slice(5, 7))}月${Number(maxDate.slice(8, 10))}日`;
}

const GUIDE_STEPS = {
  shark: [
    ['打开「我的」', '在鲨鱼记账底部导航进入「我的」。'],
    ['进入「设置」', '找到「导出数据」或「导出账单」。'],
    ['导出并发送到电脑', '选择 CSV / Excel，通过微信、邮件或 AirDrop 发到电脑。'],
    ['回到这里上传', '可以一次选中多年的账单文件，系统会逐份识别。'],
  ],
  suishouji: [
    ['打开随手记', '进入「我的」，找到「设置」或「高级功能」。'],
    ['备份与同步', '选择「导出数据 Excel」，导出账单流水。'],
    ['发送到电脑', '把导出的 CSV / Excel 通过微信、邮件或 AirDrop 发到电脑。'],
    ['回到这里上传', '支持多文件；会优先使用「子分类」，账户和备注一并保留。'],
  ],
} as const;

function sourceLabel(source: ImportSource | 'mixed' | null): string {
  if (source === 'shark') return '鲨鱼记账';
  if (source === 'suishouji') return '随手记';
  if (source === 'mixed') return '多来源';
  return '通用格式';
}

const MAPPING_FIELDS: Array<{ key: keyof ImportMapping; label: string; hint?: string }> = [
  { key: 'date', label: '日期列', hint: '必填' },
  { key: 'time', label: '时间列', hint: '可选，独立的时间列' },
  { key: 'type', label: '收支类型列', hint: '可选，识别「支出 / 收入」' },
  { key: 'amount', label: '金额列', hint: '单列金额' },
  { key: 'expenseAmount', label: '支出金额列', hint: '和收入列搭配使用' },
  { key: 'incomeAmount', label: '收入金额列', hint: '和支出列搭配使用' },
  { key: 'category', label: '分类列' },
  { key: 'account', label: '账户列' },
  { key: 'note', label: '备注列' },
  { key: 'merchant', label: '商户列', hint: '会附加在备注后面' },
];

export function ImportPage() {
  const { state, commitImport } = useLedger();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tables, setTables] = useState<RawTable[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileErrors, setFileErrors] = useState<FileError[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [draftMapping, setDraftMapping] = useState<ImportMapping | null>(null);
  const [importing, setImporting] = useState(false);
  const [guide, setGuide] = useState<'shark' | 'suishouji'>('shark');
  const source = useMemo<ImportSource | 'mixed' | null>(() => {
    if (!tables.length) return null;
    const sources = new Set(tables.map(detectImportSource));
    return sources.size === 1 ? [...sources][0] : 'mixed';
  }, [tables]);

  const summary = analysis?.summary;
  const duplicateInfo = useMemo(() => {
    if (!summary || !analysis) return { count: 0, batch: undefined, all: false };
    const exactBatch = state.importBatches.find((batch) => batch.hash && batch.hash === summary.hash);
    const existingCounts = new Map<string, number>();
    for (const transaction of state.transactions) {
      const fingerprint = transaction.importRef?.fingerprint;
      if (!fingerprint) continue;
      existingCounts.set(fingerprint, (existingCounts.get(fingerprint) ?? 0) + 1);
    }
    let count = 0;
    for (const record of analysis.records) {
      if ((existingCounts.get(record.fingerprint) ?? 0) >= record.occurrence) count += 1;
    }
    return {
      count,
      batch: exactBatch,
      all: analysis.records.length > 0 && count === analysis.records.length,
    };
  }, [analysis, summary, state.importBatches, state.transactions]);

  const importCount = summary
    ? skipDuplicates
      ? Math.max(0, summary.validCount - duplicateInfo.count)
      : summary.validCount
    : 0;

  const chooseFiles = () => inputRef.current?.click();

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    if (files.length > 20) {
      toast('一次最多选择 20 个文件', 'error');
      return;
    }
    setBusy(true);
    setFileErrors([]);
    setAnalysis(null);
    setTables([]);
    const parsed: RawTable[] = [];
    const errors: FileError[] = [];
    for (const file of files) {
      try {
        parsed.push(await readTabularFile(file));
      } catch (error) {
        errors.push({
          fileName: file.name,
          message: error instanceof Error ? error.message : '文件读取失败',
        });
      }
    }
    if (parsed.length) {
      const next = analyzeTables(parsed);
      setTables(parsed);
      setAnalysis(next);
    }
    setFileErrors(errors);
    setBusy(false);
    if (!parsed.length) toast('这些文件暂时读不出来，请检查格式', 'error');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
  };

  const openMapping = () => {
    if (!analysis || tables.length !== 1) return;
    setDraftMapping(analysis.summary.mapping ?? defaultMapping(tables[0]));
    setMappingOpen(true);
  };

  const applyMapping = () => {
    if (!draftMapping || tables.length !== 1) return;
    const next = analyzeTables([tables[0]], draftMapping);
    setAnalysis(next);
    setMappingOpen(false);
    if (next.summary.validCount === 0) {
      toast('还是没能识别出账单，请检查日期和金额列', 'error');
    } else {
      toast(`已重新识别 ${next.summary.validCount} 笔账单`, 'success');
    }
  };

  const resetMapping = () => {
    if (!tables.length) return;
    const mapping = defaultMapping(tables[0]);
    setDraftMapping(mapping);
    const next = analyzeTables([tables[0]], mapping);
    setAnalysis(next);
  };

  const handleImport = () => {
    if (!analysis || !summary || importing) return;
    let records = analysis.records;
    if (skipDuplicates) {
      if (duplicateInfo.all) {
        toast('这个文件已经完整导入过了', 'error');
        return;
      }
      const existingCounts = new Map<string, number>();
      for (const transaction of state.transactions) {
        const fingerprint = transaction.importRef?.fingerprint;
        if (!fingerprint) continue;
        existingCounts.set(fingerprint, (existingCounts.get(fingerprint) ?? 0) + 1);
      }
      records = records.filter((record) => (existingCounts.get(record.fingerprint) ?? 0) < record.occurrence);
    }
    if (!records.length) {
      toast('没有需要导入的账单', 'error');
      return;
    }
    setImporting(true);
    try {
      const result = commitImport(records, {
        fileName: summary.fileCount && summary.fileCount > 1 ? `${summary.fileCount} 个文件` : summary.fileName,
        fileCount: summary.fileCount ?? 1,
        hash: summary.hash,
      });
      const extras: string[] = [];
      if (result.categoriesCreated) extras.push(`新增 ${result.categoriesCreated} 个分类`);
      if (result.accountsCreated) extras.push(`新增 ${result.accountsCreated} 个账户`);
      const today = todayISO();
      const dates = analysis.records.map((record) => record.date).sort();
      const targetDate = [...dates].reverse().find((date) => date <= today) ?? dates[dates.length - 1] ?? today;
      setActiveMonth(targetDate.slice(0, 7));
      toast(`已导入 ${result.added} 笔账单${extras.length ? `，${extras.join('，')}` : ''}`, 'success');
      navigate('/', { replace: true });
    } catch (error) {
      toast(error instanceof Error ? error.message : '导入失败', 'error');
      setImporting(false);
    }
  };

  return (
    <main className="page import-page">
      <TopBar title="导入账单" subtitle="把旧日账单，安稳地搬进来" />

      {!analysis && !busy ? (
        <>
          <section className="import-intro">
            <div className="import-orbit" aria-hidden="true">
              <span className="import-orbit-one" />
              <span className="import-orbit-two" />
              <span className="import-fish"><Icon name="file-spreadsheet" size={34} strokeWidth={1.5} /></span>
              <span className="import-spark">+</span>
            </div>
            <p className="eyebrow">IMPORT FROM YOUR LEDGER</p>
            <h1>导入旧账单</h1>
            <p className="import-description">
              支持鲨鱼记账、随手记导出的 CSV / Excel 文件。原分类、子分类、账户和备注都会尽量保留，重复导入时会自动提醒。
            </p>
          </section>

          <div
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={chooseFiles}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') chooseFiles();
            }}
          >
            <span className="dropzone-icon"><Icon name="upload" size={24} /></span>
            <strong>{dragActive ? '松手，把账单放进来' : '选择账单文件'}</strong>
            <span>也可以把文件拖到这里</span>
            <small>CSV / XLSX / XLS · 支持一次多选</small>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files) void handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          {fileErrors.length ? (
            <div className="file-errors">
              {fileErrors.map((error) => (
                <p key={error.fileName}><Icon name="circle-help" size={15} /><strong>{error.fileName}</strong>{error.message}</p>
              ))}
            </div>
          ) : null}

          <section className="import-help">
            <div className="panel-head">
              <div>
                <p className="eyebrow">HOW TO EXPORT</p>
                <h2>从记账 App 导出</h2>
              </div>
              <span className="panel-badge">4 步</span>
            </div>
            <Segmented
              value={guide}
              onChange={setGuide}
              ariaLabel="选择导出教程"
              className="import-source-switch"
              options={[
                { value: 'shark', label: '鲨鱼记账' },
                { value: 'suishouji', label: '随手记' },
              ]}
            />
            <ol className="steps">
              {GUIDE_STEPS[guide].map(([title, description], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{title}</strong><p>{description}</p></div>
                </li>
              ))}
            </ol>
            <p className="help-tip">
              <Icon name="shield-check" size={14} />
              文件只在你的浏览器里解析，不会上传到任何服务器。
            </p>
          </section>

          <section className="format-note">
            <Icon name="file-spreadsheet" size={18} />
            <div>
              <strong>自动识别鲨鱼记账 / 随手记常见列名</strong>
              <p>日期、收支类型、分类 / 子分类、账户、金额、备注；也支持支出/收入分成两列的文件。</p>
            </div>
          </section>
        </>
      ) : null}

      {busy ? (
        <div className="import-loading">
          <span className="loading-ring" />
          <strong>正在读账单…</strong>
          <p>一份一份来，不会等太久。</p>
        </div>
      ) : null}

      {analysis && summary && !busy ? (
        <>
          <section className="import-file-card">
            <span className="file-icon"><Icon name="file-spreadsheet" size={22} /></span>
            <div className="file-main">
              <strong>
                {summary.fileName}
                <span className={`source-tag ${source ?? 'generic'}`}>{sourceLabel(source)}</span>
              </strong>
              <span>
                {summary.sheetName ? `${summary.sheetName} · ` : ''}
                {summary.files.length ? `${summary.files.length} 个文件 · ` : ''}
                {summary.rowCount} 行
              </span>
            </div>
            <button type="button" className="text-button" onClick={chooseFiles}>重新选择</button>
          </section>

          {fileErrors.length ? (
            <div className="file-errors">
              {fileErrors.map((error) => (
                <p key={error.fileName}><Icon name="circle-help" size={15} /><strong>{error.fileName}</strong>{error.message}</p>
              ))}
            </div>
          ) : null}

          <div className="import-summary-grid">
            <div className="import-stat primary">
              <span>识别成功</span>
              <strong>{summary.validCount}<em> 笔</em></strong>
            </div>
            <div className="import-stat">
              <span>支出</span>
              <strong>¥{formatAmount(summary.expenseTotal)}</strong>
              <small>{summary.expenseCount} 笔</small>
            </div>
            <div className="import-stat">
              <span>收入</span>
              <strong>¥{formatAmount(summary.incomeTotal)}</strong>
              <small>{summary.incomeCount} 笔</small>
            </div>
            <div className="import-stat">
              <span>时间跨度</span>
              <strong className="date-range">
                {formatImportRange(summary.minDate, summary.maxDate)}
              </strong>
              <small>{summary.skippedCount ? `跳过 ${summary.skippedCount} 行` : '全部识别成功'}</small>
            </div>
          </div>

          {summary.validCount === 0 ? (
            <div className="import-warning strong">
              <Icon name="circle-help" size={18} />
              <div>
                <strong>没有识别到可导入的账单</strong>
                <p>可能是列名或日期、金额格式比较特别，试试手动调整字段。</p>
              </div>
            </div>
          ) : null}

          {duplicateInfo.count > 0 ? (
            <div className="duplicate-card">
              <div className="duplicate-main">
                <span className="duplicate-icon"><Icon name="shield-check" size={19} /></span>
                <div>
                  <strong>发现 {duplicateInfo.count} 笔疑似重复</strong>
                  <p>
                    {duplicateInfo.batch
                      ? `这个文件在 ${new Date(duplicateInfo.batch.importedAt).toLocaleDateString('zh-CN')} 已经导入过。`
                      : '和账本里已有的导入记录内容相同。'}
                  </p>
                </div>
              </div>
              <label className="switch-row">
                <span>跳过重复项</span>
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(event) => setSkipDuplicates(event.target.checked)}
                />
                <i aria-hidden="true" />
              </label>
            </div>
          ) : null}

          <section className="panel import-preview">
            <div className="panel-head">
              <div>
                <p className="eyebrow">PREVIEW</p>
                <h2>预览前几笔</h2>
              </div>
              <button type="button" className="text-button" onClick={openMapping} disabled={tables.length !== 1}>
                <Icon name="sliders" size={14} />
                调整字段
              </button>
            </div>
            {analysis.records.length ? (
              <div className="import-preview-list">
                {analysis.records.slice(0, 6).map((record, index) => (
                  <div className="import-preview-row" key={`${record.fingerprint}-${index}`}>
                    <span className={`preview-type ${record.type}`}>{record.type === 'expense' ? '支' : '收'}</span>
                    <div>
                      <strong>{record.categoryName}</strong>
                      <span>{numericDate(record.date)}{record.time ? ` ${record.time}` : ''}{record.note ? ` · ${record.note}` : ''}</span>
                    </div>
                    <b>{record.type === 'expense' ? '−' : '+'}¥{formatAmount(record.amount)}</b>
                  </div>
                ))}
                {analysis.records.length > 6 ? <p className="preview-more">还有 {analysis.records.length - 6} 笔未展示</p> : null}
              </div>
            ) : (
              <p className="preview-empty">暂无可用预览</p>
            )}
          </section>

          <section className="panel import-categories">
            <div className="panel-head">
              <div>
                <p className="eyebrow">KEEP IT FAMILIAR</p>
                <h2>原分类会保留</h2>
              </div>
              <span className="panel-badge">{summary.categoryNames.length} 个</span>
            </div>
            <div className="import-chips">
              {summary.categoryNames.slice(0, 16).map((name) => <span key={name}>{name}</span>)}
              {summary.categoryNames.length > 16 ? <span>+{summary.categoryNames.length - 16}</span> : null}
            </div>
            <p className="muted small">新分类会自动创建，导入后可在「分类管理」里改名或换图标。</p>
            {summary.accountNames.length ? (
              <p className="import-account-line">账户：{summary.accountNames.join('、')}</p>
            ) : null}
          </section>

          {summary.files.length > 1 ? (
            <section className="file-list-panel">
              <h3>文件明细</h3>
              {summary.files.map((file) => (
                <div key={file.fileName} className="file-list-row">
                  <span><Icon name="file-spreadsheet" size={15} />{file.fileName}</span>
                  <em>{file.validCount} 笔{file.skippedCount ? ` · 跳过 ${file.skippedCount}` : ''}</em>
                </div>
              ))}
            </section>
          ) : null}

          {summary.issues.length ? <ImportIssueList issues={summary.issues} /> : null}
          {tables.length > 1 ? (
            <p className="multi-file-hint"><Icon name="circle-help" size={14} /> 多文件导入使用自动识别。如有文件识别不准，请单独导入并调整字段。</p>
          ) : null}

          <div className="import-cta">
            <div>
              <strong>{importCount}<span> 笔待导入</span></strong>
              <small>
                {duplicateInfo.count > 0 && skipDuplicates ? `已排除 ${duplicateInfo.count} 笔重复` : '重复导入会自动提醒'}
              </small>
            </div>
            <button
              type="button"
              className="button primary import-button"
              onClick={handleImport}
              disabled={!importCount || importing}
            >
              {importing ? <Icon name="loader" size={18} className="spin" /> : <Icon name="check" size={18} />}
              {importing ? '正在导入' : importCount ? `导入 ${importCount} 笔` : '没有可导入账单'}
            </button>
          </div>

          <p className="import-footnote">导入后仍可逐笔编辑或删除。建议先在「我的」里导出一次备份。</p>
        </>
      ) : null}

      <Sheet
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        title="调整字段识别"
        subtitle="如果自动识别不准，可以手动指定每一列"
        footer={
          <div className="mapping-footer">
            <button type="button" className="button ghost" onClick={resetMapping}>恢复自动识别</button>
            <button type="button" className="button primary" onClick={applyMapping}>应用设置</button>
          </div>
        }
      >
        {draftMapping ? (
          <div className="mapping-form">
            <p className="mapping-tip">
              <Icon name="sparkles" size={14} />
              已自动识别列的用途，通常不需要修改。
            </p>
            {MAPPING_FIELDS.map((field) => (
              <label className="field mapping-field" key={field.key}>
                <span>{field.label}{field.hint ? <em>{field.hint}</em> : null}</span>
                <select
                  value={draftMapping[field.key]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftMapping((current) => {
                      if (!current) return current;
                      const next = { ...current, [field.key]: value };
                      if (field.key === 'amount' && value) {
                        next.expenseAmount = '';
                        next.incomeAmount = '';
                      }
                      if ((field.key === 'expenseAmount' || field.key === 'incomeAmount') && value) {
                        next.amount = '';
                      }
                      return next;
                    });
                  }}
                >
                  <option value="">未使用</option>
                  {tables[0]?.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>
            ))}
            <p className="mapping-hint">金额列与「支出/收入金额列」只需要填写一组。填了单列金额时，类型会从收支类型列或分类推断。</p>
          </div>
        ) : null}
      </Sheet>
    </main>
  );
}
