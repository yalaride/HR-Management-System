import { Schema, model, models } from "mongoose";

const PayslipSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
  employeeName: { type: String }, // Snapshot of name at creation
  employeeRole: { type: String }, // Snapshot of title at creation
  period: { type: String, required: true },
  basicSalary: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  taxMode: { type: String, enum: ["deduct", "add"], default: "deduct" },
  netPay: { type: Number, required: true },
  paymentMethod: { type: String },
  paymentDate: { type: Date },
  status: { type: String, enum: ["Active", "Suspended"], default: "Active" }, // Already exists
  version: { type: String, default: "v1" }, // New version field added
}, { timestamps: true });

if (models.Payslip && !models.Payslip.schema.path("tax")) {
  delete models.Payslip;
}

export const Payslip = models.Payslip || model("Payslip", PayslipSchema);