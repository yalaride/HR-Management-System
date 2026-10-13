import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendance extends Document {
  userId: string;
  date: string; // Stored in YYYY-MM-DD format to ensure unique daily entries
  checkIn: Date;
  checkOut?: Date;
  workingHours?: number; // Store as decimal hours (e.g., 7.5)
  formattedDuration?: string; // Store reader-friendly format (e.g., "7 hrs 30 mins")
  status: "On Time" | "Late" | "Absent";
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, 
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, default: null },
    workingHours: { type: Number, default: 0 },
    formattedDuration: { type: String, default: "" },
    status: { 
      type: String, 
      enum: ["On Time", "Late", "Absent"], 
      required: true 
    },
  },
  { timestamps: true }
);

// Ensure an employee cannot have duplicate date records
AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Attendance: Model<IAttendance> = 
  mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", AttendanceSchema);
