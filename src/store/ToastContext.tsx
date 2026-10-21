import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';

type ToastTone = 'default' | 'success' | 'error';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'default') => {
    counter.current += 1;
    const id = counter.current;
    setToast({ id, message, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, tone === 'error' ? 3600 : 2400);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && typeof document !== 'undefined'
        ? createPortal(
            <div className={`toast toast-${toast.tone}`} role="status" key={toast.id}>
              <span className="toast-icon">
                <Icon name={toast.tone === 'error' ? 'circle-help' : 'check'} size={15} strokeWidth={2.4} />
              </span>
              <span>{toast.message}</span>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
