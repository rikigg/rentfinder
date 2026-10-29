import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onUpgrade: () => void;
};

function safeClose(onClose: () => void, e?: { preventDefault?: () => void; stopPropagation?: () => void }) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  window.setTimeout(() => onClose(), 0);
}

export function ProLockSheet({
  open,
  title = "Доступно в Pro",
  onClose,
  onUpgrade,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("pro-lock-open");
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.classList.remove("pro-lock-open");
      root.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="pro-lock-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="pro-lock-backdrop"
        aria-label="Закрыть"
        onPointerDown={(e) => safeClose(onClose, e)}
        onClick={(e) => safeClose(onClose, e)}
      />
      <div className="pro-lock-card">
        <div className="pro-lock-badge">Pro</div>
        <h2>{title}</h2>
        <p className="muted">
          У вас Trial-подписка. Оповещения, ремонт по фото и зона на карте доступны в Pro.
        </p>
        <button
          type="button"
          className="btn primary block"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.setTimeout(() => onUpgrade(), 0);
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.setTimeout(() => onUpgrade(), 0);
          }}
        >
          Перейти на Pro
        </button>
        <button
          type="button"
          className="btn block"
          onPointerDown={(e) => safeClose(onClose, e)}
          onClick={(e) => safeClose(onClose, e)}
        >
          Позже
        </button>
      </div>
    </div>,
    document.body,
  );
}
