import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { cartCount, useCart } from '../../store/cart';
import { deliveryWindow } from '../../lib/api';
import type { Settings } from '../../lib/types';
import { CartIcon, CloseIcon, MenuIcon, PhoneIcon } from '../ui/Icons';
import { WhatsAppOrderCta } from './WhatsAppOrderCta';
import { waLink } from './storeSettings';

const links = [
  { to: '/menu', label: 'Menu' },
  { to: '/deals', label: 'Deals' },
  { to: '/track', label: 'Track order' },
  { to: '/about', label: 'About' },
];

export function StoreHeader({ settings }: { settings: Settings | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { lines, setOpen } = useCart();
  const count = cartCount(lines);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      {!settings?.acceptingOrders && settings?.closedNotice && (
        <div className="bg-berry-600 px-4 py-2 text-center text-xs font-semibold text-white">
          {settings.closedNotice}
        </div>
      )}

      <div className="bg-ink-900 py-2 text-center text-xs text-ink-100">
        <span className="hidden sm:inline">{deliveryWindow(settings?.estimatedDeliveryMinutes)} delivery · </span>
        Free delivery over Rs {settings?.freeDeliveryAbove || 0} · Min order Rs {settings?.minOrderValue || 0}
      </div>

      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white">
              TB
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-bold">{settings?.shopName || 'Tasty Bites'}</span>
              <span className="block text-[11px] uppercase tracking-wide text-ink-500">
                {settings?.city || 'Lodhran'}
              </span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-2">
            {settings?.whatsappNumber && <WhatsAppOrderCta variant="header" />}
            <button className="btn-primary btn-sm relative" onClick={() => setOpen(true)} aria-label="Open cart">
              <CartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-berry-500 px-1 text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </button>
            <button className="btn-ghost btn-sm md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-ink-200 bg-white px-4 py-2 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                {l.label}
              </NavLink>
            ))}
            {settings?.whatsappNumber && (
              <a href={waLink(settings)} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-700">
                Order on WhatsApp
              </a>
            )}
          </nav>
        )}
      </header>
    </>
  );
}

export function StoreFooter({ settings }: { settings: Settings | null }) {
  const social = settings?.social;

  return (
    <footer className="mt-20 border-t border-ink-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:grid-cols-2 sm:py-14 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white">
              TB
            </span>
            <span className="font-display text-lg font-bold">{settings?.shopName || 'Tasty Bites'}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            {settings?.tagline || 'Burgers, deals and fast delivery.'}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            {links.map((l) => (
              <li key={l.to}>
                <Link className="hover:text-brand-600" to={l.to}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            {settings?.phone && (
              <li className="flex items-center gap-2">
                <PhoneIcon className="h-4 w-4 text-ink-400" />
                <a className="hover:text-brand-600" href={`tel:${settings.phone}`}>
                  {settings.phone}
                </a>
              </li>
            )}
            {settings?.address && <li>{settings.address}</li>}
            <li>{deliveryWindow(settings?.estimatedDeliveryMinutes)} in {settings?.city || 'Lodhran'}</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Follow</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            {social?.facebook && (
              <li>
                <a className="hover:text-brand-600" href={social.facebook} target="_blank" rel="noreferrer">
                  Facebook
                </a>
              </li>
            )}
            {social?.tiktok && (
              <li>
                <a className="hover:text-brand-600" href={social.tiktok} target="_blank" rel="noreferrer">
                  TikTok
                </a>
              </li>
            )}
            {social?.instagram && (
              <li>
                <a className="hover:text-brand-600" href={social.instagram} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              </li>
            )}
            {!social?.facebook && !social?.tiktok && !social?.instagram && <li className="text-ink-400">Links coming soon</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-100 py-5 text-center text-xs text-ink-400">
        © {new Date().getFullYear()} {settings?.shopName || 'Tasty Bites'}. All rights reserved.
      </div>
    </footer>
  );
}
