import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { money } from '../../lib/api';
import { trackOrder } from '../../lib/apiClient';
import { PAYMENT_LABEL, STATUS_LABEL, STATUS_STEPS, formatDate, statusProgress } from '../../lib/format';
import type { TrackResult } from '../../lib/types';
import { ErrorNote, Field, Spinner } from '../../components/ui';
import { CheckIcon, PhoneIcon, SearchIcon, TruckIcon } from '../../components/ui/Icons';

export default function Track() {
  const [params] = useSearchParams();
  const [orderNo, setOrderNo] = useState(params.get('order') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(
    async (no: string, tel: string) => {
      if (!no.trim() || !tel.trim()) return;
      setLoading(true);
      try {
        setResult(await trackOrder(no, tel));
        setError('');
      } catch (err) {
        setResult(null);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookup(orderNo, phone);
  };

  // arriving straight from the confirmation screen — look it up without waiting for a click
  useEffect(() => {
    if (params.get('order') && params.get('phone')) lookup(params.get('order')!, params.get('phone')!);
  }, [params, lookup]);

  // keep the tracker live so the status bar moves on its own
  useEffect(() => {
    if (!result) return;
    const t = setInterval(() => {
      trackOrder(orderNo, phone)
        .then(setResult)
        .catch(() => undefined);
    }, 30000);
    return () => clearInterval(t);
  }, [result, orderNo, phone]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-600">
          <TruckIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Track your order</h1>
        <p className="mt-2 text-ink-500">
          Enter the order number from your confirmation and the phone number you ordered with.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card mt-8 p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Order number">
            <input
              className="input"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="TB-000123"
              required
            />
          </Field>
          <Field label="Phone number">
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03001234567"
              inputMode="numeric"
              required
            />
          </Field>
          <button className="btn-primary btn-md h-11" disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
            <span className="sm:hidden">Track</span>
          </button>
        </div>
        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </form>

      {result && (
        <div className="card mt-6 animate-rise overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 bg-ink-50 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Order</p>
              <p className="font-display text-lg font-bold">{result.orderNo}</p>
              <p className="mt-0.5 text-xs text-ink-500">Placed {formatDate(result.placedAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-ink-500">Status</p>
              <p className="font-semibold text-brand-700">{STATUS_LABEL[result.status]}</p>
            </div>
          </div>

          <div className="px-6 py-6">
            {result.status === 'cancelled' ? (
              <p className="rounded-xl bg-ink-100 px-4 py-3 text-sm font-medium text-ink-600">
                This order was cancelled. If that looks wrong, call us and we will sort it out.
              </p>
            ) : (
              <Tracker status={result.status} />
            )}

            <ul className="mt-6 space-y-2.5 border-t border-ink-200 pt-5 text-sm">
              {result.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span className="text-ink-600">
                    {i.qty}× {i.name}
                    {i.variantName && <span className="text-ink-400"> ({i.variantName})</span>}
                  </span>
                  <span className="font-medium">{money(i.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-ink-200 pt-4 text-base">
              <span className="font-semibold">Total</span>
              <span className="font-display text-xl font-bold">{money(result.total)}</span>
            </div>

            <p className="mt-2 text-xs text-ink-500">
              Paying with {PAYMENT_LABEL[result.paymentMethod] || result.paymentMethod} ·{' '}
              {result.paymentStatus === 'received' ? 'payment received' : 'payment pending'}
            </p>

            {result.phone && (
              <div className="mt-5 rounded-xl bg-ink-50 p-4 text-sm">
                <p className="font-semibold">Something wrong?</p>
                <p className="mt-1 text-ink-600">Call {result.shopName} and quote {result.orderNo}.</p>
                <a
                  className="btn-outline btn-sm mt-3"
                  href={`tel:${result.phone}`}
                  aria-label={`Call ${result.shopName}`}
                >
                  <PhoneIcon className="h-4 w-4" /> {result.phone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Tracker({ status }: { status: TrackResult['status'] }) {
  const progress = statusProgress(status);
  const activeIndex = STATUS_STEPS.indexOf(status);

  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-4 h-1 rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-700"
          style={{ width: `${Math.max(progress * 100, 4)}%` }}
        />
      </div>

      <ol className="relative flex justify-between">
        {STATUS_STEPS.map((s, i) => {
          const done = i <= activeIndex;
          return (
            <li key={s} className="flex w-20 flex-col items-center gap-2 text-center">
              <span
                className={`z-10 grid h-8 w-8 place-items-center rounded-full border-2 transition ${
                  done ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-300'
                }`}
              >
                {i < activeIndex ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </span>
              <span
                className={`text-[11px] font-medium leading-tight ${done ? 'text-ink-800' : 'text-ink-400'}`}
              >
                {STATUS_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
