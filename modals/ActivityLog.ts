import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActivityLog extends Document {
  userId: string;
  activityType:
    | "CHECK_IN"
    | "CHECK_OUT"
    | "LEAVE_REQUEST"
    | "LEAVE_APPROVED"
    | "LEAVE_REJECTED"
    | "LEAVE_DELETED"
    | "BIRTHDAY_EMAIL"
    | "EMAIL_FAILED"
    | "PAYSLIP";
  date: string; // YYYY-MM-DD
  timestamp: Date;
  description: string;
  metadata?: {
    attendanceId?: mongoose.Types.ObjectId | string;
    leaveId?: mongoose.Types.ObjectId | string;
    status?: string; // "Sent", "Failed", "Skipped", etc.
    workingHours?: number;
    leaveType?: string;
    days?: number;
    emailAddress?: string;
    errorMessage?: string;
    emailKind?: string;
  };
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: String, required: true, index: true },
    activityType: {
      type: String,
      required: true,
      enum: [
        "CHECK_IN",
        "CHECK_OUT",
        "LEAVE_REQUEST",
        "LEAVE_APPROVED",
        "LEAVE_REJECTED",
        "LEAVE_DELETED",
        "BIRTHDAY_EMAIL",
        "EMAIL_FAILED",
        "PAYSLIP",
      ],
    },
    date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    timestamp: { type: Date, default: Date.now },
    description: { type: String, required: true },
    metadata: {
      attendanceId: { type: Schema.Types.ObjectId, ref: "Attendance" },
      leaveId: { type: Schema.Types.ObjectId, ref: "Leave" },
      status: { type: String },
      workingHours: { type: Number },
      leaveType: { type: String },
      days: { type: Number },
      emailAddress: { type: String },
      errorMessage: { type: String },
      emailKind: { type: String },
    },
  },
  { timestamps: true }
);

// Fetch history for a specific user ordered by time
ActivityLogSchema.index({ userId: 1, timestamp: -1 });
// Global admin activity feed: newest first
ActivityLogSchema.index({ createdAt: -1 });

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog || mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);