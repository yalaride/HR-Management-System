import { Schema, model, models } from "mongoose";

const GlobalLeavePolicySchema = new Schema(
  {
    key: { type: String, unique: true, default: "default" },
    year: { type: Number, required: true, default: () => new Date().getFullYear() },
    ANNUAL: { type: Number, required: true, min: 0, default: 15 },
    SICK: { type: Number, required: true, min: 0, default: 8 },
    CASUAL: { type: Number, required: true, min: 0, default: 6 },
  },
  { timestamps: true }
);

export const GlobalLeavePolicy =
  models.GlobalLeavePolicy || model("GlobalLeavePolicy", GlobalLeavePolicySchema);
