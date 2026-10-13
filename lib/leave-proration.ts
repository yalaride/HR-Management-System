import connectDB from "@/lib/mongodb";
import LeaveBalance from "@/modals/LeaveBalance";
import { GlobalLeavePolicy } from "@/modals/GlobalLeavePolicy";
import EmployeeLeavePolicy from "@/modals/LeavePolicy";

export const DEFAULT_LEAVE_POLICY = { ANNUAL: 10, SICK: 10, CASUAL: 10 };
const DEFAULTS = DEFAULT_LEAVE_POLICY;
type LeaveType = keyof typeof DEFAULTS;

export function getRemainingMonthsInYear(date: Date, now: Date = new Date()): number {
  const year = date.getUTCFullYear();
  const currentYear = now.getUTCFullYear();
  if (year < currentYear) return 12;
  if (year > currentYear) return 0;
  return 12 - date.getUTCMonth();
}

export function computeProratedAnnual(
  fullAnnual: number,
  date: Date,
  now: Date = new Date()
): number {
  const full = Math.max(0, Math.round(Number(fullAnnual) || 0));
  return Math.max(0, Math.min(full, Math.round((full / 12) * getRemainingMonthsInYear(date, now))));
}

async function resolveFullLeaveAllowances(userId: string): Promise<Record<LeaveType, number>> {
  await connectDB();
  const [custom, global] = await Promise.all([
    EmployeeLeavePolicy.findOne({ userId }).lean() as Promise<{
      ANNUAL?: number; SICK?: number; CASUAL?: number;
    } | null>,
    GlobalLeavePolicy.findOne({ key: "default" }).lean() as Promise<{
      ANNUAL?: number; SICK?: number; CASUAL?: number;
    } | null>,
  ]);
  return Object.fromEntries(
    (Object.keys(DEFAULTS) as LeaveType[]).map((type) => [
      type,
      Math.max(0, Math.round(Number(custom?.[type] ?? global?.[type] ?? DEFAULTS[type]))),
    ])
  ) as Record<LeaveType, number>;
}

export async function applyEmployeeLeaveProration(
  userId: string,
  joinDate: Date,
  options: { now?: Date } = {}
): Promise<void> {
  await connectDB();
  const now = options.now ?? new Date();
  const full = await resolveFullLeaveAllowances(userId);
  const balance = await LeaveBalance.findOne({ userId }) ||
    new LeaveBalance({
      userId,
      customPolicy: Boolean(await EmployeeLeavePolicy.exists({ userId })),
      ANNUAL: { allocated: 0, used: 0 },
      SICK: { allocated: 0, used: 0 },
      CASUAL: { allocated: 0, used: 0 },
    });

  for (const type of Object.keys(DEFAULTS) as LeaveType[]) {
    balance[type].allocated = computeProratedAnnual(full[type], joinDate, now);
    balance[type].remaining = Math.max(
      0,
      balance[type].allocated - Number(balance[type].used || 0)
    );
  }
  balance.proratedForYear =
    joinDate.getUTCFullYear() === now.getUTCFullYear() ? now.getUTCFullYear() : null;
  balance.annualFullAllocation = full.ANNUAL;
  balance.sickFullAllocation = full.SICK;
  balance.casualFullAllocation = full.CASUAL;
  await balance.save();
}

export async function restoreProratedAnnualForNewYear(currentYear: number): Promise<number> {
  await connectDB();
  const result = await LeaveBalance.updateMany(
    { proratedForYear: { $ne: null, $lt: currentYear } },
    [{
      $set: {
        "ANNUAL.allocated": { $ifNull: ["$annualFullAllocation", "$ANNUAL.allocated"] },
        "SICK.allocated": { $ifNull: ["$sickFullAllocation", "$SICK.allocated"] },
        "CASUAL.allocated": { $ifNull: ["$casualFullAllocation", "$CASUAL.allocated"] },
        "ANNUAL.remaining": { $max: [0, { $subtract: [
          { $ifNull: ["$annualFullAllocation", "$ANNUAL.allocated"] }, { $ifNull: ["$ANNUAL.used", 0] }
        ] }] },
        "SICK.remaining": { $max: [0, { $subtract: [
          { $ifNull: ["$sickFullAllocation", "$SICK.allocated"] }, { $ifNull: ["$SICK.used", 0] }
        ] }] },
        "CASUAL.remaining": { $max: [0, { $subtract: [
          { $ifNull: ["$casualFullAllocation", "$CASUAL.allocated"] }, { $ifNull: ["$CASUAL.used", 0] }
        ] }] },
        proratedForYear: null,
      },
    }]
  );
  return result.modifiedCount || 0;
}

export async function resetLeaveBalancesForNewYear(
  currentYear: number,
  policy: Record<LeaveType, number>
): Promise<void> {
  await connectDB();
  await LeaveBalance.updateMany(
    {},
    { $set: { "ANNUAL.used": 0, "SICK.used": 0, "CASUAL.used": 0 } }
  );
  await LeaveBalance.updateMany(
    { customPolicy: { $ne: true } },
    { $set: {
      "ANNUAL.allocated": policy.ANNUAL, "SICK.allocated": policy.SICK, "CASUAL.allocated": policy.CASUAL,
      "ANNUAL.remaining": policy.ANNUAL, "SICK.remaining": policy.SICK, "CASUAL.remaining": policy.CASUAL,
    } }
  );
  await LeaveBalance.updateMany(
    { customPolicy: true },
    [{ $set: {
      "ANNUAL.remaining": { $ifNull: ["$ANNUAL.allocated", 0] },
      "SICK.remaining": { $ifNull: ["$SICK.allocated", 0] },
      "CASUAL.remaining": { $ifNull: ["$CASUAL.allocated", 0] },
    } }]
  );
  await restoreProratedAnnualForNewYear(currentYear);
}
