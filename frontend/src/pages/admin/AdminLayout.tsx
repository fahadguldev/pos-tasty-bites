import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAdmin } from '../../store/admin';
import { Loading } from '../../components/ui';
import {
  BoxIcon,
  ChartIcon,
  ClipboardIcon,
  GearIcon,
  LogoutIcon,
  PhoneIcon,
  RupeeIcon,
  SendIcon,
  StarReviewIcon,
  TagIcon,
} from '../../components/ui/Icons';

const nav = [
  { to: '/admin', label: 'Dashboard', icon: ChartIcon, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardIcon },
  { to: '/admin/products', label: 'Products', icon: BoxIcon },
  { to: '/admin/deals', label: 'Deals', icon: TagIcon },
  { to: '/admin/reviews', label: 'Reviews', icon: StarReviewIcon },
  { to: '/admin/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/admin/expenses', label: 'Expenses', icon: RupeeIcon },
  { to: '/admin/contacts', label: 'Customers', icon: PhoneIcon },
  { to: '/admin/campaigns', label: 'Campaigns', icon: SendIcon },
  { to: '/admin/settings', label: 'Settings', icon: GearIcon },
];

export default function AdminLayout() {
  const { user, ready, restore, logout } = useAdmin();
  const { pathname } = useLocation();

  useEffect(() => {
    restore();
  }, [restore]);

  if (!ready) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/admin/login" state={{ from: pathname }} replace />;

  return (
    <div className="flex min-h-screen bg-ink-100">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 font-display text-sm font-bold text-white">
            TB
          </span>
          <span>
            <span className="block text-sm font-bold">Tasty Bites</span>
            <span className="block text-[11px] text-ink-500">Admin panel</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'
                }`
              }
            >
              <n.icon className="h-4.5 w-4.5" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-200 p-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          <button className="btn-ghost btn-sm w-full justify-start" onClick={logout}>
            <LogoutIcon className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-display text-sm font-bold">Tasty Bites admin</span>
            <button className="btn-ghost btn-sm" onClick={logout}>
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
          <nav className="rail px-4 pb-2">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
