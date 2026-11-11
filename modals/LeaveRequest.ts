import { Schema, model, models } from "mongoose";

const LeaveSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },

    // Used by admin UI (Leave Manager) to display who requested the leave and their role/title.
    employeeName: { type: String, required: false, trim: true, default: "" },
    designation: { type: String, required: false, trim: true, default: "" },

    type: {
      type: String,
      required: true,
      enum: ["ANNUAL", "SICK", "CASUAL", "UNPAID", "FULL", "HALF", "URGENT", "EXTRA_PAID"],
      uppercase: true,
      trim: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      uppercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Admin Leave Manager listing: filter by status, newest first
LeaveSchema.index({ status: 1, createdAt: -1 });

const Leave = models.Leave || model("Leave", LeaveSchema);
export default Leave;

