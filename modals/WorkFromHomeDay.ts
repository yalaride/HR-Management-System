import mongoose, { Schema, model, models } from "mongoose";

export interface IWorkFromHomeDay {
  userId: string;
  date: string;
}

const WorkFromHomeDaySchema = new Schema<IWorkFromHomeDay>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

WorkFromHomeDaySchema.index({ userId: 1, date: 1 }, { unique: true });

export const WorkFromHomeDay =
  models.WorkFromHomeDay || model<IWorkFromHomeDay>("WorkFromHomeDay", WorkFromHomeDaySchema);
