import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { deleteReview, getAdminReviews, setReviewApproved } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';
import type { Review } from '../../lib/types';
import { Badge, EmptyState, ErrorNote, Loading, Rating } from '../../components/ui';
import { CheckIcon, CloseIcon, StarReviewIcon } from '../../components/ui/Icons';

const FILTERS: { key: string; label: string; approved?: boolean }[] = [
  { key: 'pending', label: 'Waiting', approved: false },
  { key: 'approved', label: 'Published', approved: true },
  { key: 'all', label: 'All' },
];

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        setReviews(await getAdminReviews(FILTERS.find((f) => f.key === filter)?.approved));
        setError('');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, approved: boolean) => {
    try {
      await setReviewApproved(id, approved);
      toast.success(approved ? 'Review published' : 'Review removed from the site');
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    try {
      await deleteReview(id);
      toast.success('Review deleted');
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const waiting = reviews.filter((r) => !r.approved).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Reviews</h1>
        <p className="mt-1 text-sm text-ink-500">Approve what customers say before it goes live.</p>
      </header>

      <div className="rail">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition sm:py-2 ${
              filter === f.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-100'
            }`}
          >
            {f.label}
            {f.key === 'pending' && waiting > 0 && filter === 'pending' && ` (${waiting})`}
          </button>
        ))}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <Loading />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<StarReviewIcon className="h-6 w-6" />}
          title="Nothing here"
          hint={
            filter === 'pending'
              ? 'No reviews are waiting for approval right now.'
              : 'No reviews match this filter.'
          }
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const subject = r.product ?? r.deal;
            const subjectName = typeof subject === 'string' ? 'Removed item' : subject?.name || 'Removed item';
            return (
              <div key={r._id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.customerName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Rating value={r.rating} />
                      <span className="text-xs text-ink-400">
                        on {subjectName} · {formatDate(r.createdAt)}
                      </span>
                    </div>
                  </div>
                  {r.approved ? <Badge tone="success">Published</Badge> : <Badge tone="warn">Waiting</Badge>}
                </div>

                {r.comment ? (
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{r.comment}</p>
                ) : (
                  <p className="mt-3 text-sm italic text-ink-400">No comment, just a star rating.</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!r.approved && (
                    <button className="btn-primary btn-sm" onClick={() => decide(r._id, true)}>
                      <CheckIcon className="h-4 w-4" /> Publish
                    </button>
                  )}
                  {r.approved && (
                    <button className="btn-outline btn-sm" onClick={() => decide(r._id, false)}>
                      <CloseIcon className="h-4 w-4" /> Unpublish
                    </button>
                  )}
                  <button className="btn-ghost btn-sm text-berry-600" onClick={() => remove(r._id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
