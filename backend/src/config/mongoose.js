import mongoose from 'mongoose';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

/**
 * `.lean()` strips schema virtuals by default, which would hide effectivePrice,
 * savings, discountPercent, isLive and profit from the API. This module registers
 * the plugin that puts them back.
 *
 * It must be imported *before* any model is compiled, so it is imported first in
 * index.js, src/routes/index.js and the seed script.
 */
mongoose.plugin(mongooseLeanVirtuals);
