import { Link, useOutletContext } from 'react-router-dom';
import { deliveryWindow, money } from '../../lib/api';
import type { Settings } from '../../lib/types';
import { ClockIcon, PhoneIcon, PinIcon, TruckIcon, WhatsAppIcon } from '../../components/ui/Icons';

export default function About() {
  const s = useOutletContext<Settings | null>();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">About {s?.shopName || 'Tasty Bites'}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-600">
        {s?.about || s?.tagline || 'We cook fresh, fast food and deliver it across Lodhran.'}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Detail icon={<PinIcon className="h-5 w-5" />} label="Address" value={s?.address} />
        <Detail icon={<PhoneIcon className="h-5 w-5" />} label="Phone" value={s?.phone} />
        <Detail
          icon={<ClockIcon className="h-5 w-5" />}
          label="Delivery time"
          value={deliveryWindow(s?.estimatedDeliveryMinutes)}
        />
        <Detail
          icon={<TruckIcon className="h-5 w-5" />}
          label="Free delivery over"
          value={money(s?.freeDeliveryAbove)}
        />
      </div>

      {s && !s.acceptingOrders && s.closedNotice && (
        <p className="mt-8 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {s.closedNotice}
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-bold">How to order</h2>
        <div className="mt-4 space-y-4 text-ink-600">
          <p>
            <strong className="text-ink-900">On the website:</strong> add items to your cart, check out with your
            address, and choose how you want to pay. You will get an order number straight away.
          </p>
          <p>
            <strong className="text-ink-900">On WhatsApp:</strong> build your cart here, then tap send. We open a chat
            with your order written out and saved to our dashboard at the same time.
          </p>
          <p>
            Either way the same kitchen gets the order, and you can track progress with your order number and phone
            number.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">How to pay</h2>
        <p className="mt-3 text-ink-600">
          Pay the rider in cash, or transfer to our {s?.shopName || 'Tasty Bites'} account before delivery. Transfer
          details appear at checkout for each method you pick.
        </p>
      </section>

      {s?.whatsappNumber && (
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${s.whatsappNumber.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="btn-primary btn-md"
          >
            <WhatsAppIcon className="h-4 w-4" /> Chat with us
          </a>
          <Link to="/menu" className="btn-outline btn-md">
            See the menu
          </Link>
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="card flex items-start gap-3 p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <span>
        <span className="block text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</span>
        <span className="mt-0.5 block text-sm text-ink-800">{value}</span>
      </span>
    </div>
  );
}
