import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryWindow, money } from '../../lib/api';
import { createOrder, getQuote } from '../../lib/apiClient';
import type { OrderResult, PaymentMethod, Quote, Settings } from '../../lib/types';
import { cartSubtotal, useCart } from '../../store/cart';
import { EmptyState, ErrorNote, Field, Spinner } from '../../components/ui';
import { CheckIcon, TruckIcon, WhatsAppIcon } from '../../components/ui/Icons';

export default function Checkout() {
  const settings = useOutletContext<Settings | null>();
  const { lines, clear } = useCart();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [placed, setPlaced] = useState<OrderResult | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  const subtotal = cartSubtotal(lines);

  useEffect(() => {
    if (lines.length === 0) return;
    getQuote(payload())
      .then(setQuote)
      .catch((e) => setError((e as Error).message));
  }, [lines]);

  const minOrder = quote?.minOrderValue ?? settings?.minOrderValue ?? 0;
  const belowMin = quote ? quote.subtotal < minOrder : false;

  if (placed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="card p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckIcon className="h-8 w-8" />
          </span>
          <h1 className="mt-5 text-2xl font-bold">Order confirmed</h1>
          <p className="mt-2 text-ink-500">
            Thanks {name.split(' ')[0]}! We have your order and will call you to confirm.
          </p>

          <div className="mt-6 rounded-2xl bg-ink-50 p-5">
            <p className="text-xs uppercase tracking-wide text-ink-500">Order number</p>
            <p className="mt-1 font-display text-3xl font-bold">{placed.order.orderNo}</p>
            <p className="mt-2 text-sm text-ink-600">Total {money(placed.order.total)}</p>
          </div>

          <p className="mt-4 text-sm text-ink-500">
            Keep your order number — you need it plus your phone number to track delivery.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to={`/track?order=${placed.order.orderNo}`} className="btn-primary btn-md">
              Track my order
            </Link>
            {placed.whatsapp.link && !placed.whatsapp.sent && (
              <a href={placed.whatsapp.link} target="_blank" rel="noreferrer" className="btn-outline btn-md">
                <WhatsAppIcon className="h-4 w-4 text-emerald-600" /> Send on WhatsApp
              </a>
            )}
          </div>

          <button
            onClick={() => {
              clear();
              navigate('/menu');
            }}
            className="mt-6 text-sm font-medium text-ink-500 hover:text-brand-600"
          >
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-20">
        <EmptyState
          title="Your cart is empty"
          hint="Add something from the menu to check out."
          action={
            <Link to="/menu" className="btn-primary btn-md">
              Browse the menu
            </Link>
          }
        />
      </div>
    );
  }

  const placeOrder = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Please enter your full name.');
    if (!/^03\d{9}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter a valid 11-digit mobile number, e.g. 03001234567.');
    if (address.trim().length < 8) return setError('Please enter your full delivery address.');

    setSending(true);
    try {
      const result = await createOrder({
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          area: area.trim(),
          notes: notes.trim(),
        },
        items: payload(),
        paymentMethod: method,
      });
      setPlaced(result);
      clear();
      toast.success('Order placed');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  // the server already filters disabled methods out of the public settings
  const methods = settings?.paymentMethods?.length
    ? settings.paymentMethods
    : [{ code: 'cod' as PaymentMethod, label: 'Cash on delivery' }];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-ink-500">Tell us where to deliver and how you want to pay.</p>

      {error && <div className="mt-6"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg font-semibold">Delivery details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Khan" autoComplete="name" />
              </Field>
              <Field label="Mobile number" hint="We call this number to confirm your order.">
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03001234567"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Delivery address">
                <textarea
                  className="input min-h-24 resize-y"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House / flat number, street, area, Lodhran"
                  autoComplete="street-address"
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Area" hint="Optional — helps us plan the route.">
                <input className="input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Bashorewala" />
              </Field>
              <Field label="Order notes" hint="Optional — gate code, extra chilli.">
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-semibold">Payment method</h2>
            <p className="mt-1 text-sm text-ink-500">Pay the rider when your order arrives.</p>

            <div className="mt-4 space-y-2.5">
              {methods.map((m) => (
                <label
                  key={m.code}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                    method === m.code ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-ink-200 hover:border-ink-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m.code}
                    checked={method === m.code}
                    onChange={() => setMethod(m.code)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{m.label}</span>
                    {m.accountNumber && m.code !== 'cod' && (
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {m.accountTitle}: {m.accountNumber} — send the receipt to this number
                      </span>
                    )}
                    {m.code === 'cod' && <span className="mt-0.5 block text-xs text-ink-500">Have the exact amount ready if you can.</span>}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>

            <ul className="mt-4 space-y-3">
              {lines.map((l) => (
                <li key={l.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {l.qty}× {l.name}
                    </span>
                    {l.variantName && <span className="text-xs text-ink-500">{l.variantName}</span>}
                  </span>
                  <span className="shrink-0 font-semibold">{money(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-2 border-t border-ink-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Subtotal</span>
                <span className="font-medium">{money(quote?.subtotal ?? subtotal)}</span>
              </div>
              {!!quote?.discount && (
                <div className="flex justify-between text-emerald-700">
                  <span>Deal discount</span>
                  <span className="font-medium">- {money(quote.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-500">Delivery</span>
                <span className="font-medium">
                  {!quote ? '…' : quote.deliveryFee === 0 ? 'Free' : money(quote.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-2.5 text-base">
                <span className="font-semibold">Total</span>
                <span className="font-display text-xl font-bold">{money(quote?.total ?? subtotal)}</span>
              </div>
            </div>

            {belowMin && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Minimum order is {money(minOrder)}. Add {money(minOrder - quote!.subtotal)} more to
                continue.
              </p>
            )}

            <button
              className="btn-primary btn-lg mt-5 w-full"
              onClick={placeOrder}
              disabled={sending || belowMin || !quote}
            >
              {sending ? <Spinner className="h-5 w-5" /> : `Place order · ${money(quote?.total ?? subtotal)}`}
            </button>

            <p className="mt-3 flex items-start gap-2 text-xs text-ink-500">
              <TruckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              {deliveryWindow(settings?.estimatedDeliveryMinutes)} delivery across{' '}
              {settings?.city || 'Lodhran'}
            </p>

            {settings?.whatsappNumber && (
              <div className="mt-4 border-t border-ink-200 pt-4">
                <p className="text-xs text-ink-500">Prefer WhatsApp? Message us instead:</p>
                <a
                  href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline btn-md mt-2 w-full"
                >
                  <WhatsAppIcon className="h-4 w-4 text-emerald-600" /> Order on WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function payload() {
  const { lines } = useCart.getState();
  return lines.map((l) => ({ ref: l.ref, kind: l.kind, qty: l.qty, variantName: l.variantName }));
}
