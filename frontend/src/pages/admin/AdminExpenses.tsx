import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { createExpense, deleteExpense, getAdminExpenses, updateExpense } from '../../lib/apiClient';
import { money } from '../../lib/api';
import { formatDay } from '../../lib/format';
import { EXPENSE_CATEGORIES } from '../../lib/types';
import type { Expense, ExpenseList } from '../../lib/types';
import { Badge, EmptyState, ErrorNote, Field, Loading, Modal, Stat } from '../../components/ui';
import { CloseIcon, PlusIcon, RupeeIcon, SearchIcon, TrashIcon } from '../../components/ui/Icons';

const RANGES = [
  { key: 'all', label: 'All time' },
  { key: 'month', label: 'This month' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

const pad = (n: number) => String(n).padStart(2, '0');

/** the local calendar day as YYYY-MM-DD — built from local parts on purpose,
 *  so a row never slides a day when the browser is not on UTC */
const dayKey = (value: string | Date) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** local noon for that day, so every browser renders the same date back */
const isoForDay = (key: string) => new Date(`${key}T12:00:00`).toISOString();

const today = () => dayKey(new Date());

const daysAgo = (count: number) => {
  const d = new Date();
  d.setDate(d.getDate() - count);
  return dayKey(d);
};

function rangeParams(key: RangeKey) {
  const now = new Date();
  if (key === 'month') return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today() };
  if (key === '30') return { from: daysAgo(29), to: today() };
  if (key === '90') return { from: daysAgo(89), to: today() };
  return {};
}

const blank = (): Expense => ({
  _id: '',
  title: '',
  category: 'Other',
  amount: 0,
  spentAt: new Date().toISOString(),
  vendor: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
});

export default function AdminExpenses() {
  const [data, setData] = useState<ExpenseList | null>(null);
  const [extra, setExtra] = useState<Expense[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [range, setRange] = useState<RangeKey>('all');
  const [editing, setEditing] = useState<Expense | null>(null);

  const params = useCallback(
    () => ({ q: search || undefined, category: category || undefined, ...rangeParams(range) }),
    [search, category, range],
  );

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        setData(await getAdminExpenses(params()));
        setPage(1);
        setExtra([]);
        setError('');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [params],
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    try {
      const next = page + 1;
      const res = await getAdminExpenses({ ...params(), page: next });
      setPage(next);
      setExtra((prev) => [...prev, ...res.expenses]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = async (expense: Expense) => {
    const body = {
      title: expense.title.trim(),
      amount: Number(expense.amount),
      category: expense.category.trim() || 'Other',
      spentAt: isoForDay(dayKey(expense.spentAt)),
      vendor: expense.vendor,
      notes: expense.notes,
    };

    try {
      if (expense._id) {
        await updateExpense(expense._id, body);
        toast.success('Expense saved');
      } else {
        await createExpense(body);
        toast.success('Expense added');
      }
      setEditing(null);
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (expense: Expense) => {
    if (!confirm(`Delete "${expense.title}" (${money(expense.amount)})?`)) return;
    try {
      await deleteExpense(expense._id);
      toast.success('Expense deleted');
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading && !data) return <Loading label="Loading expenses…" />;

  const summary = data?.summary;
  const rows = data ? [...data.expenses, ...extra] : [];
  const categories = data?.categories || [];
  const filtering = Boolean(search || category || range !== 'all');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-ink-500">
            What the shop actually paid out — meat, spices, bills, repairs. Separate from food cost
            on orders.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(blank())}>
          <PlusIcon className="h-4 w-4" /> Add expense
        </button>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="This month" value={money(summary.thisMonth)} tone="negative" sub="spent so far" />
          <Stat label="Last 30 days" value={money(summary.last30Days)} tone="negative" sub="rolling total" />
          <Stat
            label="In this view"
            value={money(summary.amount)}
            tone="brand"
            sub={`${summary.count} ${summary.count === 1 ? 'entry' : 'entries'}`}
          />
        </div>
      )}

      {summary && summary.byCategory.length > 1 && (
        <div className="card flex flex-wrap items-center gap-2 p-4">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Where it went
          </span>
          {summary.byCategory.map((row) => (
            <Badge key={row.category} tone="muted">
              {row.category} · {money(row.amount)}
            </Badge>
          ))}
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search what you bought, or the supplier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={range === r.key ? 'btn-dark btn-sm' : 'btn-ghost btn-sm'}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filtering ? 'Nothing matches that' : 'No expenses yet'}
          hint={
            filtering
              ? 'Try a different search or range.'
              : 'Record the next thing you buy so the shop knows what it actually spent.'
          }
          icon={<RupeeIcon className="h-6 w-6" />}
          action={
            filtering ? undefined : (
              <button className="btn-primary" onClick={() => setEditing(blank())}>
                <PlusIcon className="h-4 w-4" /> Add expense
              </button>
            )
          }
        />
      ) : (
        <div className="card table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs tracking-wide text-ink-500 uppercase">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Paid to</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((expense) => (
                <tr key={expense._id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-ink-600">{formatDay(expense.spentAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{expense.title}</p>
                    {expense.notes && <p className="text-xs text-ink-500">{expense.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="muted">{expense.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{expense.vendor || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                    {money(expense.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(expense)}>
                        Edit
                      </button>
                      <button
                        className="btn-ghost btn-sm text-berry-600"
                        onClick={() => remove(expense)}
                        aria-label={`Delete ${expense.title}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data && data.total > rows.length && (
            <div className="border-t border-ink-200 p-3 text-center">
              <button className="btn-ghost btn-sm" onClick={loadMore}>
                Show older ({data.total - rows.length} more)
              </button>
            </div>
          )}
        </div>
      )}

      {editing && <ExpenseEditor expense={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function ExpenseEditor({
  expense,
  onClose,
  onSave,
}: {
  expense: Expense;
  onClose: () => void;
  onSave: (e: Expense) => void;
}) {
  const [draft, setDraft] = useState(expense);
  const set = <K extends keyof Expense>(key: K, value: Expense[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // keep a hand-typed category selectable even though it is not on the offer list
  const options: string[] = [...EXPENSE_CATEGORIES];
  if (draft.category && !options.includes(draft.category)) options.unshift(draft.category);

  const amount = Number(draft.amount);
  const canSave = Boolean(draft.title.trim()) && Number.isFinite(amount) && amount > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={expense._id ? 'Edit expense' : 'Add an expense'}
    >
      <div className="space-y-4">
        <Field label="What was it">
          <input
            className="input"
            value={draft.title}
            placeholder="Beef mince, 10kg"
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (Rs)">
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={draft.amount || ''}
              onChange={(e) => set('amount', Number(e.target.value))}
            />
          </Field>

          <Field label="Date" hint="The day the money went out.">
            <input
              className="input"
              type="date"
              value={dayKey(draft.spentAt)}
              onChange={(e) => e.target.value && set('spentAt', isoForDay(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select className="input" value={draft.category} onChange={(e) => set('category', e.target.value)}>
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Paid to" hint="Supplier or shop, if it matters later.">
            <input
              className="input"
              value={draft.vendor}
              placeholder="Khalil Bazaar"
              onChange={(e) => set('vendor', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            className="input min-h-20"
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
          <button className="btn-ghost" onClick={onClose}>
            <CloseIcon className="h-4 w-4" /> Cancel
          </button>
          <button className="btn-primary" onClick={() => onSave(draft)} disabled={!canSave}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
