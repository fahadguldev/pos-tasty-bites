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

// ---------- whatsapp campaigns ----------

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

export type OptionAction = 'send_deal' | 'snooze' | 'stop';

export interface CampaignOption {
  id: string;
  label: string;
  action: OptionAction;
  snoozeDays: number;
}

export interface CampaignStats {
  recipients: number;
  openersSent: number;
  qualified: number;
  dealsSent: number;
  snoozed: number;
  optedOut: number;
  failed: number;
}

export interface Campaign {
  _id: string;
  name: string;
  deal: string | null;
  openerTemplate: string;
  dealTemplate: string;
  options: CampaignOption[];
  sendImage: boolean;
  recipientLimit: number;
  gap: { minSeconds: number; maxSeconds: number };
  status: CampaignStatus;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  cancelReason: string;
  stats: CampaignStats;
  replyRate: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Audience {
  total: number;
  contactable: number;
  willSend: number;
  recipientLimit: number;
  skipped?: number;
  reason?: string;
}

export interface CampaignPreview {
  audience: Audience;
  openerProblems: string[];
  dealProblems: string[];
  openerVariations: number;
  dealVariations: number;
  openerSamples: { phone: string; name: string; text: string }[];
  dealSamples: { phone: string; name: string; text: string }[];
  deal: { name: string; price: number; image: string } | null;
}

export interface CampaignDetail extends Campaign {
  audience: Audience;
  pending: number;
}

export interface StartResult {
  queued: number;
  duplicates: number;
  reason: string;
  campaign: Campaign;
}

export interface MessageEntry {
  _id: string;
  phone: string;
  direction: 'in' | 'out';
  stage: 'opener' | 'deal' | 'system';
  kind: string;
  body: string;
  imageUrl: string;
  error: string;
  createdAt: string;
}

export interface MessagePage {
  entries: MessageEntry[];
  total: number;
  page: number;
  pages: number;
}

// ---------- contacts ----------

export interface Contact {
  _id: string;
  name: string;
  phone: string;
  area: string;
  notes: string;
  source: 'order' | 'import' | 'manual';
  consentSource: string;
  consentedAt: string | null;
  optOut: boolean;
  optedOutAt: string | null;
  doNotContactUntil: string | null;
  qualifiedAt: string | null;
  tags: string[];
  orderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  totalSpent: number;
  lastKnownAddress: string;
  lastKnownArea: string;
  isContactable: boolean;
  createdAt: string;
}

export interface ContactList {
  contacts: Contact[];
  total: number;
  page: number;
  pages: number;
  summary: { total: number; contactable: number; optedOut: number; snoozed: number };
}

export interface BackfillPreview {
  scannedOrders: number;
  existingContacts: number;
  toCreate: { phone: string; name: string; orderCount: number }[];
  toUpdate: string[];
  skipped: { phone: string; name: string; reason: string }[];
}

export interface BackfillResult {
  created: number;
  updated: number;
  skipped: { phone: string; name: string; reason: string }[];
}

// ---------- whatsapp connection ----------

export type WhatsappStatus = 'offline' | 'starting' | 'awaiting_scan' | 'scanning' | 'ready' | 'error' | 'stopped';

export interface WhatsappConnection {
  status: WhatsappStatus;
  ready: boolean;
  qr: string;
  qrExpired: boolean;
  qrIssuedAt: string | null;
  number: string;
  lastError: string;
  sessionId: string;
  sendEnabled: boolean;
  transport: string;
  startCommand: string;
  heartbeatAt: string | null;
  lastTest: { phone: string; ok: boolean; error: string; at: string | null };
}
