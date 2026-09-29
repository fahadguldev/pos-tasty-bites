import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createProduct, updateProduct, uploadImage } from '../../lib/apiClient';
import { ErrorNote, Field, Modal, Spinner } from '../ui';
import type { Category, Product, ProductImage, Variant } from '../../lib/types';
import { TrashIcon } from '../ui/Icons';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** one photo — used for deals, which have a single image */
export function ImageUploader({
  value,
  onChange,
  onRemove,
}: {
  value?: string;
  onChange: (url: string) => void;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > MAX_IMAGE_BYTES) return setError('Images must be under 5 MB.');

    setBusy(true);
    try {
      const res = await uploadImage(file);
      onChange(res.url);
      toast.success('Image uploaded');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="label">Photo</span>
      <div className="flex items-start gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-ink-400">No photo</span>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            disabled={busy}
          />
          {value && (
            <button type="button" className="text-xs font-medium text-ink-500 hover:text-berry-600" onClick={onRemove}>
              Remove photo
            </button>
          )}
          {busy && (
            <p className="flex items-center gap-2 text-xs text-ink-500">
              <Spinner className="h-3.5 w-3.5" /> Uploading…
            </p>
          )}
          {error && <p className="text-xs font-medium text-berry-600">{error}</p>}
          <p className="text-xs text-ink-400">
            Uploading needs Cloudinary credentials in the backend .env — otherwise paste a URL below.
          </p>
        </div>
      </div>

      <input
        className="input mt-3"
        placeholder="…or paste an image URL"
        defaultValue={value || ''}
        key={value || 'empty'}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next && next !== value) onChange(next);
        }}
      />
    </div>
  );
}

/** products carry an ordered gallery; the first photo is the one shown on cards */
export function ImageGalleryEditor({
  images,
  onChange,
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const urlInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > MAX_IMAGE_BYTES) return setError('Images must be under 5 MB.');

    setBusy(true);
    try {
      const res = await uploadImage(file);
      onChange([...images, { url: res.url, publicId: res.publicId }]);
      toast.success('Image uploaded');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const commitUrl = () => {
    const trimmed = (urlInput.current?.value || '').trim();
    if (trimmed && !images.some((i) => i.url === trimmed)) onChange([...images, { url: trimmed }]);
    if (urlInput.current) urlInput.current.value = '';
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label !mb-0">Photos</span>
        <span className="text-xs text-ink-400">First photo is the cover</span>
      </div>

      {images.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="relative">
              <img
                src={img.url}
                alt=""
                className={`h-24 w-24 rounded-xl object-cover ${i === 0 ? 'ring-2 ring-brand-600' : ''}`}
              />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-ink-600 shadow hover:text-berry-600"
                aria-label={`Remove photo ${i + 1}`}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          disabled={busy}
        />
        {busy && (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Spinner className="h-3.5 w-3.5" /> Uploading…
          </p>
        )}
        {error && <p className="text-xs font-medium text-berry-600">{error}</p>}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          ref={urlInput}
          className="input"
          placeholder="…or paste an image URL and press Add"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitUrl();
            }
          }}
        />
        <button type="button" className="btn-outline btn-md shrink-0" onClick={commitUrl}>
          Add
        </button>
      </div>
    </div>
  );
}

