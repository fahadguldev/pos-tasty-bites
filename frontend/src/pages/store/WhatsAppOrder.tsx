import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { money } from '../../lib/api';
import { createWhatsappOrder, getProducts, getQuote } from '../../lib/apiClient';
import { productImage } from '../../lib/productImage';
import type { PaymentMethod, Product, Quote, Settings } from '../../lib/types';
import { useCart } from '../../store/cart';
import { EmptyState, ErrorNote, Field, Spinner } from '../../components/ui';
import { WhatsAppIcon } from '../../components/ui/Icons';

/**
 * Lets a customer send their order through WhatsApp. We still write the order to
 * the database first, so the kitchen sees it in the dashboard and the admin can
 * reply to the same order number.
 */
export default function WhatsAppOrder() {
  const settings = useOutletContext<Settings | null>();
  const { lines, clear } = useCart();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (lines.length === 0) return;
    getQuote(payload())
      .then(setQuote)
      .catch(() => undefined);
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-20">
        <EmptyState
          title="Your cart is empty"
          hint="Add items to your cart, then send the whole order over WhatsApp."
          action={
            <button onClick={() => navigate('/menu')} className="btn-primary btn-md">
              Browse the menu
            </button>
          }
        />
      </div>
    );
  }

  const send = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Please enter your name.');
    if (!/^03\d{9}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter a valid 11-digit mobile number.');
    if (address.trim().length < 8) return setError('Please enter your delivery address.');

    setSending(true);
    try {
      const result = await createWhatsappOrder({
        customer: { name: name.trim(), phone: phone.trim(), address: address.trim() },
        items: payload(),
        paymentMethod: method,
      });

      if (result.whatsapp.link) window.open(result.whatsapp.link, '_blank', 'noopener');

      clear();
      toast.success(`Order ${result.order.orderNo} saved`);
      navigate(`/track?order=${result.order.orderNo}&phone=${encodeURIComponent(phone.trim())}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <header className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
          <WhatsAppIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Send your order on WhatsApp</h1>
        <p className="mx-auto mt-2 max-w-xl text-ink-500">
          Fill in your details, tap send, and WhatsApp opens with your order already written out. We save the order
          to our dashboard too, so nothing gets lost.
        </p>
      </header>

      {error && <div className="mt-6"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg font-semibold">Your details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Khan" />
              </Field>
              <Field label="Mobile number">
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" inputMode="numeric" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Delivery address">
                <textarea className="input min-h-24 resize-y" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / flat, street, area, Lodhran" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Pay on delivery with">
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {(settings?.paymentMethods || []).map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-semibold">Quick add</h2>
            <p className="mt-1 text-sm text-ink-500">Tap anything to add it to this order.</p>
            <div className="rail mt-4">
              {products
                .filter((p) => p.available)
                .slice(0, 14)
                .map((p) => (
                  <button
                    key={p._id}
                    onClick={() =>
                      useCart.getState().add({
                        ref: p._id,
                        kind: 'product',
                        name: p.name,
                        image: productImage(p),
                        unitPrice: p.effectivePrice,
                        qty: 1,
                      })
                    }
                    className="card w-40 p-3 text-left transition hover:border-brand-400 hover:shadow-lift"
                  >
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="mt-1 text-sm font-bold text-brand-600">{money(p.effectivePrice)}</p>
                  </button>
                ))}
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Your order</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-3">
                  <span className="text-ink-600">
                    {l.qty}× {l.name}
                    {l.variantName && <span className="text-ink-400"> ({l.variantName})</span>}
                  </span>
                  <span className="font-medium">{money(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1.5 border-t border-ink-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Subtotal</span>
                <span>{money(quote?.subtotal ?? subtotal)}</span>
              </div>
              {!!quote?.discount && (
                <div className="flex justify-between text-emerald-700">
                  <span>Deal discount</span>
                  <span>- {money(quote.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-500">Delivery</span>
                <span>{!quote ? '…' : quote.deliveryFee === 0 ? 'Free' : money(quote.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{money(quote?.total ?? subtotal)}</span>
              </div>
            </div>

            <button className="btn-primary btn-lg mt-5 w-full !bg-emerald-600 hover:!bg-emerald-700" onClick={send} disabled={sending}>
              {sending ? <Spinner className="h-5 w-5" /> : <WhatsAppIcon className="h-5 w-5" />}
              Send on WhatsApp
            </button>
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
