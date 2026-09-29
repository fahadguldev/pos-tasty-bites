import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { downloadFile, money } from '../../lib/api';
import {
  getAdminOrder,
  getAdminOrders,
  getOverview,
  resendWhatsapp,
  updateOrder,
} from '../../lib/apiClient';
import { NEXT_STATUS, PAYMENT_LABEL, SOURCE_LABEL, formatDate } from '../../lib/format';
import type { Order, OrderList, OrderStatus, PaymentStatus } from '../../lib/types';
import { Badge, EmptyState, ErrorNote, Loading, Modal, PaymentBadge, Spinner, StatusBadge } from '../../components/ui';
import { SearchIcon, WhatsAppIcon } from '../../components/ui/Icons';

const FILTERS: { key: string; label: string; status?: string }[] = [
  { key: 'active', label: 'In progress', status: 'active' },
  { key: 'new', label: 'New', status: 'new' },
  { key: 'preparing', label: 'Preparing', status: 'preparing' },
  { key: 'out_for_delivery', label: 'Out for delivery', status: 'out_for_delivery' },
  { key: 'delivered', label: 'Delivered', status: 'delivered' },
  { key: 'cancelled', label: 'Cancelled', status: 'cancelled' },
  { key: 'all', label: 'All' },
];

const PAYMENT_STATES: PaymentStatus[] = ['pending', 'received', 'refunded'];

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<OrderList | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);

  const filter = params.get('filter') || 'active';
  const page = Number(params.get('page') || 1);
  const search = params.get('search') || '';
  const source = params.get('source') || '';

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const status = FILTERS.find((f) => f.key === filter)?.status;
        setData(
          await getAdminOrders({
            page,
            limit: 20,
            status: status || undefined,
            search: search || undefined,
            source: source || undefined,
          }),
        );
        setError('');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [filter, page, search, source],
  );

  useEffect(() => {
    load();
  }, [load]);

  // the "New" badge in the sidebar comes from here, so keep it fresh
  useEffect(() => {
    let alive = true;
    const tick = () =>
      getOverview(1)
        .then((o) => alive && setNewCount(o.newOrdersCount))
        .catch(() => undefined);
    tick();
    const t = setInterval(tick, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  // open the modal and pull the full record, so profit and flags are present
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    getAdminOrder(detailId)
      .then(setDetail)
      .catch((e) => toast.error((e as Error).message));
  }, [detailId]);

  const act = async (order: Order, body: Parameters<typeof updateOrder>[1], message: string) => {
    setBusy(order._id);
    try {
      const updated = await updateOrder(order._id, body);
      setDetail(updated);
      toast.success(message);
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const downloadReceipt = async (order: Order) => {
    setBusy(order._id);
    try {
      await downloadFile(`/admin/orders/${order._id}/receipt`, `tasty-bites-${order.orderNo}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-ink-500">
            Website, WhatsApp and counter orders in one queue.
            {newCount > 0 && <span className="ml-1 font-semibold text-brand-600">{newCount} new</span>}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement;
            setParam('search', input.value.trim());
          }}
          className="relative w-full sm:w-72"
        >
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            className="input pl-10"
            defaultValue={search}
            placeholder="Order number, name or phone…"
            key={search}
          />
        </form>
      </header>

      <div className="rail">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setParam('filter', f.key)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition sm:py-2 ${
              filter === f.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-100'
            }`}
          >
            {f.label}
          </button>
        ))}
        {['website', 'whatsapp'].map((s) => (
          <button
            key={s}
            onClick={() => setParam('source', source === s ? '' : s)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition sm:py-2 ${
              source === s
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-100'
            }`}
          >
            {SOURCE_LABEL[s]} only
          </button>
        ))}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <Loading />
      ) : !data || data.orders.length === 0 ? (
        <EmptyState title="No orders here" hint="Try a different filter or clear the search." />
      ) : (
        <div className="table-wrap">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Order</th>
                <th className="th">Customer</th>
                <th className="th">Items</th>
                <th className="th">Total</th>
                <th className="th">Payment</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {data.orders.map((o) => {
                const next = NEXT_STATUS[o.status];
                return (
                  <tr key={o._id} className="hover:bg-ink-50">
                    <td className="td">
                      <button className="font-semibold hover:text-brand-600" onClick={() => setDetailId(o._id)}>
                        {o.orderNo}
                      </button>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
                        {o.source === 'whatsapp' && <WhatsAppIcon className="h-3 w-3 text-emerald-600" />}
                        {SOURCE_LABEL[o.source] || o.source} · {formatDate(o.createdAt)}
                      </span>
                    </td>
                    <td className="td">
                      {o.customer.name}
                      <span className="block text-xs text-ink-500">{o.customer.phone}</span>
                    </td>
                    <td className="td text-xs text-ink-600">
                      {o.items.slice(0, 2).map((i) => `${i.qty}× ${i.name}`).join(', ')}
                      {o.items.length > 2 && ` +${o.items.length - 2} more`}
                    </td>
                    <td className="td font-semibold">{money(o.total)}</td>
                    <td className="td">
                      <span className="block text-xs text-ink-600">
                        {PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod}
                      </span>
                      <PaymentBadge status={o.paymentStatus} />
                    </td>
                    <td className="td">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        {next && (
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => act(o, { status: next.status }, `${o.orderNo} → ${next.label.toLowerCase()}`)}
                            disabled={busy === o._id}
                          >
                            {busy === o._id ? <Spinner className="h-3.5 w-3.5" /> : next.label}
                          </button>
                        )}
                        <button className="btn-outline btn-sm" onClick={() => setDetailId(o._id)}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">
            Page {data.page} of {data.pages} · {data.total} orders
          </span>
          <div className="flex gap-2">
            <button
              className="btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
            >
              Previous
            </button>
            <button
              className="btn-outline btn-sm"
              disabled={page >= data.pages}
              onClick={() => setParam('page', String(page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <OrderDetail
        order={detail}
        onClose={() => setDetailId(null)}
        onAct={act}
        onReceipt={downloadReceipt}
        onResend={async (o) => {
          setBusy(o._id);
          try {
            const res = await resendWhatsapp(o._id);
            if (res.link) window.open(res.link, '_blank', 'noopener');
            toast.success(res.sent ? 'Order sent to WhatsApp' : res.note || 'WhatsApp opened for you to send');
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy('');
          }
        }}
        busy={busy}
      />
    </div>
  );
}

function OrderDetail({
  order,
  onClose,
  onAct,
  onReceipt,
  onResend,
  busy,
}: {
  order: Order | null;
  onClose: () => void;
  onAct: (
    o: Order,
    body: { status?: OrderStatus; paymentStatus?: PaymentStatus; cancelledReason?: string },
    message: string,
  ) => void;
  onReceipt: (o: Order) => void;
  onResend: (o: Order) => void;
  busy: string;
}) {
  const next = order ? NEXT_STATUS[order.status] : undefined;
  const open = !!order;

  return (
    <Modal open={open} onClose={onClose} title={order ? `Order ${order.orderNo}` : ''} wide>
      {order ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <Badge tone={order.source === 'whatsapp' ? 'success' : 'muted'}>
              {SOURCE_LABEL[order.source] || order.source}
            </Badge>
            <span className="text-sm text-ink-500">Placed {formatDate(order.createdAt)}</span>
            {order.deliveredAt && (
              <span className="text-sm text-ink-500">Delivered {formatDate(order.deliveredAt)}</span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-ink-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Customer</p>
              <p className="mt-1.5 font-semibold">{order.customer.name}</p>
              <a href={`tel:${order.customer.phone}`} className="text-sm text-brand-600 hover:underline">
                {order.customer.phone}
              </a>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{order.customer.address}</p>
              {order.customer.landmark && (
                <p className="mt-1 text-xs text-ink-500">Landmark: {order.customer.landmark}</p>
              )}
              {order.customer.notes && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Note: {order.customer.notes}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-ink-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Payment</p>
              <p className="mt-1.5 font-semibold">{PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PAYMENT_STATES.map((s) => (
                  <button
                    key={s}
                    onClick={() => onAct(order, { paymentStatus: s }, `Payment marked ${s}`)}
                    disabled={order.paymentStatus === s || busy === order._id}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium capitalize transition ${
                      order.paymentStatus === s
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-500">
                Margin on this order: {money(order.profit)}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Items</p>
            <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    {i.qty}× {i.name}
                    {i.variantName && <span className="text-ink-500"> ({i.variantName})</span>}
                    {i.kind === 'deal' && <span className="ml-2 badge">bundle</span>}
                  </span>
                  <span className="font-semibold">{money(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {!!order.discount && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>- {money(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-500">Delivery</span>
                <span>{order.deliveryFee === 0 ? 'Free' : money(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-bold">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </div>

          {order.cancelledReason && (
            <p className="rounded-lg bg-berry-50 px-3 py-2 text-sm text-berry-800">
              Cancelled: {order.cancelledReason}
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-ink-200 pt-4">
            {next && (
              <button
                className="btn-primary btn-md"
                onClick={() => onAct(order, { status: next.status }, `${order.orderNo} → ${next.label.toLowerCase()}`)}
                disabled={busy === order._id}
              >
                {busy === order._id ? <Spinner className="h-4 w-4" /> : next.label}
              </button>
            )}
            {order.status === 'new' && (
              <button
                className="btn-outline btn-md"
                onClick={() => {
                  const reason = window.prompt('Why is this order being cancelled?', 'Customer unavailable');
                  if (reason === null) return;
                  onAct(order, { status: 'cancelled', cancelledReason: reason }, 'Order cancelled');
                }}
              >
                Cancel order
              </button>
            )}
            <button className="btn-outline btn-md" onClick={() => onResend(order)}>
              <WhatsAppIcon className="h-4 w-4 text-emerald-600" /> Send on WhatsApp
            </button>
            <button
              className="btn-outline btn-md"
              onClick={() => onReceipt(order)}
              disabled={busy === order._id}
            >
              Download receipt
            </button>
          </div>
        </div>
      ) : (
        <Loading label="Loading order…" />
      )}
    </Modal>
  );
}
