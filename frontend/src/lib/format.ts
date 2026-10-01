import type { OrderStatus, PaymentStatus } from './types';

export const STATUS_STEPS: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  new: 'bg-brand-100 text-brand-800',
  confirmed: 'bg-sky-100 text-sky-800',
  preparing: 'bg-amber-100 text-amber-800',
  out_for_delivery: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-ink-200 text-ink-600',
};

export const PAYMENT_LABEL: Record<string, string> = {
  cod: 'Cash on delivery',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  bank: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};

export const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-800',
  refunded: 'bg-sky-100 text-sky-800',
};

export const SOURCE_LABEL: Record<string, string> = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  pos: 'Counter',
};

/** the next status the rider can move an order to, from ALLOWED_TRANSITIONS on the server */
export const NEXT_STATUS: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string }>
> = {
  new: { status: 'confirmed', label: 'Confirm' },
  confirmed: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'out_for_delivery', label: 'Out for delivery' },
  out_for_delivery: { status: 'delivered', label: 'Mark delivered' },
};

/** how far along an order is, 0..1, so the tracker bar can be drawn */
export const statusProgress = (status: OrderStatus) => {
  if (status === 'cancelled') return 0;
  const i = STATUS_STEPS.indexOf(status);
  return i < 0 ? 0 : i / (STATUS_STEPS.length - 1);
};

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/** a date with no clock time, for entries that only care about the day */
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** a plain-language money trend, e.g. "+18% vs last period" */
export const trend = (change: number | null | undefined) =>
  change === null || change === undefined
    ? 'no prior period'
    : `${change >= 0 ? '+' : ''}${Math.round(change)}% vs last period`;
