import mongoose from 'mongoose';

/**
 * A person the cafe is allowed to contact.
 *
 * Contacts are only ever built from people the shop already has a relationship
 * with — real order history, or a sheet the admin reviewed. There is no way to
 * import a cold list, because a cold list is what gets a number restricted.
 *
 * `consentSource` and `consentedAt` record *why* the shop considers this person
 * contactable. They are kept even though the current basis is implicit (an order
 * was placed), so a later decision can be audited rather than guessed at.
 */
const ContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // always stored normalised to 923xxxxxxxxx by the controllers and backfill
    phone: { type: String, required: true, trim: true },

    area: { type: String, default: '', trim: true },
    notes: { type: String, default: '' },

    // where the record came from, so the list can be traced back later
    source: { type: String, enum: ['order', 'import', 'manual'], default: 'manual' },

    // when the shop started treating this person as contactable, and on what basis
    consentSource: { type: String, default: '' },
    consentedAt: { type: Date, default: null },

    // permanent stop. a contact with optOut is never selected for a campaign.
    optOut: { type: Boolean, default: false },
    optedOutAt: { type: Date, default: null },

    // "not right now" on a campaign. temporary, unlike optOut.
    doNotContactUntil: { type: Date, default: null },

    // when this person asked for a deal, so a later campaign can go straight to
    // someone who already said yes
    qualifiedAt: { type: Date, default: null },

    tags: { type: [String], default: [] },

    // order history, so the admin can see who the repeat customers are
    orderCount: { type: Number, default: 0, min: 0 },
    firstOrderAt: { type: Date, default: null },
    lastOrderAt: { type: Date, default: null },
    totalSpent: { type: Number, default: 0, min: 0 },
    lastKnownAddress: { type: String, default: '' },
    lastKnownArea: { type: String, default: '' },
  },
  { timestamps: true }
);

ContactSchema.index({ phone: 1 }, { unique: true });
ContactSchema.index({ optOut: 1, lastOrderAt: -1 });
ContactSchema.index({ source: 1 });

/**
 * False when the contact must be left alone: opted out permanently, or paused
 * after tapping "not now". Campaigns should filter on this before sending.
 */
ContactSchema.virtual('isContactable').get(function () {
  if (this.optOut) return false;
  if (this.doNotContactUntil && this.doNotContactUntil > new Date()) return false;
  return true;
});

ContactSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Contact', ContactSchema);
