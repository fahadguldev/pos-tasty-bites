import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryWindow, money } from '../../lib/api';
import { productImage } from '../../lib/productImage';
import { getProduct, getProductReviews, submitReview } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';
import type { Product, RatingSummary, Review, Settings } from '../../lib/types';
import { useCart } from '../../store/cart';
import { Badge, EmptyState, Field, Loading, Rating, Spinner } from '../../components/ui';
import { CheckIcon, ClockIcon, MinusIcon, PlusIcon, StarIcon, TruckIcon } from '../../components/ui/Icons';

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const settings = useOutletContext<Settings | null>();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const add = useCart((s) => s.add);

  useEffect(() => {
    setLoading(true);
    setError('');
    setQty(1);
    setVariant(undefined);

    getProduct(slug)
      .then((p) => {
        setProduct(p);
        getProductReviews(slug)
          .then((r) => {
            setReviews(r.reviews);
            setSummary(r.summary);
          })
          .catch(() => undefined);
      })
      .catch(() => setError('We could not find that item.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Loading label="Loading…" />;
  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-20">
        <EmptyState
          title="Item not found"
          hint={error || 'It may have been removed from the menu.'}
          action={
            <Link className="btn-primary btn-md" to="/menu">
              Back to menu
            </Link>
          }
        />
      </div>
    );
  }

  const photo = productImage(product);
  const category = typeof product.category === 'string' ? null : product.category;
  const options = product.variants.filter((v) => v.active);
  const selected = options.find((v) => v.name === variant) || options[0];
  const price = selected?.price ?? product.effectivePrice;
  const soldOut = !product.available;

  const addToCart = () => {
    add({
      ref: product._id,
      kind: 'product',
      name: product.name,
      image: photo,
      unitPrice: price,
      qty,
      variantName: options.length ? selected?.name : undefined,
    });
    toast.success(`${product.name} added to cart`);
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error('Please enter your name');
      return;
    }
    setSending(true);
    try {
      const { message } = await submitReview({
        product: product._id,
        customerName: name.trim(),
        rating,
        comment: comment.trim(),
      });
      toast.success(message);
      setShowForm(false);
      setComment('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-sm text-ink-500">
        <Link className="hover:text-brand-600" to="/menu">
          Menu
        </Link>
        {category && (
          <>
            {' / '}
            <Link className="hover:text-brand-600" to={`/menu?category=${category.slug}`}>
              {category.name}
            </Link>
          </>
        )}
        {' / '}
        <span className="text-ink-800">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-ink-100">
          {photo ? (
            <img src={photo} alt={product.name} className="aspect-square w-full object-cover" />
          ) : (
            <div className="grid aspect-square w-full place-items-center bg-gradient-to-br from-brand-200 to-brand-400">
              <span className="font-display text-6xl font-bold text-white/80">{product.name.slice(0, 2)}</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {soldOut && <Badge tone="muted">Sold out</Badge>}
            {product.featured && <Badge>Popular</Badge>}
            {product.isSpicy && <Badge tone="berry">Spicy</Badge>}
            {product.isVegetarian && <Badge tone="success">Vegetarian</Badge>}
          </div>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{product.name}</h1>

          {summary && summary.total > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Rating value={summary.average} />
              <span className="text-sm text-ink-500">
                {summary.average.toFixed(1)} from {summary.total} review{summary.total === 1 ? '' : 's'}
              </span>
            </div>
          )}

          <p className="mt-5 text-base leading-relaxed text-ink-600">{product.description}</p>

          {product.tags && product.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <span key={t} className="rounded-md bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">
                  {t}
                </span>
              ))}
            </div>
          )}

          {options.length > 0 && (
            <div className="mt-7">
              <p className="label">Choose an option</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((v) => (
                  <button
                    key={v.name}
                    disabled={soldOut}
                    onClick={() => setVariant(v.name)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition disabled:opacity-40 ${
                      selected?.name === v.name
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                        : 'border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    <span className="text-sm font-semibold">{v.name}</span>
                    <span className="text-sm font-bold text-brand-600">{money(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <span className="font-display text-3xl font-bold">{money(price)}</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-ink-200">
              <button className="px-3.5 py-3 text-ink-600 hover:text-brand-600" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
                <MinusIcon className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center font-semibold">{qty}</span>
              <button className="px-3.5 py-3 text-ink-600 hover:text-brand-600" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="Increase">
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <button className="btn-primary btn-lg flex-1 sm:flex-none sm:px-12" onClick={addToCart} disabled={soldOut}>
              {soldOut ? 'Sold out' : 'Add to cart'}
            </button>
          </div>

          <ul className="mt-8 space-y-2.5 border-t border-ink-200 pt-6 text-sm text-ink-600">
            <li className="flex items-center gap-2.5">
              <TruckIcon className="h-4 w-4 text-brand-500" /> Home delivery across{' '}
              {settings?.city || 'Lodhran'}
            </li>
            <li className="flex items-center gap-2.5">
              <ClockIcon className="h-4 w-4 text-brand-500" /> Ready in{' '}
              {deliveryWindow(settings?.estimatedDeliveryMinutes)}
            </li>
            <li className="flex items-center gap-2.5">
              <CheckIcon className="h-4 w-4 text-brand-500" /> Free delivery over{' '}
              {money(settings?.freeDeliveryAbove)}
            </li>
            <li className="flex items-center gap-2.5">
              <CheckIcon className="h-4 w-4 text-brand-500" /> Cash, JazzCash or Easypaisa on delivery
            </li>
          </ul>
        </div>
      </div>

      <section className="mt-16 border-t border-ink-200 pt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Reviews</h2>
          <button className="btn-outline btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Write a review'}
          </button>
        </div>

        {summary && summary.total > 0 && (
          <div className="mt-6 grid gap-6 rounded-2xl border border-ink-200 bg-white p-6 sm:grid-cols-2">
            <div className="text-center">
              <p className="font-display text-5xl font-bold">{summary.average.toFixed(1)}</p>
              <div className="mt-2 flex justify-center">
                <Rating value={summary.average} size="lg" />
              </div>
              <p className="mt-1.5 text-sm text-ink-500">
                {summary.total} review{summary.total === 1 ? '' : 's'}
              </p>
            </div>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = summary.buckets[String(star)] || 0;
                const pct = summary.total ? (n / summary.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="flex w-10 items-center gap-1 text-ink-600">
                      {star} <StarIcon className="h-3 w-3 text-brand-500" filled />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-ink-500">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showForm && (
          <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Khan" />
              </Field>
              <Field label="Rating">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                      <StarIcon className={`h-7 w-7 ${n <= rating ? 'text-brand-500' : 'text-ink-300'}`} filled={n <= rating} />
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Your review" hint="Optional — tell others what you thought.">
                <textarea className="input min-h-24 resize-y" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="The fries were excellent…" />
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button className="btn-primary btn-md" onClick={submit} disabled={sending}>
                {sending ? <Spinner className="h-4 w-4" /> : 'Submit review'}
              </button>
              <span className="text-xs text-ink-500">Reviews are checked before they appear.</span>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {reviews.length === 0 ? (
            <EmptyState title="No reviews yet" hint="Be the first to tell others how it tastes." />
          ) : (
            reviews.map((r) => (
              <div key={r._id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.customerName}</p>
                    <Rating value={r.rating} />
                  </div>
                  <span className="text-xs text-ink-400">{formatDate(r.createdAt)}</span>
                </div>
                {r.comment && <p className="mt-3 text-sm leading-relaxed text-ink-600">{r.comment}</p>}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
