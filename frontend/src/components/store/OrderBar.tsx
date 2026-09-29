import { Link, useLocation } from 'react-router-dom';
import { money } from '../../lib/api';
import type { Settings } from '../../lib/types';
import { cartCount, cartSubtotal, useCart } from '../../store/cart';
import { CartIcon } from '../ui/Icons';
import { WhatsAppOrderCta } from './WhatsAppOrderCta';

/**
 * A persistent order bar for phones. The landing page's whole job is to get
 * someone to start an order, so the primary action stays on screen the whole
 * way down instead of scrolling away after the hero.
 *
 * Hidden once the customer is inside the checkout or WhatsApp flow — those
 * screens have their own, more specific actions and two CTAs would compete.
 */
export function OrderBar({ settings }: { settings: Settings | null }) {
  const { pathname } = useLocation();
  const count = useCart((s) => cartCount(s.lines));
  const subtotal = useCart((s) => cartSubtotal(s.lines));
  const setOpen = useCart((s) => s.setOpen);

  const suppressed = ['/checkout', '/order/whatsapp', '/track'].some((p) => pathname.startsWith(p));
  if (suppressed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 px-3 py-2.5 shadow-[0_-4px_16px_-8px_rgb(28_25_23_/_0.25)] backdrop-blur sm:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)' }}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="btn-outline btn-md relative shrink-0 !px-3"
          aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}
        >
          <CartIcon className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-berry-600 px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </button>

        <WhatsAppOrderCta variant="bar" />

        <Link to="/menu" className="btn-ghost btn-md shrink-0 !px-3" aria-label="Browse the menu">
          Menu
        </Link>
      </div>

      {count > 0 && (
        <p className="mt-1.5 text-center text-[11px] text-ink-500">
          {money(subtotal)} in your cart
          {!!settings?.freeDeliveryAbove && ` · free delivery over ${money(settings.freeDeliveryAbove)}`}
        </p>
      )}
    </div>
  );
}
