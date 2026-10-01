import mongoose from 'mongoose';

/**
 * Money the shop spent to keep running, typed in by the admin.
 *
 * This is deliberately outside the order ledger: an order's `cost` is the
 * theoretical food cost of what was sold, while this records what was actually
 * paid out — a sack of flour bought on Monday, the electricity bill, a repair.
 * The two are never added together, because one is per-sale and the other is
 * per-day and they would double count.
 *
 * `category` is free text rather than an enum so the admin can name the
 * headings this kitchen actually uses. The UI offers a sensible list; anything
 * typed stays in the list forever.
 *
 * `spentAt` is the day the money left the till, which is usually not the day
 * the row was entered.
 */
const ExpenseSchema = new mongoose.Schema(
  {
    // what the money bought, e.g. "Beef mince, 10kg"
    title: { type: String, required: true, trim: true },

    category: { type: String, default: 'Other', trim: true },

    amount: { type: Number, required: true, min: 0 },

    spentAt: { type: Date, default: () => new Date() },

    // who was paid, e.g. "Khalil Bazaar"
    vendor: { type: String, default: '', trim: true },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

ExpenseSchema.index({ spentAt: -1 });
ExpenseSchema.index({ category: 1, spentAt: -1 });

export default mongoose.model('Expense', ExpenseSchema);
