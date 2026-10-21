import { useMemo, useState } from 'react';
import type { Category, CategoryType } from '../types';
import { useLedger } from '../store/LedgerContext';
import { useToast } from '../store/ToastContext';
import { CATEGORY_COLORS } from '../data/categoryMeta';
import { CATEGORY_ICON_CHOICES, Icon } from '../components/Icon';
import { CategoryAvatar, EmptyState, Segmented, TopBar } from '../components/Common';
import { ConfirmSheet, Sheet } from '../components/Sheet';

interface EditorState {
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
}

export function CategoriesPage() {
  const { state, addCategory, updateCategory, deleteCategory } = useLedger();
  const toast = useToast();
  const [type, setType] = useState<CategoryType>('expense');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of state.transactions) {
      if (transaction.categoryId) counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [state.transactions]);

  const categories = useMemo(
    () => state.categories
      .filter((category) => category.type === type)
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)),
    [state.categories, type, usage],
  );

  const openNew = () => {
    setEditor({
      name: '',
      icon: type === 'income' ? 'briefcase' : 'utensils',
      color: CATEGORY_COLORS[0],
      type,
    });
  };

  const openEdit = (category: Category) => {
    setEditor({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      type: category.type,
    });
  };

  const save = () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      toast('给分类起个名字吧', 'error');
      return;
    }
    try {
      if (editor.id) {
        updateCategory(editor.id, {
          name: editor.name,
          icon: editor.icon,
          color: editor.color,
        });
        toast('分类已更新', 'success');
      } else {
        addCategory({
          name: editor.name,
          type: editor.type,
          icon: editor.icon,
          color: editor.color,
        });
        toast('分类已添加', 'success');
      }
      setEditor(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : '保存失败', 'error');
    }
  };

  return (
    <main className="page manager-page">
      <TopBar
        title="分类管理"
        subtitle={`${state.categories.length} 个分类`}
        right={<button type="button" className="icon-button accent" onClick={openNew} aria-label="新增分类"><Icon name="plus" size={21} /></button>}
      />
      <Segmented
        value={type}
        onChange={(next) => {
          setType(next);
        }}
        ariaLabel="分类类型"
        options={[
          { value: 'expense', label: '支出分类' },
          { value: 'income', label: '收入分类' },
        ]}
      />
      <p className="manager-intro">按使用次数排序。导入账单时自动创建的分类，也可以在这里整理。</p>

      {categories.length ? (
        <div className="manager-list card-list">
          {categories.map((category) => {
            const count = usage.get(category.id) ?? 0;
            return (
              <div className="manager-row" key={category.id}>
                <CategoryAvatar category={category} size={42} />
                <div className="manager-row-main">
                  <div>
                    <strong>{category.name}</strong>
                    {category.custom ? <span className="mini-tag">自定义</span> : <span className="mini-tag builtin">内置</span>}
                  </div>
                  <small>{count} 笔账单</small>
                </div>
                <div className="manager-actions">
                  {category.custom ? (
                    <>
                      <button type="button" className="round-action" aria-label={`编辑${category.name}`} onClick={() => openEdit(category)}>
                        <Icon name="pencil" size={15} />
                      </button>
                      {count === 0 ? (
                        <button type="button" className="round-action danger" aria-label={`删除${category.name}`} onClick={() => setDeleteTarget(category)}>
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
        <EmptyState
          title="还没有分类"
          description="添加一个分类，记账时就能更快找到它。"
          icon="tags"
          action={<button type="button" className="button primary" onClick={openNew}><Icon name="plus" size={17} /> 新增分类</button>}
        />
      )}

      <p className="manager-note"><Icon name="circle-help" size={14} /> 内置分类不可修改；自定义分类下有账单时不能删除。</p>

      <Sheet
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor?.id ? '编辑分类' : '新增分类'}
        subtitle={editor?.type === 'income' ? '收入分类' : '支出分类'}
        footer={<button type="button" className="button primary full" onClick={save}>{editor?.id ? '保存修改' : '添加分类'}</button>}
      >
        {editor ? (
          <div className="category-editor">
            <div className="editor-preview">
              <span
                className="avatar"
                style={{ width: 64, height: 64, color: editor.color, backgroundColor: `${editor.color}18` }}
              >
                <Icon name={editor.icon} size={29} />
              </span>
              <strong>{editor.name || '分类预览'}</strong>
              <small>{editor.type === 'income' ? '收入' : '支出'}</small>
            </div>
            <label className="field">
              <span>名称</span>
              <input
                value={editor.name}
                onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                placeholder="例如：咖啡、旅行、宠物"
                maxLength={8}
                autoFocus
              />
            </label>
            <div className="editor-group">
              <span className="editor-label">颜色</span>
              <div className="color-palette">
                {CATEGORY_COLORS.map((color) => (
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
                {CATEGORY_ICON_CHOICES.map((choice) => (
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
        description="这个分类还没有被任何账单使用，删除后不可恢复。"
        confirmLabel="删除分类"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          try {
            deleteCategory(deleteTarget.id);
            toast('分类已删除');
          } catch (error) {
            toast(error instanceof Error ? error.message : '删除失败', 'error');
          }
        }}
      />
    </main>
  );
}
