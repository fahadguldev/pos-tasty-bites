import '../config/mongoose.js'; // must load before any model is compiled
import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { singleImage } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as categories from '../controllers/categoryController.js';
import * as products from '../controllers/productController.js';
import * as deals from '../controllers/dealController.js';
import * as orders from '../controllers/orderController.js';
import * as reviews from '../controllers/reviewController.js';
import * as analytics from '../controllers/analyticsController.js';
import * as settings from '../controllers/settingsController.js';
import * as upload from '../controllers/uploadController.js';
import * as contacts from '../controllers/contactController.js';
import * as campaigns from '../controllers/campaignController.js';

const router = Router();

// ---------- public storefront ----------
router.get('/settings', settings.getPublic);

router.get('/categories', categories.list);

router.get('/products', products.list);
router.get('/products/:slugOrId', products.getOne);
router.get('/products/:slugOrId/reviews', reviews.forProduct);
router.get('/deals/:slugOrId/reviews', reviews.forDeal);

router.get('/deals', deals.list);
router.get('/deals/:slugOrId', deals.getOne);

router.post('/orders/quote', orders.quote);
router.post('/orders', orders.create);
router.post('/orders/whatsapp-link', orders.createWhatsappLink);
router.get('/orders/track', orders.track);
router.post('/reviews', reviews.create);

// ---------- admin ----------
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAdmin, auth.me);
router.post('/auth/change-password', requireAdmin, auth.changePassword);

router.post('/upload', requireAdmin, singleImage, upload.upload);
router.delete('/upload', requireAdmin, upload.remove);
router.get('/upload/status', requireAdmin, upload.status);

router.get('/admin/categories', requireAdmin, categories.list);
router.post('/admin/categories', requireAdmin, categories.create);
router.put('/admin/categories/:id', requireAdmin, categories.update);
router.delete('/admin/categories/:id', requireAdmin, categories.remove);

// admin sees sold-out items too, so this is not just the public list
router.get('/admin/products', requireAdmin, products.adminList);
router.post('/admin/products', requireAdmin, products.create);
router.put('/admin/products/:id', requireAdmin, products.update);
router.delete('/admin/products/:id', requireAdmin, products.remove);
router.patch('/admin/products/:id/availability', requireAdmin, products.toggleAvailability);

router.get('/admin/deals', requireAdmin, deals.list);
router.get('/admin/deals/timeline', requireAdmin, deals.timeline);
router.post('/admin/deals', requireAdmin, deals.create);
router.put('/admin/deals/:id', requireAdmin, deals.update);
router.delete('/admin/deals/:id', requireAdmin, deals.remove);

router.get('/admin/orders', requireAdmin, orders.list);
router.get('/admin/orders/:id', requireAdmin, orders.getOne);
router.patch('/admin/orders/:id/status', requireAdmin, orders.updateStatus);
router.post('/admin/orders/:id/whatsapp', requireAdmin, orders.resendWhatsapp);
router.get('/admin/orders/:id/receipt', requireAdmin, orders.receipt);

router.get('/admin/reviews', requireAdmin, reviews.listAll);
router.patch('/admin/reviews/:id/approve', requireAdmin, reviews.setApproved);
router.delete('/admin/reviews/:id', requireAdmin, reviews.remove);

router.get('/admin/analytics/overview', requireAdmin, analytics.overview);
router.get('/admin/analytics/daily', requireAdmin, analytics.dailySeries);
router.get('/admin/analytics/monthly', requireAdmin, analytics.monthly);
router.get('/admin/analytics/top-products', requireAdmin, analytics.topProducts);
router.get('/admin/analytics/top-deals', requireAdmin, analytics.topDeals);
router.get('/admin/analytics/insights', requireAdmin, analytics.insights);

router.get('/admin/settings', requireAdmin, settings.getAdmin);
router.put('/admin/settings', requireAdmin, settings.update);
router.post('/admin/settings/seed-payment-methods', requireAdmin, settings.seedPaymentMethods);

router.get('/admin/contacts', requireAdmin, contacts.list);
router.get('/admin/contacts/backfill/preview', requireAdmin, contacts.backfillPreview);
router.post('/admin/contacts/backfill', requireAdmin, contacts.backfillApply);
router.get('/admin/contacts/:id', requireAdmin, contacts.getOne);
router.post('/admin/contacts', requireAdmin, contacts.create);
router.put('/admin/contacts/:id', requireAdmin, contacts.update);
router.delete('/admin/contacts/:id', requireAdmin, contacts.remove);

router.get('/admin/campaigns', requireAdmin, campaigns.list);
router.post('/admin/campaigns', requireAdmin, campaigns.create);
router.get('/admin/campaigns/:id/preview', requireAdmin, campaigns.preview);
router.post('/admin/campaigns/:id/start', requireAdmin, campaigns.start);
router.post('/admin/campaigns/:id/pause', requireAdmin, campaigns.pause);
router.post('/admin/campaigns/:id/resume', requireAdmin, campaigns.resume);
router.post('/admin/campaigns/:id/cancel', requireAdmin, campaigns.cancel);
router.get('/admin/campaigns/:id/messages', requireAdmin, campaigns.messages);
router.get('/admin/campaigns/:id', requireAdmin, campaigns.getOne);
router.put('/admin/campaigns/:id', requireAdmin, campaigns.update);
router.delete('/admin/campaigns/:id', requireAdmin, campaigns.remove);

export default router;
