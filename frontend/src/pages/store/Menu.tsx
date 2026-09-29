import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCategories, getProducts } from '../../lib/apiClient';
import type { Category, Product } from '../../lib/types';
import { ProductGrid } from '../../components/store/ProductCard';
import { EmptyState, Loading } from '../../components/ui';
import { BoxIcon, SearchIcon } from '../../components/ui/Icons';

export default function Menu() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const activeCategory = params.get('category') || 'all';
  const sort = params.get('sort') || 'popular';

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    let list = products;

    if (activeCategory !== 'all') {
      const cat = categories.find((c) => c.slug === activeCategory);
      if (cat) {
        list = list.filter((p) => (typeof p.category === 'string' ? p.category === cat._id : p.category?._id === cat._id));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    const sorted = [...list];
    if (sort === 'price-low') sorted.sort((a, b) => a.effectivePrice - b.effectivePrice);
    if (sort === 'price-high') sorted.sort((a, b) => b.effectivePrice - a.effectivePrice);
    if (sort === 'rating') sorted.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
    if (sort === 'popular') {
      sorted.sort(
        (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.rating?.total || 0) - (a.rating?.total || 0),
      );
    }
    return sorted;
  }, [products, categories, activeCategory, search, sort]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'all' && key === 'category') next.delete('category');
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:py-10">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Our menu</h1>
        <p className="mt-2 text-ink-500">Everything we make, freshly cooked to order.</p>
      </header>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-10"
            placeholder="Search burgers, fries, shakes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="input sm:w-48" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="popular">Most popular</option>
          <option value="rating">Top rated</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>
      </div>

      <div className="rail mt-6">
        <CategoryPill
          active={activeCategory === 'all'}
          label="All items"
          count={products.length}
          onClick={() => setParam('category', 'all')}
        />
        {categories.map((c) => {
          const catId = c._id;
          const count = products.filter(
            (p) => (typeof p.category === 'string' ? p.category === catId : p.category?._id === catId),
          ).length;
          return (
            <CategoryPill
              key={c._id}
              active={activeCategory === c.slug}
              label={c.name}
              count={count}
              onClick={() => setParam('category', c.slug)}
            />
          );
        })}
      </div>

      <div className="mt-8">
        {loading ? (
          <Loading label="Loading the menu…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BoxIcon className="h-6 w-6" />}
            title="Nothing matches that"
            hint="Try another search or pick a different category."
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-500">
              {visible.length} item{visible.length === 1 ? '' : 's'}
            </p>
            <ProductGrid products={visible} />
          </>
        )}
      </div>
    </div>
  );
}

function CategoryPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm font-medium transition sm:py-2 ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50'
      }`}
    >
      {label}
      {count !== undefined && <span className={`ml-1.5 text-xs ${active ? 'text-white/70' : 'text-ink-400'}`}>{count}</span>}
    </button>
  );
}