/** variants are sizes; the cheapest active one sets the price shown on the card */
export function VariantEditor({
  variants,
  onChange,
}: {
  variants: Variant[];
  onChange: (v: Variant[]) => void;
}) {
  const update = (i: number, patch: Partial<Variant>) =>
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const cheapest = variants
    .filter((v) => v.active && v.price > 0)
    .reduce((min, v) => (min === null || v.price < min ? v.price : min), null as number | null);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label !mb-0">Size options</span>
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={() => onChange([...variants, { name: '', price: 0, active: true }])}
        >
          Add size
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="text-xs text-ink-400">
          No sizes — this item is sold at one price. Add sizes like "Regular" and "Large" to offer choices.
        </p>
      ) : (
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="input flex-1"
                placeholder="Size name, e.g. Large"
                value={v.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <input
                className="input w-28"
                type="number"
                min={0}
                placeholder="Price"
                value={v.price || ''}
                onChange={(e) => update(i, { price: Number(e.target.value) })}
              />
              <label className="flex items-center gap-1.5 text-xs text-ink-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={v.active}
                  onChange={(e) => update(i, { active: e.target.checked })}
                />
                On offer
              </label>
              <button
                type="button"
                className="text-ink-400 hover:text-berry-600"
                onClick={() => onChange(variants.filter((_, idx) => idx !== i))}
                aria-label="Remove size"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {cheapest !== null && (
            <p className="text-xs text-ink-500">Customers will see this item “from” the cheapest active size.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface FormState {
  name: string;
  description: string;
  category: string;
  price: number;
  cost: number;
  variants: Variant[];
  tags: string[];
  isSpicy: boolean;
  isVegetarian: boolean;
  available: boolean;
  featured: boolean;
  sortOrder: number;
  images: ProductImage[];
}

export function ProductForm({
  open,
  onClose,
  onSaved,
  editing,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Product | null;
  categories: Category[];
}) {
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    category: '',
    price: 0,
    cost: 0,
    variants: [],
    tags: [],
    isSpicy: false,
    isVegetarian: false,
    available: true,
    featured: false,
    sortOrder: 0,
    images: [],
  });
  const [tagsText, setTagsText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // seed the form whenever the modal opens, for a new item or an existing one
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? editing?._id || 'new' : null;
  if (seedKey && seededFor !== seedKey) {
    setSeededFor(seedKey);
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description || '',
        category: typeof editing.category === 'string' ? editing.category : editing.category?._id || '',
        price: editing.price,
        cost: editing.cost || 0,
        variants: editing.variants || [],
        tags: editing.tags || [],
        isSpicy: !!editing.isSpicy,
        isVegetarian: !!editing.isVegetarian,
        available: editing.available !== false,
        featured: !!editing.featured,
        sortOrder: editing.sortOrder || 0,
        images: editing.images || [],
      });
      setTagsText((editing.tags || []).join(', '));
    } else {
      setForm((f) => ({ ...f, category: categories[0]?._id || '' }));
      setTagsText('');
    }
    setError('');
  }
  if (!open && seededFor !== null) setSeededFor(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setError('');
    if (form.name.trim().length < 2) return setError('Give the item a name.');
    if (!form.category) return setError('Pick a category.');

    const variants = form.variants.filter((v) => v.name.trim());
    if (variants.length === 0 && !(form.price > 0)) {
      return setError('Set a price, or add at least one size with a price.');
    }
    if (form.cost > form.price && form.price > 0) {
      return setError('The cost cannot be higher than the selling price.');
    }

    setBusy(true);
    try {
      const payload = {
        ...form,
        variants,
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (editing) await updateProduct(editing._id, payload);
      else await createProduct(payload);

      toast.success(editing ? 'Item updated' : 'Item added');
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add a new item'} wide>
      <div className="space-y-5">
        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Zinger Burger"
            />
          </Field>
          <Field label="Category">
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-20 resize-y"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Selling price" hint="Used when there are no size options.">
            <input
              className="input"
              type="number"
              min={0}
              value={form.price || ''}
              onChange={(e) => set('price', Number(e.target.value))}
            />
          </Field>
          <Field label="Cost" hint="What you pay for it — used for profit numbers only.">
            <input
              className="input"
              type="number"
              min={0}
              value={form.cost || ''}
              onChange={(e) => set('cost', Number(e.target.value))}
            />
          </Field>
        </div>

        <VariantEditor variants={form.variants} onChange={(v) => set('variants', v)} />

        <ImageGalleryEditor images={form.images} onChange={(i) => set('images', i)} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tags" hint="Comma separated, e.g. spicy, bestseller">
            <input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </Field>
          <Field label="Sort order" hint="Lower shows first on the menu.">
            <input
              className="input"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-5">
          {[
            { key: 'available', label: 'Available to order' },
            { key: 'featured', label: 'Show as a favourite' },
            { key: 'isSpicy', label: 'Spicy' },
            { key: 'isVegetarian', label: 'Vegetarian' },
          ].map((t) => (
            <label key={t.key} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={form[t.key as keyof FormState] as boolean}
                onChange={(e) => set(t.key as keyof FormState, e.target.checked as never)}
              />
              {t.label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
          <button className="btn-outline btn-md" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary btn-md" onClick={save} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
