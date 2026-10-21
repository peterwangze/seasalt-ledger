import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [sheetMaxHeight, setSheetMaxHeight] = useState<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('sheet-open');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Keep form sheets above the iOS / Android software keyboard.
    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (!viewport) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      if (inset > 80) {
        setKeyboardInset(inset);
        setSheetMaxHeight(Math.max(300, Math.min(window.innerHeight * 0.88, viewport.height * 0.9)));
      } else {
        setKeyboardInset(0);
        setSheetMaxHeight(null);
      }
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);

    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('sheet-open');
      window.removeEventListener('keydown', handleKeyDown);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      setKeyboardInset(0);
      setSheetMaxHeight(null);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const layerStyle = {
    paddingBottom: keyboardInset > 0 ? `${keyboardInset}px` : undefined,
    '--sheet-max-height': sheetMaxHeight ? `${sheetMaxHeight}px` : undefined,
  } as CSSProperties;

  return createPortal(
    <div className="sheet-layer" style={layerStyle}>
      <button type="button" className="sheet-backdrop" aria-label="关闭" onClick={onClose} />
      <section className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title || '面板'}>
        <div className="sheet-grab" />
        {title ? (
          <header className="sheet-head">
            <div>
              <h2>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <button type="button" className="icon-button subtle" onClick={onClose} aria-label="关闭">
              <Icon name="x" size={19} />
            </button>
          </header>
        ) : null}
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel = '确认',
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={description}>
      <div className="confirm-actions">
        <button type="button" className="button ghost" onClick={onClose}>取消</button>
        <button
          type="button"
          className={`button ${tone === 'danger' ? 'danger' : 'primary'}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
