import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../../lib/api';
import { productImage } from '../../lib/productImage';
import type { Product } from '../../lib/types';
import { useCart } from '../../store/cart';
import { PlusIcon, StarIcon } from '../ui/Icons';
import { Badge, Rating } from '../ui';

/** gradient stand-in so a product without a photo still looks deliberate */
const TINTS = [
  'from-brand-200 to-brand-400',
  'from-amber-200 to-orange-400',
  'from-rose-200 to-berry-400',
  'from-emerald-200 to-teal-400',
  'from-violet-200 to-purple-400',
  'from-sky-200 to-blue-400',
];

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const add = useCart((s) => s.add);
  const [picked, setPicked] = useState<string | undefined>(undefined);

  const photo = productImage(product);
  const sizes = product.variants?.filter((v) => v.active) || [];
  const selected = sizes.find((v) => v.name === picked) || sizes[0];
  const price = selected?.price ?? product.effectivePrice ?? product.price;
  const tint = TINTS[index % TINTS.length];
  const soldOut = product.available === false;

  const addToCart = () => {
    add({
      ref: product._id,
      kind: 'product',
      name: product.name,
      image: photo,
      unitPrice: price,
      qty: 1,
      variantName: sizes.length ? selected?.name : undefined,
    });
  };

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link to={`/product/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`grid h-full w-full place-items-center bg-gradient-to-br ${tint}`}>
            <span className="font-display text-3xl font-bold text-white/80">{product.name.slice(0, 2)}</span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {soldOut && <Badge tone="muted">Sold out</Badge>}
          {!soldOut && product.featured && <Badge>Popular</Badge>}
          {product.isSpicy && <Badge tone="berry">Spicy</Badge>}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/product/${product.slug}`} className="font-display text-base font-semibold leading-snug hover:text-brand-600">
            {product.name}
          </Link>
          {product.rating && product.rating.total > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-ink-600">
              <StarIcon className="h-3.5 w-3.5 text-brand-500" filled />
              {product.rating.average.toFixed(1)}
            </span>
          )}
        </div>

        {typeof product.category === 'object' && product.category?.name && (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-ink-400">{product.category.name}</p>
        )}

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">{product.description}</p>

        {product.tags && product.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {product.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                {t}
              </span>
            ))}
          </div>
        )}

        {sizes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sizes.map((v) => (
              <button
                key={v.name}
                onClick={() => setPicked(v.name)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  (picked || sizes[0].name) === v.name
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="font-display text-lg font-bold">{money(price)}</span>
          <button className="btn-primary btn-sm" disabled={soldOut} onClick={addToCart}>
            <PlusIcon className="h-4 w-4" />
            {soldOut ? 'Sold out' : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p, i) => (
        <ProductCard key={p._id} product={p} index={i} />
      ))}
    </div>
  );
}

export { Rating };

