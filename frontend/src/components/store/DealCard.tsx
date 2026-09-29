import { Link } from 'react-router-dom';
import { money } from '../../lib/api';
import { dealImage } from '../../lib/productImage';
import type { Deal } from '../../lib/types';
import { useCart } from '../../store/cart';
import { Badge } from '../ui';
import { PlusIcon } from '../ui/Icons';

const TINTS = [
  'from-brand-200 to-brand-400',
  'from-rose-200 to-berry-400',
  'from-amber-200 to-orange-400',
  'from-violet-200 to-purple-400',
];

export function DealCard({ deal, index = 0 }: { deal: Deal; index?: number }) {
  const add = useCart((s) => s.add);
  const photo = dealImage(deal);

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link to={`/deals#${deal.slug}`} className="relative block aspect-16/10 overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={deal.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`grid h-full w-full place-items-center bg-gradient-to-br ${TINTS[index % TINTS.length]}`}>
            <span className="font-display text-2xl font-bold text-white/85">{deal.name}</span>
          </div>
        )}

        {deal.discountPercent ? (
          <span className="absolute left-3 top-3 rounded-lg bg-berry-500 px-2.5 py-1 text-xs font-bold text-white">
            {deal.discountPercent}% OFF
          </span>
        ) : null}

        {deal.endsAt && (
          <span className="absolute bottom-3 left-3 rounded-lg bg-ink-900/85 px-2.5 py-1 text-[11px] font-semibold text-white">
            Ends {new Date(deal.endsAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold leading-snug">{deal.name}</h3>
          {deal.badge && <Badge tone="berry">{deal.badge}</Badge>}
        </div>

        <p className="mt-1.5 line-clamp-2 text-sm text-ink-500">{deal.description}</p>

        <ul className="mt-3 space-y-1 text-xs text-ink-500">
          {deal.items.slice(0, 3).map((i, idx) => (
            <li key={idx} className="flex gap-1.5">
              <span className="text-brand-500">•</span>
              <span>
                {i.qty}× {i.name}
              </span>
            </li>
          ))}
          {deal.items.length > 3 && <li className="text-ink-400">+{deal.items.length - 3} more</li>}
        </ul>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <div>
            <span className="font-display text-lg font-bold">{money(deal.price)}</span>
            {deal.compareAtPrice > deal.price && (
              <span className="ml-2 text-sm text-ink-400 line-through">{money(deal.compareAtPrice)}</span>
            )}
          </div>
          <button
            className="btn-dark btn-sm"
            onClick={() =>
              add({
                ref: deal._id,
                kind: 'deal',
                name: deal.name,
                image: photo,
                unitPrice: deal.price,
                qty: 1,
              })
            }
          >
            <PlusIcon className="h-4 w-4" /> Add bundle
          </button>
        </div>
      </div>
    </article>
  );
}
