import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { money } from '../../lib/api';
import { getQuote } from '../../lib/apiClient';
import { fallbackForName } from '../../lib/productImage';
import type { CartLine, Quote, Settings } from '../../lib/types';
import { cartSubtotal, useCart } from '../../store/cart';
import { CloseIcon, MinusIcon, PlusIcon, TrashIcon } from '../ui/Icons';

/** the photo saved on the line, or a matching placeholder by product name */
const lineImage = (line: CartLine) => line.image || fallbackForName(line.name);

export function CartDrawer({ settings }: { settings: Settings | null }) {
  const { lines, open, setOpen, setQty, remove, clear } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const navigate = useNavigate();

  const subtotal = cartSubtotal(lines);

  // the server is the source of truth for delivery fees and minimum spend
  useEffect(() => {
    if (!open || lines.length === 0) {
      setQuote(null);
      return;
    }
    const t = setTimeout(() => {
      getQuote(cartPayload())
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 150);
    return () => clearTimeout(t);
  }, [open, lines]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const total = quote?.total ?? subtotal;
  const minOrder = quote?.minOrderValue ?? settings?.minOrderValue ?? 0;
  const belowMin = quote ? quote.subtotal < minOrder : false;

  const goCheckout = () => {
    if (belowMin) {
      toast.error(`Minimum order is ${money(minOrder)}`);
      return;
    }
    setOpen(false);
    navigate('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-lift animate-rise">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Your cart</h2>
            <p className="text-xs text-ink-500">{lines.length} item(s)</p>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close cart">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-ink-500">Your cart is empty.</p>
            <button className="btn-primary btn-md" onClick={() => { setOpen(false); navigate('/menu'); }}>
              Browse the menu
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {lines.map((l) => (
                <div key={l.key} className="flex gap-3 rounded-xl border border-ink-200 p-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-100">
                    {lineImage(l) ? (
                      <img src={lineImage(l)} alt={l.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="font-display text-sm font-bold text-ink-400">{l.name.slice(0, 2)}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.name}</p>
                    {l.variantName && <p className="text-xs text-ink-500">{l.variantName}</p>}
                    <p className="mt-1 text-sm font-bold text-brand-600">{money(l.unitPrice)}</p>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-ink-200">
                        <button
                          className="grid h-11 w-11 place-items-center text-ink-600 transition hover:text-brand-600 active:text-brand-700 sm:h-9 sm:w-9"
                          onClick={() => setQty(l.key, l.qty - 1)}
                          aria-label="Decrease quantity"
                        >
                          <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-7 text-center text-sm font-semibold">{l.qty}</span>
                        <button
                          className="grid h-11 w-11 place-items-center text-ink-600 transition hover:text-brand-600 active:text-brand-700 sm:h-9 sm:w-9"
                          onClick={() => setQty(l.key, l.qty + 1)}
                          aria-label="Increase quantity"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        className="ml-auto grid h-11 w-11 place-items-center text-ink-400 transition hover:text-berry-600 active:text-berry-700 sm:h-9 sm:w-9"
                        onClick={() => remove(l.key)}
                        aria-label={`Remove ${l.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-bold">{money(l.unitPrice * l.qty)}</p>
                </div>
              ))}

              <button className="text-xs font-semibold text-ink-500 underline-offset-2 hover:text-berry-600 hover:underline" onClick={clear}>
                Clear cart
              </button>
            </div>

            <div
              className="space-y-2.5 border-t border-ink-200 px-5 pt-4"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
            >
              <Row label="Subtotal" value={money(quote?.subtotal ?? subtotal)} />
              {!!quote?.discount && (
                <Row label="Deal discount" value={`- ${money(quote.discount)}`} />
              )}
              <Row
                label="Delivery"
                value={quote ? (quote.deliveryFee === 0 ? 'Free' : money(quote.deliveryFee)) : '…'}
              />
              <div className="flex items-center justify-between border-t border-ink-200 pt-2.5">
                <span className="font-semibold">Total</span>
                <span className="font-display text-xl font-bold">{money(total)}</span>
              </div>

              {belowMin && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Add {money(minOrder - quote!.subtotal)} more to reach the minimum order of{' '}
                  {money(minOrder)}.
                </p>
              )}

              <button className="btn-primary btn-lg w-full" onClick={goCheckout}>
                {quote ? `Checkout · ${money(total)}` : 'Checkout'}
              </button>
              <p className="text-center text-[11px] text-ink-400">
                Pay cash on delivery, JazzCash or Easypaisa
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function cartPayload() {
  const { lines } = useCart.getState();
  return lines.map((l) => ({
    ref: l.ref,
    kind: l.kind,
    qty: l.qty,
    variantName: l.variantName,
  }));
}
