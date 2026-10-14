// modals/Employee.ts
import { Schema, model, models } from "mongoose";

// Sub-schema to store extension history (Probation / Internship)
const ExtensionSchema = new Schema(
  {
    type: { type: String, trim: true, default: "" },
    stage: { type: String, trim: true, default: "" },
    previousEndDate: { type: Date, required: true },
    newEndDate: { type: Date, required: true },
    durationMonths: { type: Number, required: true }, // e.g. 1, 2, 3 months
    reason: { type: String, required: true, trim: true }, // Mandatory reason
    extendedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    extendedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const EmployeeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    designation: { type: String, required: true },
    jobTitle: { type: String, default: "" },
    joinDate: { type: Date, required: true },
    department: { type: String, required: true },

    salary: {
      type: Number,
      default: 0,
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },

    // Status: Active, Inactive, On Leave, Terminated
    status: {
      type: String,
      enum: ["Active", "Inactive", "On Leave", "Terminated"],
      default: "Active",
      required: true,
    },

    // --- Employment Type & Lifecycle Fields ---
    employmentType: {
      type: String,
      enum: ["Internship", "Probation", "Permanent", "Contract"],
      default: "Probation",
      required: true,
    },

    // Review Status (for alerts & dashboard filtering)
    reviewStatus: {
      type: String,
      enum: ["Pending", "Due Review", "In Review", "Completed"],
      default: "Pending",
    },
    periodStartDate: { type: Date, default: null },
    periodEndDate: { type: Date, default: null },
    lifecycleDurationMonths: { type: Number, default: null },
    nextReviewDate: { type: Date, default: null },

    // 1. Internship Details
    internshipStartDate: { type: Date, default: null },
    internshipEndDate: { type: Date, default: null },
    internshipExtensions: { type: [ExtensionSchema], default: [] },

    // 2. Probation Details
    probationStartDate: { type: Date, default: null },
    probationEndDate: { type: Date, default: null },
    probationExtensions: { type: [ExtensionSchema], default: [] },
    extensions: { type: [ExtensionSchema], default: [] },

    // 3. Permanent Confirmation
    confirmationDate: { type: Date, default: null },

    // 4. Exit / Separation Details
    exitDate: { type: Date, default: null },
    exitReason: { type: String, default: "" },

    // Number printed by the fingerprint device (14, 15, 16). Matches incoming punches.
    deviceUserNo: { type: String },

    // --- Personal & Contact Information ---
    employeeId: { type: String, default: "" },
    profilePhotoUrl: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    address: { type: String, default: "" },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, default: "" },
    maritalStatus: { type: String, default: "" },
    emergencyContactName: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },

    // Birthday Email Status
    birthdayEmailStatus: {
      type: String,
      enum: ["Sent", "Scheduled", "Pending", "Failed"],
      default: "Pending",
    },
    birthdayEmailSentYear: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
EmployeeSchema.index({ department: 1, status: 1 });
EmployeeSchema.index({ employmentType: 1, reviewStatus: 1 });
EmployeeSchema.index({ nextReviewDate: 1 });
EmployeeSchema.index(
  { deviceUserNo: 1 },
  {
    unique: true,
    partialFilterExpression: { deviceUserNo: { $type: "string" } },
  }
);

if (models.Employee && !models.Employee.schema.path("deviceUserNo")) {
  delete models.Employee;
}

export const Employee = models.Employee || model("Employee", EmployeeSchema);