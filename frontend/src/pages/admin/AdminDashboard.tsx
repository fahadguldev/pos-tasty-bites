import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../../lib/api';
import { getAdminOrders, getInsights, getOverview } from '../../lib/apiClient';
import { PAYMENT_LABEL, SOURCE_LABEL, STATUS_LABEL, timeAgo, trend } from '../../lib/format';
import type { AnalyticsOverview, Insights, Order } from '../../lib/types';
import { ErrorNote, Loading, Stat, StatusBadge } from '../../components/ui';
import { ChartIcon, ClipboardIcon, SparkIcon, TruckIcon } from '../../components/ui/Icons';

const NOTE_TONE: Record<string, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  ok: 'border-brand-200 bg-brand-50 text-brand-900',
  watch: 'border-amber-200 bg-amber-50 text-amber-900',
  bad: 'border-berry-500/30 bg-berry-500/10 text-berry-600',
};

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getOverview(30), getInsights(30), getAdminOrders({ status: 'active', limit: 8 })])
      .then(([o, i, list]) => {
        setOverview(o);
        setInsights(i);
        setOrders(list.orders);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!overview) return <Loading />;

  const pending = overview.byPayment.reduce((s, p) => s + p.pending, 0);
  const pendingAmount = overview.byPayment.reduce((s, p) => s + (p.pending ? p.amount / p.orders * p.pending : 0), 0);
  const statusTotal = Object.values(overview.byStatus).reduce((n, v) => n + (v || 0), 0) || 1;
  const inProgress = (overview.byStatus.new || 0) + (overview.byStatus.confirmed || 0) + (overview.byStatus.preparing || 0) + (overview.byStatus.out_for_delivery || 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">Last {overview.range.days} days, plus what needs doing right now.</p>
        </div>
        {overview.newOrdersCount > 0 && (
          <Link to="/admin/orders?filter=new" className="btn-primary btn-md">
            {overview.newOrdersCount} new order{overview.newOrdersCount === 1 ? '' : 's'} →
          </Link>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Revenue"
          value={money(overview.totals.revenue)}
          sub={trend(overview.trend.changePercent)}
          tone="brand"
        />
        <Stat label="Orders" value={overview.totals.orders} sub={`${overview.totals.itemsSold} items sold`} />
        <Stat
          label="Average order"
          value={money(overview.totals.avgOrderValue)}
          sub={`Delivery collected ${money(overview.totals.deliveryCollected)}`}
        />
        <Stat
          label="Gross profit"
          value={money(overview.totals.profit)}
          sub={`${insights ? insights.metrics.margin.toFixed(1) : '0.0'}% margin`}
          tone="positive"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/admin/orders?filter=active" className="card card-hover flex items-center gap-3 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
            <ClipboardIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-2xl font-bold">{inProgress}</span>
            <span className="text-sm text-ink-500">orders in progress</span>
          </span>
        </Link>

        <Link to="/admin/orders?filter=all" className="card card-hover flex items-center gap-3 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-600">
            <SparkIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-2xl font-bold">{pending}</span>
            <span className="text-sm text-ink-500">
              {pending > 0 ? 'payments still to collect' : 'nothing pending'}
            </span>
          </span>
        </Link>

        <div className="card flex items-center gap-3 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
            <TruckIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-2xl font-bold">{overview.today.orders}</span>
            <span className="text-sm text-ink-500">orders today · {money(overview.today.revenue)}</span>
          </span>
        </div>
      </div>

      {insights && insights.notes.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 font-semibold">
            <ChartIcon className="h-4 w-4" /> Things worth knowing
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

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="font-semibold">Live orders</h2>
          <Link to="/admin/orders" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            See all →
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">No orders waiting right now.</p>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Order</th>
                  <th className="th">Customer</th>
                  <th className="th">Total</th>
                  <th className="th">Status</th>
                  <th className="th">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-ink-50">
                    <td className="td font-semibold">
                      <Link className="hover:text-brand-600" to={`/admin/orders?filter=all&search=${o.orderNo}`}>
                        {o.orderNo}
                      </Link>
                      <span className="ml-2 text-xs font-normal text-ink-400">
                        {SOURCE_LABEL[o.source] || o.source}
                      </span>
                    </td>
                    <td className="td">
                      {o.customer.name}
                      <span className="block text-xs text-ink-500">{o.customer.phone}</span>
                    </td>
                    <td className="td font-semibold">{money(o.total)}</td>
                    <td className="td">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="td text-xs text-ink-500">{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Where orders are</h2>
          <ul className="mt-4 space-y-3">
            {Object.entries(overview.byStatus)
              .filter(([, v]) => (v || 0) > 0)
              .map(([status, count]) => (
                <li key={status}>
                  <div className="flex justify-between text-sm">
                    <span>{STATUS_LABEL[status as keyof typeof STATUS_LABEL] || status}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${((count || 0) / statusTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            {Object.values(overview.byStatus).every((v) => !v) && (
              <li className="text-sm text-ink-400">No orders in this window yet.</li>
            )}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Payment mix</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {overview.byPayment.map((p) => (
              <li key={p._id} className="flex items-center justify-between">
                <span className="text-ink-600">{PAYMENT_LABEL[p._id] || p._id}</span>
                <span className="font-semibold">
                  {p.orders} order{p.orders === 1 ? '' : 's'} · {money(p.amount)}
                  {p.pending > 0 && <span className="ml-1 text-xs font-normal text-amber-600">{p.pending} pending</span>}
                </span>
              </li>
            ))}
            {overview.byPayment.length === 0 && <li className="text-ink-400">No payments recorded yet.</li>}
          </ul>
          {pending > 0 && (
            <p className="mt-4 border-t border-ink-200 pt-3 text-xs text-ink-500">
              Roughly {money(pendingAmount)} of these are still waiting on the customer.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
