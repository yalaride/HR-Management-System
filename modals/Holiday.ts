import mongoose, { Schema, model, models } from "mongoose";

export interface IHoliday {
  title: string;
  startDate: string;
  endDate: string;
  resumeDate: string;
  subject: string;
  announcement: string;
  sentCount: number;
  failedCount: number;
  announcedAt?: Date | null;
  createdBy?: string;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    title: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    resumeDate: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    announcement: { type: String, required: true },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    announcedAt: { type: Date, default: null },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

HolidaySchema.index({ startDate: 1, endDate: 1 });

export const Holiday = models.Holiday || model<IHoliday>("Holiday", HolidaySchema);
