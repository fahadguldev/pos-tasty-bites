import PDFDocument from 'pdfkit';
import { roundMoney } from '../utils/format.js';

const INK = '#1c1917';
const MUTED = '#78716c';
const ACCENT = '#ea580c';

const PAYMENT_LABELS = {
  cod: 'Cash on delivery',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  bank: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};

export function streamOrderReceipt(order, settings, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 44 });
  const shop = settings?.shopName || 'Tasty Bites';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${order.orderNo}.pdf"`);

  doc.pipe(res);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const money = (n) => `Rs ${roundMoney(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // header
  doc.rect(0, 0, doc.page.width, 96).fill(ACCENT);
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(shop, left, 32);
  doc.fontSize(9).font('Helvetica').text(settings?.tagline || 'Home delivery', { width: right - left });
  doc.text([settings?.address, settings?.city].filter(Boolean).join(', '));
  if (settings?.phone) doc.text(`Phone: ${settings.phone}`);

  // meta
  let y = 124;
  doc.fillColor(INK).fontSize(11).font('Helvetica-Bold').text('ORDER RECEIPT', left, y);
  y += 18;
  doc.fontSize(10).font('Helvetica').fillColor(MUTED);
  doc.text(`Order #${order.orderNo}`, left, y);
  doc.text(`Placed: ${new Date(order.createdAt).toLocaleString('en-PK')}`, left, y + 14, {
    width: 250,
    align: 'right',
  });
  y += 36;

  doc.fillColor(INK).fontSize(10);
  doc.text(`Customer: ${order.customer.name}`, left, y);
  doc.text(`Phone: ${order.customer.phone}`, right - 220, y, { width: 220, align: 'right' });
  y += 15;
  doc.fillColor(MUTED).fontSize(9);
  doc.text(`Address: ${order.customer.address}`, left, y, { width: 380 });
  doc.text(`Payment: ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}`, right - 220, y, {
    width: 220,
    align: 'right',
  });
  if (order.customer.landmark || order.customer.area) {
    y += 15;
    const parts = [order.customer.area, order.customer.landmark].filter(Boolean).join(' — ');
    doc.text(parts, left, y, { width: 380 });
  }

  // items table
  y += 28;
  doc.moveTo(left, y).lineTo(right, y).strokeColor('#e7e5e4').lineWidth(1).stroke();
  y += 10;

  doc.fillColor(MUTED).fontSize(9).font('Helvetica-Bold');
  doc.text('ITEM', left, y);
  doc.text('QTY', right - 210, y, { width: 40, align: 'right' });
  doc.text('RATE', right - 160, y, { width: 70, align: 'right' });
  doc.text('AMOUNT', right - 80, y, { width: 80, align: 'right' });
  y += 16;

  order.items.forEach((item) => {
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.fillColor(INK).fontSize(10).font('Helvetica');
    const label = item.variantName ? `${item.name} (${item.variantName})` : item.name;
    doc.text(label, left, y, { width: 320 });
    doc.text(String(item.qty), right - 210, y, { width: 40, align: 'right' });
    doc.text(money(item.unitPrice), right - 160, y, { width: 70, align: 'right' });
    doc.text(money(item.lineTotal), right - 80, y, { width: 80, align: 'right' });
    y += 18;
  });

  // totals
  y += 6;
  doc.moveTo(left, y).lineTo(right, y).strokeColor('#e7e5e4').stroke();
  y += 12;

  const totalRow = (label, value, bold = false) => {
    doc.fontSize(bold ? 11 : 10).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    doc.fillColor(bold ? INK : MUTED);
    doc.text(label, right - 240, y, { width: 150, align: 'right' });
    doc.text(value, right - 80, y, { width: 80, align: 'right' });
    y += bold ? 20 : 16;
  };

  totalRow('Subtotal', money(order.subtotal));
  if (order.deliveryFee > 0) totalRow('Delivery charges', money(order.deliveryFee));
  if (order.discount > 0) totalRow('Discount', `- ${money(order.discount)}`);
  y += 4;
  totalRow('Total payable', money(order.total), true);

  // footer
  doc.fontSize(9).font('Helvetica').fillColor(MUTED);
  doc.text('Thank you for ordering from us!', left, y + 18, { width: right - left, align: 'center' });
  doc.text(
    `Order placed via ${order.source}. Questions? Call ${settings?.phone || 'our number'}.`,
    left,
    y + 32,
    { width: right - left, align: 'center' }
  );

  doc.end();
}
