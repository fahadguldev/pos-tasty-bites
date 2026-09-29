import { getSettings } from '../models/Setting.js';
import { roundMoney } from '../utils/format.js';

const CLOUD_API_VERSION = 'v20.0';

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function buildOrderMessage(order, settings) {
  const shop = settings?.shopName || 'Tasty Bites';
  const lines = [];

  lines.push(`*NEW ORDER — ${order.orderNo}*`);
  lines.push('');

  order.items.forEach((item, index) => {
    const variant = item.variantName ? ` (${item.variantName})` : '';
    lines.push(`${index + 1}. ${item.name}${variant} x${item.qty} — Rs ${item.lineTotal}`);
  });

  lines.push('');
  lines.push(`Subtotal: Rs ${order.subtotal}`);
  if (order.deliveryFee > 0) lines.push(`Delivery: Rs ${order.deliveryFee}`);
  lines.push(`*Total: Rs ${order.total}*`);
  lines.push('');

  const methodLabel =
    order.paymentMethod === 'cod'
      ? 'Cash on delivery'
      : order.paymentMethod.toUpperCase();
  lines.push(`Payment: ${methodLabel}`);

  if (order.paymentMethod !== 'cod') {
    lines.push(`Status: ${order.paymentStatus}`);
  }

  lines.push('');
  lines.push('*Delivery details*');
  lines.push(`Name: ${order.customer.name}`);
  lines.push(`Phone: ${order.customer.phone}`);
  lines.push(`Address: ${order.customer.address}`);
  if (order.customer.area) lines.push(`Area: ${order.customer.area}`);
  if (order.customer.landmark) lines.push(`Landmark: ${order.customer.landmark}`);
  if (order.customer.notes) lines.push(`Notes: ${order.customer.notes}`);

  lines.push('');
  lines.push(`— sent from ${shop}`);

  return lines.join('\n');
}

export function buildWaLink(number, message) {
  const digits = String(number || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

async function sendViaCloudApi(to, message) {
  const url = `https://graph.facebook.com/${CLOUD_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.error?.message || `WhatsApp API returned ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

/**
 * Pushes a new order to the cafe's WhatsApp.
 * Falls back to a wa.me deep link when the Cloud API credentials are not set,
 * so the feature still works — the admin just taps the link on the orders page.
 */
export async function notifyNewOrder(order) {
  const settings = await getSettings();
  const message = buildOrderMessage(order, settings);
  const target = settings.whatsappNumber;

  const result = {
    channel: 'wa_link',
    sent: false,
    link: buildWaLink(target, message),
    message,
    error: '',
  };

  if (!whatsappConfigured()) {
    result.error = 'Cloud API not configured — use the WhatsApp link to send this order';
    return result;
  }

  try {
    await sendViaCloudApi(target, message);
    result.channel = 'cloud_api';
    result.sent = true;
    result.error = '';
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

export function summariseOrderForSms(order) {
  return [
    `${order.orderNo} — Rs ${roundMoney(order.total)}`,
    `${order.customer.name} (${order.customer.phone})`,
    `${order.items.length} item(s), ${order.source}`,
  ].join(' | ');
}
