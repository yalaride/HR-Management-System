import { Schema, model, models } from "mongoose";

export const POLICY_CATEGORIES = [
  "general",
  "attendance",
  "conduct",
  "leaves",
  "benefits",
  "security",
  "safety",
] as const;

export const POLICY_PRIORITIES = ["standard", "important", "critical"] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];
export type PolicyPriority = (typeof POLICY_PRIORITIES)[number];

const HRPolicySectionSchema = new Schema(
  {
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: POLICY_CATEGORIES,
      default: "general",
    },
    priority: {
      type: String,
      enum: POLICY_PRIORITIES,
      default: "standard",
    },
    summary: { type: String, default: "", trim: true },
    content: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    published: { type: Boolean, default: true },
    requiresAcknowledgement: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const HRPolicySchema = new Schema(
  {
    key: { type: String, unique: true, default: "default" },
    lastUpdatedBy: {
      id: { type: String },
      name: { type: String },
      email: { type: String },
    },
    sections: { type: [HRPolicySectionSchema], default: [] },
  },
  { timestamps: true }
);

export const defaultHRPolicySections = [
  {
    number: 1,
    title: "Code of Conduct & Workplace Ethics",
    category: "conduct",
    priority: "critical",
    summary: "Guiding principles on professionalism, integrity, and anti-harassment.",
    content:
      "All team members are expected to conduct themselves professionally, treat colleagues with respect, and uphold company integrity.\n\nDiscrimination, harassment, conflicts of interest, or unethical conduct will result in immediate disciplinary review up to and including termination.",
    order: 1,
    published: true,
    requiresAcknowledgement: true,
  },
  {
    number: 2,
    title: "Attendance and Compliance",
    category: "attendance",
    priority: "important",
    summary: "Core guidelines on punctuality, absence reporting, and shift compliance.",
    content:
      "All employees are expected to maintain regular attendance, punctuality, and discipline during working hours.\n\nEmployees must follow the leave approval process and inform their reporting manager whenever they are unable to attend work.\n\nRepeated unauthorized absences, late arrivals, extended breaks, or failure to follow this policy may result in appropriate disciplinary action and/or salary deduction as applicable.",
    order: 2,
    published: true,
    requiresAcknowledgement: true,
  },
  {
    number: 3,
    title: "Management Rights & Amendments",
    category: "general",
    priority: "standard",
    summary: "Authority to review, adjust, and make final determinations on policies.",
    content:
      "SYNC UP reserves the right to review, amend, or update this policy based on business requirements and applicable laws.\n\nManagement will have the final authority regarding probation confirmation, leave approval, carry-forward of unused leave, and exceptional circumstances.",
    order: 3,
    published: true,
    requiresAcknowledgement: false,
  },
];

export const HRPolicy = models.HRPolicy || model("HRPolicy", HRPolicySchema);