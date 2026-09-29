import { useEffect, useState } from 'react';
import { getDeals } from '../../lib/apiClient';
import type { Deal } from '../../lib/types';
import { DealCard } from '../../components/store/DealCard';
import { EmptyState, Loading } from '../../components/ui';
import { SparkIcon } from '../../components/ui/Icons';

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDeals()
      .then(setDeals)
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-12 sm:px-12">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
            <SparkIcon className="h-4 w-4" /> Live offers
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Deals & bundles</h1>
          <p className="mt-2 max-w-xl text-white/80">
            Order a bundle and pay less than the sum of its parts. Prices update automatically when a deal ends.
          </p>
        </div>
      </header>

      <div className="mt-10">
        {loading ? (
          <Loading label="Loading deals…" />
        ) : deals.length === 0 ? (
          <EmptyState
            icon={<SparkIcon className="h-6 w-6" />}
            title="No live deals right now"
            hint="Check back soon — we add new bundles every week."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d, i) => (
              <div key={d._id} id={d.slug}>
                <DealCard deal={d} index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
