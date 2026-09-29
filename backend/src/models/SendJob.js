import mongoose from 'mongoose';

/**
 * A single message to a single person.
 *
 * The job is created once and carries the exact rendered text, so a retry sends
 * byte-for-byte the same message instead of re-rolling the template and looking
 * like a different, spammy account.
 *
 * `dayKey` is the local yyyy-mm-dd the job belongs to. Daily caps are counted
 * from the database, not from memory, so restarting the worker mid-campaign
 * does not hand the campaign a fresh allowance.
 */
const SendJobSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    phone: { type: String, required: true },

    // 'opener' is the question. 'deal' is only created after a positive reply.
    stage: { type: String, enum: ['opener', 'deal'], default: 'opener' },

    status: {
      type: String,
      enum: ['queued', 'scheduled', 'sending', 'sent', 'replied', 'dealQueued', 'skipped', 'failed', 'cancelled'],
      default: 'queued',
    },

    // rendered once at creation and never re-rolled
    variant: { type: String, default: '' },
    buttons: { type: [String], default: [] },
    imageUrl: { type: String, default: '' },

    // the pacing engine sets this; it is always inside the send window
    scheduledFor: { type: Date, default: null },
    dayKey: { type: String, default: '' },

    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 2, min: 0 },
    lastError: { type: String, default: '' },

    sentAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },
    // when the person actually agreed to hear the deal. kept separate from
    // consent: agreeing to a deal is not the same as agreeing to be messaged.
    qualifiedAt: { type: Date, default: null },
    replyText: { type: String, default: '' },
  },
  { timestamps: true }
);

SendJobSchema.index({ campaign: 1, phone: 1, stage: 1 }, { unique: true });
SendJobSchema.index({ status: 1, scheduledFor: 1 });
SendJobSchema.index({ campaign: 1, dayKey: 1, status: 1 });

export default mongoose.model('SendJob', SendJobSchema);
