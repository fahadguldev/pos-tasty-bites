import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { mainImage, money } from '../../lib/api';
import {
  createCategory,
  deleteCategory,
  deleteProduct,
  getAdminProducts,
  getCategories,
  toggleProductAvailability,
} from '../../lib/apiClient';
import type { Category, Product } from '../../lib/types';
import { ProductForm } from '../../components/admin/ProductForm';
import { Badge, EmptyState, ErrorNote, Field, Loading, Modal, Rating, Spinner } from '../../components/ui';
import { BoxIcon, PlusIcon, SearchIcon, TrashIcon } from '../../components/ui/Icons';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [busy, setBusy] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [p, c] = await Promise.all([getAdminProducts(), getCategories(true)]);
      setProducts(p);
      setCategories(c);
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

  const toggle = async (p: Product) => {
    setBusy(p._id);
    try {
      // the server flips the flag, so take the new value from its response
      const res = await toggleProductAvailability(p._id);
      toast.success(res.available ? `${p.name} is available again` : `${p.name} marked sold out`);
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setBusy(p._id);
    try {
      await deleteProduct(p._id);
      toast.success('Item deleted');
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const visible = products.filter((p) => {
    const catId = typeof p.category === 'string' ? p.category : p.category?._id;
    if (categoryFilter && catId !== categoryFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Menu</h1>
          <p className="mt-1 text-sm text-ink-500">Items, prices, photos and availability.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline btn-md" onClick={() => setCatOpen(true)}>
            Manage categories
          </button>
          <button
            className="btn-primary btn-md"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" /> Add item
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-10"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-52"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<BoxIcon className="h-6 w-6" />}
          title="No items yet"
          hint="Add your first menu item to get started."
        />
      ) : (
        <div className="table-wrap">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Item</th>
                <th className="th">Category</th>
                <th className="th">Price</th>
                <th className="th">Rating</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((p) => {
                const photo = mainImage(p.images);
                const options = p.variants.filter((v) => v.active);
                return (
                  <tr key={p._id} className="hover:bg-ink-50">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                          {photo ? (
                            <img src={photo} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-xs font-bold text-ink-400">
                              {p.name.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="truncate text-xs text-ink-500">
                            {options.length ? options.map((v) => v.name).join(', ') : 'Single price'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="td text-xs text-ink-600">
                      {typeof p.category === 'string' ? '—' : p.category?.name || '—'}
                    </td>
                    <td className="td font-semibold">
                      {money(p.effectivePrice)}
                      {p.cost > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-ink-400">cost {money(p.cost)}</span>
                      )}
                    </td>
                    <td className="td">
                      {p.rating?.total ? (
                        <Rating value={p.rating.average} count={p.rating.total} />
                      ) : (
                        <span className="text-xs text-ink-400">No reviews</span>
                      )}
                    </td>
                    <td className="td">
                      {!p.available ? (
                        <Badge tone="muted">Sold out</Badge>
                      ) : (
                        <Badge tone="success">Available</Badge>
                      )}
                      {p.featured && (
                        <span className="ml-1">
                          <Badge>Favourite</Badge>
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-outline btn-sm" onClick={() => toggle(p)} disabled={busy === p._id}>
                          {p.available ? 'Sold out' : 'Restock'}
                        </button>
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost btn-sm text-berry-600"
                          onClick={() => remove(p)}
                          aria-label={`Delete ${p.name}`}
                        >
                          <TrashIcon className="h-4 w-4" />
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

      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => load(true)}
        editing={editing}
        categories={categories}
      />

      <CategoryManager
        open={catOpen}
        onClose={() => setCatOpen(false)}
        categories={categories}
        products={products}
        onSaved={() => load(true)}
      />
    </div>
  );
}

function CategoryManager({
  open,
  onClose,
  categories,
  products,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  products: Product[];
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    if (name.trim().length < 2) return setError('Category name is too short.');
    setBusy(true);
    setError('');
    try {
      await createCategory({ name: name.trim() });
      setName('');
      onSaved();
      toast.success('Category added');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    const used = products.filter(
      (p) => (typeof p.category === 'string' ? p.category : p.category?._id) === c._id,
    ).length;
    const warning = used
      ? `\n\n${used} item(s) use this category and will need to be reassigned.`
      : '';
    if (!confirm(`Delete "${c.name}"?${warning}`)) return;
    try {
      await deleteCategory(c._id);
      onSaved();
      toast.success('Category deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Categories">
      <div className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="New category">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shakes"
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
            </Field>
          </div>
          <button className="btn-primary btn-md h-11" onClick={add} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Add'}
          </button>
        </div>

        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
          {categories.map((c) => {
            const used = products.filter(
              (p) => (typeof p.category === 'string' ? p.category : p.category?._id) === c._id,
            ).length;
            return (
              <li key={c._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-ink-500">
                    {used} item{used === 1 ? '' : 's'}
                  </span>
                </span>
                <button
                  className="btn-ghost btn-sm text-berry-600"
                  onClick={() => remove(c)}
                  aria-label={`Delete ${c.name}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
          {categories.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-400">No categories yet.</li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
