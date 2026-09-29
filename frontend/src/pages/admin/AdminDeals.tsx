import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { money } from '../../lib/api';
import { createDeal, deleteDeal, getAdminDeals, getAdminProducts, updateDeal } from '../../lib/apiClient';
import type { Deal } from '../../lib/types';
import { ImageUploader } from '../../components/admin/ProductForm';
import { Badge, EmptyState, ErrorNote, Field, Loading, Modal, Spinner } from '../../components/ui';
import { PlusIcon, TagIcon, TrashIcon } from '../../components/ui/Icons';

interface Line {
  product: string;
  qty: number;
  unitPrice?: number;
}

export default function AdminDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setDeals(await getAdminDeals());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (d: Deal) => {
    if (!confirm(`Delete the deal "${d.name}"?`)) return;
    try {
      await deleteDeal(d._id);
      toast.success('Deal deleted');
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const now = Date.now();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Deals & bundles</h1>
          <p className="mt-1 text-sm text-ink-500">Schedule a bundle and it appears on the storefront automatically.</p>
        </div>
        <button
          className="btn-primary btn-md"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon className="h-4 w-4" /> New deal
        </button>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold">Timeline</h2>
        <p className="mt-1 text-sm text-ink-500">Deals go live and drop off on their own — no manual switching.</p>

        <div className="rail mt-4">
          {deals.map((d) => {
            const upcoming = new Date(d.startsAt).getTime() > now;
            return (
              <div
                key={d._id}
                className={`w-64 rounded-xl border p-4 ${
                  d.isLive ? 'border-emerald-300 bg-emerald-50' : upcoming ? 'border-sky-300 bg-sky-50' : 'border-ink-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">{d.name}</p>
                  {d.isLive ? (
                    <Badge tone="success">Live</Badge>
                  ) : upcoming ? (
                    <Badge tone="info">Scheduled</Badge>
                  ) : (
                    <Badge tone="muted">Ended</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {new Date(d.startsAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })} →{' '}
                  {new Date(d.endsAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-bold">{money(d.price)}</span>
                  {d.compareAtPrice > d.price && (
                    <span className="ml-1.5 text-xs text-ink-400 line-through">{money(d.compareAtPrice)}</span>
                  )}
                </p>
              </div>
            );
          })}
          {deals.length === 0 && <p className="text-sm text-ink-400">No deals scheduled.</p>}
        </div>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <Loading />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-6 w-6" />}
          title="No deals yet"
          hint="Bundle a few items together to create your first offer."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {deals.map((d) => (
            <div key={d._id} className="card overflow-hidden">
              <div className="aspect-[16/9] bg-ink-100">
                {d.image ? (
                  <img src={d.image} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-brand-200 to-brand-400">
                    <span className="px-4 text-center font-display text-sm font-bold text-white">{d.name}</span>
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{d.name}</h3>
                  {d.discountPercent ? <Badge tone="berry">{d.discountPercent}% off</Badge> : null}
                </div>

                <p className="mt-1.5 text-xs text-ink-500">
                  {new Date(d.startsAt).toLocaleDateString()} → {new Date(d.endsAt).toLocaleDateString()}
                  {!d.available && <span className="ml-2 font-semibold text-ink-600">Paused</span>}
                </p>

                <ul className="mt-2.5 space-y-1 text-xs text-ink-600">
                  {d.items.map((i, idx) => (
                    <li key={idx}>
                      {i.qty}× {i.name}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-lg font-bold">{money(d.price)}</span>
                  {d.compareAtPrice > d.price && (
                    <span className="text-xs text-ink-400 line-through">{money(d.compareAtPrice)}</span>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary btn-sm flex-1"
                    onClick={() => {
                      setEditing(d);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button className="btn-ghost btn-sm text-berry-600" onClick={() => remove(d)} aria-label={`Delete ${d.name}`}>
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DealForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => load(true)}
        editing={editing}
      />
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DealForm({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Deal | null;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [badge, setBadge] = useState('');
  const [image, setImage] = useState('');
  const [available, setAvailable] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // the editor needs the full menu to let the owner pick bundle contents
  const [catalog, setCatalog] = useState<{ _id: string; name: string; price: number; image?: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    getAdminProducts()
      .then((ps) => setCatalog(ps.map((p) => ({ _id: p._id, name: p.name, price: p.effectivePrice, image: p.images[0]?.url }))))
      .catch((e) => setError((e as Error).message));
  }, [open]);

  const seedKey = open ? editing?._id || 'new' : null;
  if (seedKey && seededFor !== seedKey) {
    setSeededFor(seedKey);
    if (editing) {
      setName(editing.name);
      setDescription(editing.description || '');
      setPrice(editing.price);
      setBadge(editing.badge || '');
      setImage(editing.image || '');
      setAvailable(editing.available !== false);
      setFeatured(!!editing.featured);
      setLines(
        editing.items.map((i) => ({
          product: typeof i.product === 'string' ? i.product : i.product._id,
          qty: i.qty,
        })),
      );
      setStartsAt(toLocalInput(editing.startsAt));
      setEndsAt(toLocalInput(editing.endsAt));
    } else {
      const now = new Date();
      const later = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      setName('');
      setDescription('');
      setPrice(0);
      setBadge('');
      setImage('');
      setAvailable(true);
      setFeatured(false);
      setLines([]);
      setStartsAt(toLocalInput(now.toISOString()));
      setEndsAt(toLocalInput(later.toISOString()));
    }
    setError('');
  }
  if (!open && seededFor !== null) setSeededFor(null);

  const separateTotal = lines.reduce((sum, l) => {
    const p = catalog.find((x) => x._id === l.product);
    return sum + (p ? p.price * l.qty : 0);
  }, 0);

  const save = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Give the deal a name.');
    if (lines.length === 0) return setError('Add at least one item to the bundle.');
    if (lines.some((l) => !l.product)) return setError('Every bundle line needs an item.');
    if (!(price > 0)) return setError('Set the bundle price.');
    if (!startsAt || !endsAt) return setError('Set the start and end dates.');
    if (new Date(endsAt) <= new Date(startsAt)) return setError('The end date must be after the start date.');

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        price,
        badge,
        image,
        available,
        featured,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        items: lines.map((l) => ({ product: l.product, qty: l.qty })),
      };
      if (editing) await updateDeal(editing._id, payload);
      else await createDeal(payload);
      toast.success(editing ? 'Deal updated' : 'Deal created');
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'New deal'} wide>
      <div className="space-y-5">
        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deal name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family feast deal"
            />
          </Field>
          <Field label="Badge" hint="Optional, e.g. Family favourite">
            <input className="input" value={badge} onChange={(e) => setBadge(e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-20 resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label !mb-0">Bundle contents</span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setLines([...lines, { product: catalog[0]?._id || '', qty: 1 }])}
              disabled={catalog.length === 0}
            >
              Add item
            </button>
          </div>

          {catalog.length === 0 ? (
            <p className="text-xs text-ink-400">Loading the menu…</p>
          ) : lines.length === 0 ? (
            <p className="text-xs text-ink-400">Nothing in this bundle yet.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="input flex-1"
                    value={l.product}
                    onChange={(e) => setLines(lines.map((x, idx) => (idx === i ? { product: e.target.value, qty: 1 } : x)))}
                  >
                    <option value="">Choose an item…</option>
                    {catalog.map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name} — {money(x.price)}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input w-20"
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) =>
                      setLines(lines.map((x, idx) => (idx === i ? { ...x, qty: Number(e.target.value) } : x)))
                    }
                  />
                  <button
                    type="button"
                    className="text-ink-400 hover:text-berry-600"
                    onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                    aria-label="Remove item"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-ink-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">These items cost {money(separateTotal)} separately</p>
              {price > 0 && separateTotal > price && (
                <p className="mt-0.5 text-sm font-semibold text-emerald-600">
                  Customers save {money(separateTotal - price)} (
                  {Math.round(((separateTotal - price) / separateTotal) * 100)}%)
                </p>
              )}
              {price > 0 && separateTotal > 0 && price > separateTotal && (
                <p className="mt-0.5 text-sm font-semibold text-berry-600">This deal costs more than the items alone.</p>
              )}
            </div>
            <div className="w-40">
              <Field label="Bundle price">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={price || ''}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <input
              className="input"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <input
              className="input"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>

        <ImageUploader value={image} onChange={setImage} onRemove={() => setImage('')} />

        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Show this deal
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            Feature on the home page
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
          <button className="btn-outline btn-md" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary btn-md" onClick={save} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Create deal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
