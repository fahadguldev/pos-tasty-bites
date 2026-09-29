// Mirrors the API exactly. Field names here are the contract with the backend —
// if you change one, change it in the same place on the server.

export interface Variant {
  name: string;
  price: number;
  active: boolean;
}

export interface ProductImage {
  url: string;
  publicId?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface RatingSummary {
  average: number;
  total: number;
  /** count per star, keyed "1".."5" */
  buckets: Record<string, number>;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  images: ProductImage[];
  category: Category | string;
  price: number;
  variants: Variant[];
  cost: number;
  tags: string[];
  isSpicy: boolean;
  isVegetarian: boolean;
  available: boolean;
  featured: boolean;
  sortOrder: number;
  /** virtual: cheapest active variant, else price */
  effectivePrice: number;
  /** only present when the request asked for withRating=true */
  rating?: { average: number; total: number };
  createdAt: string;
  updatedAt: string;
}

/**
 * A populated product, as returned inside a deal. The server selects
 * only name/images/slug, so the other Product fields are not there.
 */
export interface DealProductRef {
  _id: string;
  name: string;
  slug: string;
  images: ProductImage[];
}

/** deal bundle lines are built server-side, so they carry no variant */
export interface DealItem {
  /** id when sent by the editor, populated object on reads */
  product: DealProductRef | string;
  name: string;
  qty: number;
  unitPrice: number;
  cost: number;
}

/** what the deal editor posts: just the ids */
export interface DealItemInput {
  product: string;
  qty: number;
  unitPrice?: number;
}

export interface Deal {
  _id: string;
  name: string;
  slug: string;
  description: string;
  items: DealItem[];
  price: number;
  compareAtPrice: number;
  image?: string;
  imagePublicId?: string;
  badge?: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  featured: boolean;
  sortOrder: number;
  /** virtuals */
  savings: number;
  discountPercent: number;
  isLive: boolean;
}

/** a cart line uses `kind` because that is the name the pricing API expects */
export interface CartLine {
  key: string;
  ref: string;
  kind: 'product' | 'deal';
  name: string;
  image?: string;
  unitPrice: number;
  qty: number;
  variantName?: string;
}

/** the shape the pricing endpoints send back for a cart */
export interface PricedItem {
  kind: 'product' | 'deal';
  ref: string;
  name: string;
  qty: number;
  unitPrice: number;
  cost: number;
  lineTotal: number;
  variantName?: string;
}

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'jazzcash' | 'easypaisa' | 'bank' | 'card' | 'other';
export type PaymentStatus = 'pending' | 'received' | 'refunded';
export type OrderSource = 'website' | 'whatsapp' | 'pos';

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
  area?: string;
  landmark?: string;
  notes?: string;
}

export interface OrderItem extends PricedItem {
  variantName?: string;
}

export interface Order {
  _id: string;
  orderNo: string;
  items: OrderItem[];
  customer: OrderCustomer;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  source: OrderSource;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  cost: number;
  /** virtual: total - deliveryFee - cost */
  profit: number;
  whatsappNotified: boolean;
  whatsappError?: string;
  cancelledReason?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /orders/track returns a deliberately small, customer-safe projection */
export interface TrackResult {
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  total: number;
  placedAt: string;
  deliveredAt?: string;
  items: OrderItem[];
  shopName: string;
  phone: string;
}

/** POST /orders and POST /orders/whatsapp-link both wrap the order */
export interface OrderResult {
  order: Order;
  whatsapp: {
    sent: boolean;
    channel: string;
    link?: string;
    message?: string;
    note: string;
  };
}

export interface OrderList {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
}

export interface Review {
  _id: string;
  product?: { _id: string; name: string; slug: string } | string;
  deal?: { _id: string; name: string; slug: string } | string;
  customerName: string;
  rating: number;
  comment?: string;
  approved: boolean;
  createdAt: string;
}

export interface ReviewBundle {
  reviews: Review[];
  summary: RatingSummary;
}

export interface PaymentAccount {
  code: PaymentMethod;
  label: string;
  accountTitle?: string;
  accountNumber?: string;
  instructions?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface Settings {
  shopName: string;
  tagline: string;
  logo?: string;
  coverImage?: string;
  about?: string;
  address: string;
  city: string;
  phone: string;
  whatsappNumber: string;
  deliveryFee: number;
  freeDeliveryAbove: number;
  minOrderValue: number;
  estimatedDeliveryMinutes: number;
  acceptingOrders: boolean;
  closedNotice: string;
  paymentMethods: PaymentAccount[];
  social: { facebook?: string; instagram?: string; tiktok?: string };
}

export interface Quote {
  items: PricedItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  minOrderValue: number;
  freeDeliveryAbove: number;
}

export interface AnalyticsOverview {
  range: { from: string; to: string; days: number };
  totals: {
    revenue: number;
    foodRevenue: number;
    deliveryCollected: number;
    cost: number;
    profit: number;
    orders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    avgOrderValue: number;
    itemsSold: number;
    avgDeliveryRating: number | null;
  };
  today: { orders: number; revenue: number };
  trend: { previousRevenue: number; changePercent: number | null };
  byStatus: Partial<Record<OrderStatus, number>>;
  byPayment: { _id: PaymentMethod; orders: number; amount: number; pending: number }[];
  newOrdersCount: number;
}

export interface DailyPoint {
  date: string;
  revenue: number;
  profit: number;
  orders: number;
  items: number;
}

export interface MonthlyPoint {
  month: string;
  label: string;
  year: number;
  revenue: number;
  profit: number;
  cost: number;
  orders: number;
  items: number;
}

export interface MonthlyResult {
  series: MonthlyPoint[];
  currentMonth: MonthlyPoint | null;
  previousMonth: MonthlyPoint | null;
  changePercent: number | null;
}

export interface RankedItem {
  _id: string;
  name: string;
  qtySold: number;
  revenue: number;
  cost: number;
  orderCount: number;
  profit: number;
  avgPerOrder: number;
}

export interface RankedDeal extends RankedItem {
  image: string;
  price: number;
  discountPercent: number;
  isLive: boolean;
}

export interface TopDeals {
  top: RankedDeal[];
  neverSold: RankedDeal[];
}

export interface InsightNote {
  tone: 'good' | 'ok' | 'watch' | 'bad';
  title: string;
  detail: string;
}

export interface Insights {
  range: { from: string; to: string; days: number };
  metrics: {
    revenue: number;
    profit: number;
    margin: number;
    orders: number;
    cancellationRate: number;
    peakHour: number;
    peakDay: string;
    uniqueCustomers: number;
    repeatCustomers: number;
  };
  notes: InsightNote[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface UploadResult {
  url: string;
  publicId: string;
}
