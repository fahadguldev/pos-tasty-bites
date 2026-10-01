import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import StoreLayout from './pages/store/StoreLayout';
import AdminLayout from './pages/admin/AdminLayout';
import { Loading } from './components/ui';

const Home = lazy(() => import('./pages/store/Home'));
const Menu = lazy(() => import('./pages/store/Menu'));
const Deals = lazy(() => import('./pages/store/Deals'));
const ProductDetail = lazy(() => import('./pages/store/ProductDetail'));
const Checkout = lazy(() => import('./pages/store/Checkout'));
const Track = lazy(() => import('./pages/store/Track'));
const WhatsAppOrder = lazy(() => import('./pages/store/WhatsAppOrder'));
const About = lazy(() => import('./pages/store/About'));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminDeals = lazy(() => import('./pages/admin/AdminDeals'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminContacts = lazy(() => import('./pages/admin/AdminContacts'));
const AdminExpenses = lazy(() => import('./pages/admin/AdminExpenses'));
const AdminCampaigns = lazy(() => import('./pages/admin/AdminCampaigns'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="mt-3 text-ink-500">We could not find that page.</p>
      <Link to="/" className="btn-primary btn-md mt-6">
        Back to the menu
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="menu" element={<Menu />} />
            <Route path="deals" element={<Deals />} />
            <Route path="product/:slug" element={<ProductDetail />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/whatsapp" element={<WhatsAppOrder />} />
            <Route path="track" element={<Track />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="admin/login" element={<AdminLogin />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="deals" element={<AdminDeals />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="contacts" element={<AdminContacts />} />
            <Route path="expenses" element={<AdminExpenses />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </Suspense>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          style: { borderRadius: 12, fontSize: 14, fontWeight: 500 },
        }}
      />
    </BrowserRouter>
  );
}
