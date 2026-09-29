import type { ReactNode } from 'react';
import { STATUS_STYLE, STATUS_LABEL } from '../../lib/format';
import type { OrderStatus, PaymentStatus } from '../../lib/types';
import { PAYMENT_STYLE } from '../../lib/format';

/** a plain button that still picks up the .btn-* class names from the caller */
export function Buttonless({
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={className} {...rest} />;
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-500">
      <Spinner className="h-5 w-5 text-brand-600" />
      {label}
    </div>
  );
}

export function Skeleton({ className = 'h-64' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      {icon && <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-ink-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-berry-500/30 bg-berry-500/10 px-4 py-3 text-sm font-medium text-berry-600">
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'muted' | 'berry' | 'success' | 'warn' | 'info';
}) {
  const tones = {
    brand: 'bg-brand-100 text-brand-800',
    muted: 'bg-ink-100 text-ink-600',
    berry: 'bg-berry-500 text-white',
    success: 'bg-emerald-100 text-emerald-800',
    warn: 'bg-amber-100 text-amber-800',
    info: 'bg-sky-100 text-sky-800',
  };
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`chip ${PAYMENT_STYLE[status]}`}>{status}</span>;
}

export function Rating({ value = 0, count, size = 'sm' }: { value?: number; count?: number; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex" aria-label={`${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <StarInline key={n} className={`${px} ${n <= Math.round(value) ? 'text-brand-500' : 'text-ink-300'}`} />
        ))}
      </span>
      {count !== undefined && <span className="text-xs text-ink-500">({count})</span>}
    </span>
  );
}

const StarInline = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z" />
  </svg>
);

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'brand' | 'positive' | 'negative';
}) {
  const tones = {
    default: 'text-ink-900',
    brand: 'text-brand-600',
    positive: 'text-emerald-600',
    negative: 'text-berry-600',
  };
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-berry-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 backdrop-blur-sm sm:p-8">
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-auto animate-rise`}>
        <div className="flex items-center justify-between border-b border-ink-200 px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
