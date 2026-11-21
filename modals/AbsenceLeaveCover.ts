import mongoose, { Schema, model, models } from "mongoose";

export interface IAbsenceLeaveCover {
  userId: string;
  date: string;
}

const AbsenceLeaveCoverSchema = new Schema<IAbsenceLeaveCover>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

AbsenceLeaveCoverSchema.index({ userId: 1, date: 1 }, { unique: true });

export const AbsenceLeaveCover =
  models.AbsenceLeaveCover || model<IAbsenceLeaveCover>("AbsenceLeaveCover", AbsenceLeaveCoverSchema);
