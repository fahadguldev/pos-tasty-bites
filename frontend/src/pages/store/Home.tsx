import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { deliveryWindow, money } from '../../lib/api';
import { getCategories, getDeals, getProducts } from '../../lib/apiClient';
import { categoryImage, landingImages } from '../../lib/landingImages';
import type { Category, Deal, Product, Settings } from '../../lib/types';
import { ProductCard } from '../../components/store/ProductCard';
import { DealCard } from '../../components/store/DealCard';
import { WhatsAppOrderCta } from '../../components/store/WhatsAppOrderCta';
import { Loading } from '../../components/ui';
import {
  BoxIcon,
  CheckIcon,
  ClockIcon,
  PhoneIcon,
  PinIcon,
  RupeeIcon,
  SparkIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
  WhatsAppIcon,
} from '../../components/ui/Icons';

export default function Home() {
  const settings = useOutletContext<Settings | null>();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // getProducts always requests withRating, so the cards show review averages
    Promise.all([getProducts({ featured: 'true' }), getDeals(), getCategories()])
      .then(([f, d, c]) => {
        setFeatured(f);
        setDeals(d);
        setCategories(c);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  // the headline deal powers the floating price chip on the hero image
  const heroDeal = useMemo(
    () => deals.slice().sort((a, b) => b.savings - a.savings)[0] || null,
    [deals],
  );

  const open = settings?.acceptingOrders !== false;

  return (
    <div>
      <PromiseBar settings={settings} />
      <Hero settings={settings} open={open} deal={heroDeal} />

      {deals.length > 0 && <DealsBand deals={deals} />}
      {categories.length > 0 && <Categories categories={categories} />}

      <Steps settings={settings} />
      <Featured products={featured} loading={loading} />

      <Quality settings={settings} />
      <FinalCta settings={settings} open={open} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * thin strip above the hero — states the delivery promise immediately
 * ------------------------------------------------------------------ */
function PromiseBar({ settings }: { settings: Settings | null }) {
  return (
    <div className="bg-ink-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-2.5 text-xs font-medium sm:text-[13px]">
        <span className="flex items-center gap-1.5">
          <TruckIcon className="h-3.5 w-3.5 text-wa-500" />
          Free delivery over {money(settings?.freeDeliveryAbove)}
        </span>
        <span className="hidden h-3 w-px bg-white/20 sm:block" />
        <span className="flex items-center gap-1.5">
          <ClockIcon className="h-3.5 w-3.5 text-wa-500" />
          {deliveryWindow(settings?.estimatedDeliveryMinutes)} across {settings?.city || 'Lodhran'}
        </span>
        <span className="hidden h-3 w-px bg-white/20 sm:block" />
        <span className="flex items-center gap-1.5">
          <RupeeIcon className="h-3.5 w-3.5 text-wa-500" />
          Pay cash, JazzCash or Easypaisa on delivery
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * hero — one job: get the visitor to start an order
 * ------------------------------------------------------------------ */
function Hero({ settings, open, deal }: { settings: Settings | null; open: boolean; deal: Deal | null }) {
  return (
    <section className="relative overflow-hidden bg-ink-900">
      {/* warm light from the top-left keeps the dark panel from feeling flat */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-700/25 via-ink-900 to-ink-900" />
      <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-wa-500/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {open ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wa-500/15 px-3 py-1 text-xs font-semibold text-wa-500 ring-1 ring-wa-500/30">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wa-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-wa-500" />
                </span>
                Open now
              </span>
            ) : (
              <span className="rounded-full bg-berry-500/15 px-3 py-1 text-xs font-semibold text-berry-500 ring-1 ring-berry-500/30">
                Currently closed
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-ink-200">
              <PinIcon className="h-3.5 w-3.5" />
              Home delivery in {settings?.city || 'Lodhran'}
            </span>
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            {open ? (
              <>
                Dinner that arrives
                <br />
                <span className="text-brand-400">hot, in {deliveryWindow(settings?.estimatedDeliveryMinutes).replace(' minutes', ' min')}.</span>
              </>
            ) : (
              <>
                We&apos;re closed
                <br />
                <span className="text-brand-400">but the kitchen opens soon.</span>
              </>
            )}
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-300 sm:text-lg">
            {open ? (
              <>
                Burgers, loaded fries, wings, pizza and thick shakes — cooked to order and at your door
                across {settings?.city || 'Lodhran'}. Order on WhatsApp in under a minute.
              </>
            ) : (
              settings?.closedNotice || 'We are not taking orders right now. Check back shortly.'
            )}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {open ? (
              <WhatsAppOrderCta />
            ) : (
              <a href={`tel:${settings?.phone || ''}`} className="btn-primary btn-lg w-full sm:w-auto">
                <PhoneIcon className="h-5 w-5" />
                Call {settings?.phone}
              </a>
            )}
            <Link to="/menu" className="btn-lg w-full border border-white/20 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
              See the full menu
            </Link>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-white/10 pt-6 sm:gap-4">
            <Fact
              label="Delivery"
              value={deliveryWindow(settings?.estimatedDeliveryMinutes).replace(' minutes', ' min')}
              icon={<TruckIcon className="h-4 w-4" />}
            />
            <Fact label="Free over" value={money(settings?.freeDeliveryAbove)} icon={<RupeeIcon className="h-4 w-4" />} />
            <Fact label="Min. order" value={money(settings?.minOrderValue)} icon={<BoxIcon className="h-4 w-4" />} />
          </dl>
        </div>

        {/* photo + the two floating chips that carry the offer */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-white/10">
            <img
              src={landingImages.hero}
              alt="A Tasty Bites burger and fries, freshly prepared"
              className="aspect-4/3 w-full object-cover sm:aspect-16/10 lg:aspect-4/5"
              fetchPriority="high"
              width={2000}
              height={1333}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
          </div>

          {deal && (
            <Link
              to="/deals"
              className="absolute -bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-lift transition hover:-translate-y-0.5 sm:left-6"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-berry-500 text-white">
                <TagIcon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {deal.badge || 'Bundle deal'}
                </span>
                <span className="block text-sm font-semibold leading-tight text-ink-900">{deal.name}</span>
                <span className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-display text-base font-bold text-berry-600">{money(deal.price)}</span>
                  <span className="text-xs text-ink-400 line-through">{money(deal.compareAtPrice)}</span>
                </span>
              </span>
            </Link>
          )}

          <div className="absolute -top-3 right-4 hidden items-center gap-2 rounded-full bg-ink-950/90 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur sm:flex">
            <StarIcon className="h-4 w-4 text-brand-400" filled />
            Made fresh to order
          </div>
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
        <span className="text-brand-400">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-display text-sm font-bold text-white sm:text-lg">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * deals — urgency, kept to one screen
 * ------------------------------------------------------------------ */
function DealsBand({ deals }: { deals: Deal[] }) {
  return (
    <section className="border-b border-ink-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-berry-600">Limited time</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Bundles that pay for themselves</h2>
          </div>
          <Link to="/deals" className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700">
            All deals →
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {deals.slice(0, 3).map((d, i) => (
            <DealCard key={d._id} deal={d} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * categories — photography doubles as navigation
 * ------------------------------------------------------------------ */
const TINTS = [
  'from-brand-300 to-brand-600',
  'from-amber-300 to-orange-600',
  'from-rose-300 to-berry-600',
  'from-emerald-300 to-teal-600',
  'from-violet-300 to-purple-600',
  'from-sky-300 to-blue-600',
];

function Categories({ categories }: { categories: Category[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
      <SectionHead eyebrow="Browse" title="What are you craving?" sub="Every category, one tap away." />

      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {categories.slice(0, 8).map((c, i) => {
          const photo = categoryImage(c.name);
          return (
            <Link
              key={c._id}
              to={`/menu?category=${c.slug}`}
              className="group relative aspect-4/5 overflow-hidden rounded-2xl shadow-soft ring-1 ring-ink-900/5 sm:aspect-4/3"
            >
              {photo ? (
                <img
                  src={photo}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${TINTS[i % TINTS.length]}`} />
              )}

              {/* scrim keeps the label readable over any photo */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/10 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <p className="font-display text-sm font-bold leading-tight text-white sm:text-base">{c.name}</p>
                {c.description && (
                  <p className="mt-0.5 hidden text-xs text-ink-200 sm:block">{c.description}</p>
                )}
              </div>

              <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink-900 opacity-0 transition group-hover:opacity-100">
                →
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * how ordering works — framed as how little it costs the customer
 * ------------------------------------------------------------------ */
function Steps({ settings }: { settings: Settings | null }) {
  const steps = [
    { n: '1', title: 'Pick your food', text: 'Browse the menu, choose your size, add to cart.' },
    { n: '2', title: 'Tap order on WhatsApp', text: 'Send it in one tap. We write it down before WhatsApp even opens.' },
    { n: '3', title: 'We cook, we deliver', text: `${deliveryWindow(settings?.estimatedDeliveryMinutes)} to your door in ${settings?.city || 'Lodhran'}.` },
  ];

  return (
    <section className="bg-ink-50 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHead eyebrow="How it works" title="Three taps and dinner is handled" align="center" />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`card relative p-6 ${i === 1 ? 'ring-2 ring-wa-500/40' : ''}`}
            >
              {i === 1 && (
                <span className="absolute -top-3 left-6 rounded-full bg-wa-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Fastest
                </span>
              )}
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl font-display text-sm font-bold text-white ${
                  i === 1 ? 'bg-wa-600' : 'bg-brand-600'
                }`}
              >
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * real menu — this is the taste section, so it uses the actual data
 * ------------------------------------------------------------------ */
function Featured({ products, loading }: { products: Product[]; loading: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Most ordered</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">The ones people keep coming back for</h2>
        </div>
        <Link to="/menu" className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700">
          Full menu →
        </Link>
      </div>

      {loading ? (
        <Loading />
      ) : products.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">Our menu is being updated — check back shortly.</p>
      ) : (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.slice(0, 6).map((p, i) => (
            <ProductCard key={p._id} product={p} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * quality signals — the "professional" half of the brief
 * ------------------------------------------------------------------ */
function Quality({ settings }: { settings: Settings | null }) {
  const points = [
    { icon: <SparkIcon className="h-5 w-5" />, title: 'Cooked to order', text: 'Nothing sits under a heat lamp. Your food hits the grill when you order.' },
    { icon: <BoxIcon className="h-5 w-5" />, title: 'Sealed packaging', text: 'Packed hot and sealed so it travels the distance without going soggy.' },
    { icon: <CheckIcon className="h-5 w-5" />, title: 'Priced honestly', text: 'The price on the menu is the price on the bill. No surprises at the door.' },
    { icon: <PhoneIcon className="h-5 w-5" />, title: 'A real person replies', text: 'Message us and the kitchen answers — not a chatbot, not a ticket number.' },
  ];

  return (
    <section className="border-y border-ink-200 bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Why order from us</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">A small kitchen that takes it seriously</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-500">
              We are a home delivery kitchen in {settings?.city || 'Lodhran'} — no dining room, no waiting staff.
              Everything we make has to survive the drive to your door, so that is the only thing we optimise for.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(settings?.paymentMethods || []).slice(0, 4).map((m) => (
                <span key={m.code} className="badge">
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {points.map((p) => (
              <div key={p.title} className="card p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  {p.icon}
                </span>
                <h3 className="mt-3.5 text-sm font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * final push
 * ------------------------------------------------------------------ */
function FinalCta({ settings, open }: { settings: Settings | null; open: boolean }) {
  const social = Object.entries(settings?.social || {}).filter(([, v]) => !!v);

  return (
    <section className="relative overflow-hidden bg-ink-900 py-16 sm:py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-700/25 via-ink-900 to-ink-900" />
      <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-wa-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-wa-500/15 text-wa-500 ring-1 ring-wa-500/30">
          <WhatsAppIcon className="h-7 w-7" />
        </span>

        <h2 className="mt-6 text-3xl font-bold leading-tight text-white sm:text-4xl">
          {open ? 'Hungry now? We are already cooking.' : 'Want to plan ahead? Message us anyway.'}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-300">
          Send your order on WhatsApp and we will confirm it straight away. Or call if you would rather talk to
          someone.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {open ? (
            <WhatsAppOrderCta variant="dark" />
          ) : (
            <a href={`tel:${settings?.phone || ''}`} className="btn-primary btn-lg w-full sm:w-auto">
              <PhoneIcon className="h-5 w-5" />
              Call {settings?.phone}
            </a>
          )}
          <Link to="/track" className="btn-lg w-full border border-white/20 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
            Track an order
          </Link>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-white/10 pt-8 text-sm text-ink-400 sm:flex-row sm:justify-center sm:gap-6">
          {settings?.phone && (
            <a href={`tel:${settings.phone}`} className="flex items-center gap-2 hover:text-white">
              <PhoneIcon className="h-4 w-4" /> {settings.phone}
            </a>
          )}
          {settings?.address && (
            <span className="flex items-center gap-2">
              <PinIcon className="h-4 w-4" /> {settings.address}, {settings.city}
            </span>
          )}
        </div>

        {social.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-ink-400">
            <span>Follow us</span>
            {social.map(([name, url]) => (
              <a key={name} href={url as string} target="_blank" rel="noreferrer" className="capitalize hover:text-white">
                {name}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function SectionHead({
  eyebrow,
  title,
  sub,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h2>
      {sub && <p className="mt-2 text-sm text-ink-500">{sub}</p>}
    </div>
  );
}
