import mongoose from 'mongoose';

/**
 * A plain record of every message in and out.
 *
 * This is the audit trail for a campaign: what was actually sent to which
 * number, what came back, and what the reply was understood to mean. It is the
 * first place to look when a customer says they never received something.
 */
const MessageLogSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'SendJob', default: null },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: null },
    phone: { type: String, required: true, index: true },

    direction: { type: String, enum: ['in', 'out'], required: true },
    stage: { type: String, enum: ['opener', 'deal', 'system'], default: 'system' },

    // what the message meant: opener_sent, deal_sent, qualified, snooze, stop,
    // ignored, error
    kind: { type: String, default: '' },

    body: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

MessageLogSchema.index({ campaign: 1, createdAt: -1 });

export default mongoose.model('MessageLog', MessageLogSchema);
