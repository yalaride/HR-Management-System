import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmployeeLeavePolicy extends Document {
  userId: string;
  ANNUAL: number;
  SICK: number;
  CASUAL: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const EmployeeLeavePolicySchema = new Schema<IEmployeeLeavePolicy>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ANNUAL: {
      type: Number,
      required: true,
      min: [0, "Annual leaves cannot be negative"],
      default: 15,
    },
    SICK: {
      type: Number,
      required: true,
      min: [0, "Sick leaves cannot be negative"],
      default: 8,
    },
    CASUAL: {
      type: Number,
      required: true,
      min: [0, "Casual leaves cannot be negative"],
      default: 6,
    },
  },
  {
    timestamps: true,
  }
);

const EmployeeLeavePolicy: Model<IEmployeeLeavePolicy> =
  mongoose.models.EmployeeLeavePolicy ||
  mongoose.model<IEmployeeLeavePolicy>("EmployeeLeavePolicy", EmployeeLeavePolicySchema);

export default EmployeeLeavePolicy;