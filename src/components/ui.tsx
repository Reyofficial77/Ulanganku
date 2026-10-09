import { useEffect, useRef, type ReactNode } from "react";
import type { ExamStatus } from "../lib/api";
import { statusLabel } from "../lib/format";
import { Icon } from "./Icon";

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  icon = "link",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  icon?: "link" | "alert" | "trash" | "check";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-icon"><Icon name={icon} size={18} /></div>
            <div>
              <h2>{title}</h2>
              {description && <p>{description}</p>}
            </div>
          </div>
          <button className="icon-button" aria-label="Tutup" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: ExamStatus }) {
  return <em className={`badge badge-${status}`}>{statusLabel[status]}</em>;
}

export function Spinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon empty-icon-danger"><Icon name="alert" size={22} /></div>
      <h3>Terjadi masalah</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-outline" onClick={onRetry}>
          <Icon name="refresh" size={15} /> Coba lagi
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = "file",
  title,
  text,
  action,
}: {
  icon?: "file" | "users" | "chart" | "search";
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Avatar({ name, picture, size = 36 }: { name: string; picture?: string | null; size?: number }) {
  const label =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  return picture ? (
    <img className="avatar-img" src={picture} alt="" width={size} height={size} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {label}
    </span>
  );
}
