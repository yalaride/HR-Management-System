import mongoose, { Schema, model, models } from "mongoose";

export interface IAttendanceOmission {
  userId: string;
  date: string;
}

const AttendanceOmissionSchema = new Schema<IAttendanceOmission>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

AttendanceOmissionSchema.index({ userId: 1, date: 1 }, { unique: true });

export const AttendanceOmission =
  models.AttendanceOmission || model<IAttendanceOmission>("AttendanceOmission", AttendanceOmissionSchema);
