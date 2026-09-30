import mongoose from 'mongoose';

const OptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, maxlength: 40 },
    // what a tap on this button does. handled in services/inbound.js
    action: { type: String, enum: ['send_deal', 'snooze', 'stop'], required: true },
    // how long snooze pauses the contact before they can be messaged again
    snoozeDays: { type: Number, default: 30, min: 1 },
  },
  { _id: false }
);

const CampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // optional. when set, the deal's name, price, saving and photo fill the
    // message tokens, so a re-priced deal updates the message automatically
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', default: null },

    // stage 1: the question. sent to a contactable customer, cold.
    openerTemplate: { type: String, required: true },

    // stage 2: the deal. never sent unless the customer asked for it.
    dealTemplate: { type: String, required: true },

    // quick-reply buttons on the opener. whatsapp web caps these at three.
    options: { type: [OptionSchema], default: [] },

    // optional photo attached to the deal message
    sendImage: { type: Boolean, default: false },

    // ---- audience and pacing ----

    // how many contacts this campaign may message. the admin sets this directly:
    // there is no automatic ramp, so the number sent is the number chosen.
    // 0 means everyone who is contactable.
    recipientLimit: { type: Number, default: 10, min: 0 },

    // pause between two individual messages, in seconds
    gap: {
      minSeconds: { type: Number, default: 120, min: 0 },
      maxSeconds: { type: Number, default: 300, min: 0 },
    },

    // ----- lifecycle ----

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled'],
      default: 'draft',
    },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },

    // live counters, kept on the campaign so the admin screen needs one read
    stats: {
      recipients: { type: Number, default: 0 },
      openersSent: { type: Number, default: 0 },
      qualified: { type: Number, default: 0 },
      dealsSent: { type: Number, default: 0 },
      snoozed: { type: Number, default: 0 },
      optedOut: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },

    // trail of the reply rate so a pause/restart keeps its history
    dailyStats: {
      type: [{ dayKey: String, openersSent: Number, qualified: Number, dealsSent: Number }],
      default: [],
    },
  },
  { timestamps: true }
);

CampaignSchema.index({ status: 1, createdAt: -1 });

/** Share of recipients that actually replied. Shown on the admin screen. */
CampaignSchema.virtual('replyRate').get(function () {
  if (!this.stats?.openersSent) return null;
  return Math.round((this.stats.qualified / this.stats.openersSent) * 100) / 100;
});

CampaignSchema.virtual('isActive').get(function () {
  return this.status === 'running' || this.status === 'scheduled';
});

CampaignSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Campaign', CampaignSchema);
