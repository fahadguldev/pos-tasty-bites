import { useNavigate } from 'react-router-dom';
import { money } from '../../lib/api';
import { cartSubtotal, cartCount, useCart } from '../../store/cart';
import { WhatsAppIcon } from '../ui/Icons';

interface Props {
  /** `hero` is the big landing-page button, `bar` the compact sticky one. */
  variant?: 'hero' | 'bar' | 'dark' | 'header';
  className?: string;
  label?: string;
}

/**
 * The one button the whole landing page is built around.
 *
 * It sends a customer with a full cart straight into the WhatsApp order flow —
 * which writes the order to the database and then hands them a pre-written
 * wa.me message — and sends an empty cart to the menu instead, because sending
 * someone to an order form with nothing in it is how you lose them.
 */
export function WhatsAppOrderCta({ variant = 'hero', className = '', label }: Props) {
  const navigate = useNavigate();
  const count = useCart((s) => cartCount(s.lines));
  const subtotal = useCart((s) => cartSubtotal(s.lines));
  const hasItems = count > 0;

  const go = () => navigate(hasItems ? '/order/whatsapp' : '/menu');

  if (variant === 'header') {
    return (
      <button onClick={go} className={`btn-wa btn-sm shrink-0 ${className}`}>
        <WhatsAppIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Order on WhatsApp</span>
        <span className="sm:hidden">Order</span>
      </button>
    );
  }

  if (variant === 'bar') {
    return (
      <button onClick={go} className={`btn-wa btn-md flex-1 ${className}`}>
        <WhatsAppIcon className="h-4 w-4" />
        {hasItems ? `Order ${count} item${count > 1 ? 's' : ''} · ${money(subtotal)}` : 'Order on WhatsApp'}
      </button>
    );
  }

  if (variant === 'dark') {
    return (
      <button onClick={go} className={`btn-wa btn-lg w-full sm:w-auto ${className}`}>
        <WhatsAppIcon className="h-5 w-5" />
        {label || (hasItems ? `Send my order · ${money(subtotal)}` : 'Order on WhatsApp')}
      </button>
    );
  }

  return (
    <button onClick={go} className={`btn-wa btn-lg w-full sm:w-auto ${className}`}>
      <WhatsAppIcon className="h-5 w-5" />
      {label || (hasItems ? `Send my order · ${money(subtotal)}` : 'Order on WhatsApp')}
    </button>
  );
}
