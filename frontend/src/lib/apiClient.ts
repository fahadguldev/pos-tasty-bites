import { http, unwrap } from './api';
import type {
  AdminUser,
  AnalyticsOverview,
  Category,
  DailyPoint,
  Deal,
  Insights,
  MonthlyResult,
  Order,
  OrderList,
  OrderResult,
  PaymentMethod,
  Product,
  Quote,
  RankedItem,
  Review,
  ReviewBundle,
  Settings,
  TopDeals,
  TrackResult,
  UploadResult,
} from './types';

// ---------- public storefront ----------

export const getSettings = () => unwrap<Settings>(http.get('/settings'));

export const getCategories = (includeInactive = false) =>
  unwrap<Category[]>(http.get('/categories', { params: includeInactive ? { includeInactive: 'true' } : {} }));

/** ratings only come back when withRating is asked for, so the menu always asks */
export const getProducts = (
  params: {
    category?: string;
    search?: string;
    featured?: string;
    includeUnavailable?: string;
    withRating?: string;
  } = {},
) =>
  unwrap<Product[]>(http.get('/products', { params: { ...params, withRating: 'true' } }));

export const getProduct = (slug: string) => unwrap<Product>(http.get(`/products/${slug}`));
export const getDeals = () => unwrap<Deal[]>(http.get('/deals'));
export const getDeal = (slug: string) => unwrap<Deal>(http.get(`/deals/${slug}`));
export const getProductReviews = (slug: string) =>
  unwrap<ReviewBundle>(http.get(`/products/${slug}/reviews`));

export const getQuote = (items: unknown) =>
  unwrap<Quote>(http.post('/orders/quote', { items }));

export const createOrder = (body: {
  items: unknown[];
  customer: unknown;
  paymentMethod: PaymentMethod;
}) => unwrap<OrderResult>(http.post('/orders', { ...body, source: 'website' }));

export const createWhatsappOrder = (body: {
  items: unknown[];
  customer: unknown;
  paymentMethod: PaymentMethod;
}) => unwrap<OrderResult>(http.post('/orders/whatsapp-link', body));

export const trackOrder = (orderNo: string, phone: string) =>
  unwrap<TrackResult>(http.get('/orders/track', { params: { orderNo, phone } }));

export const submitReview = (body: {
  product?: string;
  deal?: string;
  customerName: string;
  rating: number;
  comment?: string;
}) => unwrap<{ review: Review; message: string }>(http.post('/reviews', body));

// ---------- auth ----------

export const login = (email: string, password: string) =>
  unwrap<{ token: string; admin: AdminUser }>(http.post('/auth/login', { email, password }));

export const me = () => unwrap<AdminUser>(http.get('/auth/me'));

export const changePassword = (currentPassword: string, newPassword: string) =>
  unwrap<{ ok?: boolean }>(http.post('/auth/change-password', { currentPassword, newPassword }));

// ---------- admin: catalogue ----------

export const getAdminProducts = () => unwrap<Product[]>(http.get('/admin/products'));
export const createProduct = (body: unknown) => unwrap<Product>(http.post('/admin/products', body));
export const updateProduct = (id: string, body: unknown) =>
  unwrap<Product>(http.put(`/admin/products/${id}`, body));
export const deleteProduct = (id: string) => http.delete(`/admin/products/${id}`);

/** the server flips the flag itself, so send no body and trust what comes back */
export const toggleProductAvailability = (id: string) =>
  unwrap<{ id: string; available: boolean }>(http.patch(`/admin/products/${id}/availability`));

export const createCategory = (body: unknown) => unwrap<Category>(http.post('/admin/categories', body));
export const updateCategory = (id: string, body: unknown) =>
  unwrap<Category>(http.put(`/admin/categories/${id}`, body));
export const deleteCategory = (id: string) => http.delete(`/admin/categories/${id}`);

/** includeAll=true so the admin sees scheduled and finished bundles too */
export const getAdminDeals = () => unwrap<Deal[]>(http.get('/admin/deals', { params: { includeAll: 'true' } }));
export const createDeal = (body: unknown) => unwrap<Deal>(http.post('/admin/deals', body));
export const updateDeal = (id: string, body: unknown) => unwrap<Deal>(http.put(`/admin/deals/${id}`, body));
export const deleteDeal = (id: string) => http.delete(`/admin/deals/${id}`);

// ---------- admin: orders ----------

export const getAdminOrders = (params: Record<string, string | number | undefined>) =>
  unwrap<OrderList>(http.get('/admin/orders', { params }));
export const getAdminOrder = (id: string) => unwrap<Order>(http.get(`/admin/orders/${id}`));

/** status and paymentStatus both ride on the same endpoint */
export const updateOrder = (
  id: string,
  body: { status?: string; paymentStatus?: string; cancelledReason?: string },
) => unwrap<Order>(http.patch(`/admin/orders/${id}/status`, body));

export const resendWhatsapp = (id: string) =>
  unwrap<{ sent: boolean; channel: string; link?: string; note: string }>(
    http.post(`/admin/orders/${id}/whatsapp`),
  );

// ---------- admin: reviews ----------

export const getAdminReviews = (approved?: boolean) =>
  unwrap<Review[]>(
    http.get('/admin/reviews', {
      params: approved === undefined ? {} : { approved: String(approved) },
    }),
  );

export const setReviewApproved = (id: string, approved: boolean) =>
  unwrap<Review>(http.patch(`/admin/reviews/${id}/approve`, { approved }));
export const deleteReview = (id: string) => http.delete(`/admin/reviews/${id}`);

// ---------- admin: analytics ----------

export const getOverview = (days = 30) =>
  unwrap<AnalyticsOverview>(http.get('/admin/analytics/overview', { params: { days } }));
export const getDaily = (days = 30) =>
  unwrap<DailyPoint[]>(http.get('/admin/analytics/daily', { params: { days } }));
export const getMonthly = (months = 6) =>
  unwrap<MonthlyResult>(http.get('/admin/analytics/monthly', { params: { months } }));
export const getTopProducts = (days = 30, limit = 10) =>
  unwrap<RankedItem[]>(http.get('/admin/analytics/top-products', { params: { days, limit } }));
export const getTopDeals = (days = 30, limit = 10) =>
  unwrap<TopDeals>(http.get('/admin/analytics/top-deals', { params: { days, limit } }));
export const getInsights = (days = 30) =>
  unwrap<Insights>(http.get('/admin/analytics/insights', { params: { days } }));

// ---------- admin: settings & upload ----------

export const getAdminSettings = () => unwrap<Settings>(http.get('/admin/settings'));
export const saveAdminSettings = (body: unknown) =>
  unwrap<Settings>(http.put('/admin/settings', body));

export const uploadImage = (file: File) => {
  const form = new FormData();
  form.append('image', file);
  return unwrap<UploadResult>(
    http.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  );
};

export const getUploadStatus = () => unwrap<{ cloudinary: boolean }>(http.get('/upload/status'));
