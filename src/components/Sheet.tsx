import { useEffect, useId, useRef, type ReactNode } from 'react';

// A bottom sheet on phone and tablet, a centered modal on desktop (DESIGN.md → Bottom sheets).
// Escape and the backdrop close it.

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Visually hide the title (it's still announced). */
  hideTitle?: boolean;
  className?: string;
}

export function Sheet({ title, onClose, children, hideTitle, className }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prev?.isConnected) prev.focus();
    };
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={`sheet ${className ?? ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2 id={titleId} className={hideTitle ? 'visually-hidden' : 'sheet-title'}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({ title, body, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Sheet title={title} onClose={onCancel} className="sheet-confirm">
      {body && <p className="muted">{body}</p>}
      <div className="sheet-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} data-autofocus>
          {cancelLabel}
        </button>
        <button type="button" className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
