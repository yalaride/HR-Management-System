import { Schema, model, models } from "mongoose";

const LeaveBalanceSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    // Added customPolicy flag (defaults to false)
    customPolicy: { type: Boolean, required: true, default: false },

    // --- Permanent-confirmation leave proration ---
    // When an employee becomes Permanent part-way through a calendar year,
    // their ANNUAL allowance is prorated for the remaining months of that
    // year. `proratedForYear` records the year the proration applies to so
    // the yearly reset can restore the full allowance afterwards.
    proratedForYear: { type: Number, default: null },
    // The full (unprorated) annual allowance, kept so the yearly reset can
    // restore it for employees on a custom policy whose `allocated` was
    // temporarily reduced by proration.
    annualFullAllocation: { type: Number, default: null },
    sickFullAllocation: { type: Number, default: null },
    casualFullAllocation: { type: Number, default: null },


    ANNUAL: {
      allocated: { type: Number, required: true, default: 15, min: 0 },
      used: { type: Number, required: true, default: 0, min: 0 },
    },

    SICK: {
      allocated: { type: Number, required: true, default: 8, min: 0 },
      used: { type: Number, required: true, default: 0, min: 0 },
    },

    CASUAL: {
      allocated: { type: Number, required: true, default: 6, min: 0 },
      used: { type: Number, required: true, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

const LeaveBalance = models.LeaveBalance || model("LeaveBalance", LeaveBalanceSchema);
export default LeaveBalance;