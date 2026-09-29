import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from '../../lib/api';
import {
  getDaily,
  getInsights,
  getMonthly,
  getOverview,
  getTopDeals,
  getTopProducts,
} from '../../lib/apiClient';
import { PAYMENT_LABEL, STATUS_LABEL, trend } from '../../lib/format';
import type {
  AnalyticsOverview,
  DailyPoint,
  Insights,
  MonthlyResult,
  OrderStatus,
  RankedDeal,
  RankedItem,
} from '../../lib/types';
import { ErrorNote, Loading, Stat } from '../../components/ui';
import { ChartIcon, SparkIcon, StarIcon, TruckIcon } from '../../components/ui/Icons';

const PALETTE = ['#f97316', '#e11d48', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b'];

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e7e5e4',
  fontSize: 13,
  boxShadow: '0 8px 24px -12px rgb(0 0 0 / 0.24)',
};

const NOTE_TONE: Record<string, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  ok: 'border-brand-200 bg-brand-50 text-brand-900',
  watch: 'border-amber-200 bg-amber-50 text-amber-900',
  bad: 'border-berry-500/30 bg-berry-500/10 text-berry-600',
};

export default function AdminAnalytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [monthly, setMonthly] = useState<MonthlyResult | null>(null);
  const [topProducts, setTopProducts] = useState<RankedItem[]>([]);
  const [topDeals, setTopDeals] = useState<{ top: RankedDeal[]; neverSold: RankedDeal[] }>({ top: [], neverSold: [] });
  const [insights, setInsights] = useState<Insights | null>(null);
  const [range, setRange] = useState(30);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    Promise.all([
      getOverview(range),
      getDaily(range),
      getMonthly(6),
      getTopProducts(range, 8),
      getTopDeals(range, 8),
      getInsights(range),
    ])
      .then(([o, d, m, tp, td, i]) => {
        setOverview(o);
        setDaily(d);
        setMonthly(m);
        setTopProducts(tp);
        setTopDeals(td);
        setInsights(i);
      })
      .catch((e) => setError((e as Error).message));
  }, [range]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!overview || !monthly) return <Loading />;

  const paymentData = overview.byPayment
    .filter((p) => p.amount > 0)
    .map((p) => ({ name: PAYMENT_LABEL[p._id] || p._id, value: p.amount }));

  const statusData = Object.entries(overview.byStatus)
    .filter(([, v]) => (v || 0) > 0)
    .map(([status, count]) => ({ name: STATUS_LABEL[status as OrderStatus] || status, value: count }));

  const bestProduct = topProducts[0];
  const bestDeal = topDeals.top[0];
  const maxProductQty = topProducts[0]?.qtySold || 1;
  const maxDealQty = topDeals.top[0]?.qtySold || 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-ink-500">Sales, profit and what is actually selling.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={`Revenue · ${range} days`}
          value={money(overview.totals.revenue)}
          sub={trend(overview.trend.changePercent)}
          tone="brand"
        />
        <Stat
          label="Gross profit"
          value={money(overview.totals.profit)}
          sub={`${insights ? insights.metrics.margin.toFixed(1) : '0.0'}% margin · cost ${money(overview.totals.cost)}`}
          tone="positive"
        />
        <Stat
          label="Orders"
          value={overview.totals.orders}
          sub={`${overview.today.orders} today · ${overview.totals.cancelledOrders} cancelled`}
        />
        <Stat
          label="Average order"
          value={money(overview.totals.avgOrderValue)}
          sub={`${money(overview.totals.foodRevenue)} food + ${money(overview.totals.deliveryCollected)} delivery`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: StarIcon, label: 'Best seller', value: bestProduct ? `${bestProduct.name} · ${bestProduct.qtySold} sold` : 'Not enough sales yet' },
          {
            icon: ChartIcon,
            label: 'Busiest day',
            value: insights && insights.metrics.orders > 0 ? insights.metrics.peakDay : '—',
          },
          {
            icon: TruckIcon,
            label: 'Peak ordering hour',
            value: insights && insights.metrics.orders > 0 ? `${insights.metrics.peakHour}:00` : '—',
          },
        ].map((c) => (
          <div key={c.label} className="card flex items-start gap-3 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <c.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-ink-500">{c.label}</span>
              <span className="mt-0.5 block font-semibold">{c.value}</span>
            </span>
          </div>
        ))}
      </div>

      {insights && insights.notes.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 font-semibold">
            <SparkIcon className="h-4 w-4" /> In plain words
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {insights.notes.map((n, i) => (
              <li key={i} className={`rounded-xl border p-4 ${NOTE_TONE[n.tone] || NOTE_TONE.ok}`}>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-1 text-sm opacity-80">{n.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Daily sales</h2>
          <div className="flex gap-1.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  range === d ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#78716c' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#78716c' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v / 1000}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} labelFormatter={(l) => String(l)} />
              <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#rev)" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Last 6 months</h2>
          {monthly.currentMonth && (
            <p className="text-sm text-ink-500">
              {monthly.currentMonth.label}: {money(monthly.currentMonth.revenue)} ·{' '}
              {trend(monthly.changePercent)}
            </p>
          )}
        </div>
        <div className="mt-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly.series} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#78716c' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v / 1000}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#f97316" radius={[6, 6, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-ink-400">No sales recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {topProducts.map((p, i) => (
                <div key={p._id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100 text-xs font-bold text-ink-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${(p.qtySold / maxProductQty) * 100}%` }}
                      />
                    </div>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-semibold">{p.qtySold} sold</span>
                    <span className="text-xs text-ink-500">{money(p.revenue)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Top bundles</h2>
          {topDeals.top.length === 0 ? (
            <p className="mt-4 text-sm text-ink-400">No bundles have sold yet.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {topDeals.top.map((d, i) => (
                <div key={d._id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-berry-500/10 text-xs font-bold text-berry-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.name}</span>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-berry-500"
                        style={{ width: `${(d.qtySold / maxDealQty) * 100}%` }}
                      />
                    </div>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-semibold">{d.qtySold} sold</span>
                    <span className="text-xs text-ink-500">{money(d.revenue)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {topDeals.neverSold.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Not selling: {topDeals.neverSold.map((d) => d.name).join(', ')}
            </p>
          )}
          {bestDeal && (
            <p className="mt-3 text-xs text-ink-500">
              Best bundle: {bestDeal.name} · {money(bestDeal.profit)} profit
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Where orders are now</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Revenue by payment method</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {paymentData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
