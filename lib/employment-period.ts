const LIFECYCLE_TYPES = new Set(["Internship", "Probation"]);
const DEFAULT_DURATION_MONTHS = 3;

export type PeriodSource = {
  employmentType?: string | null;
  reviewStatus?: string | null;
  joinDate?: Date | string | null;
  lifecycleDurationMonths?: number | null;
  periodEndDate?: Date | string | null;
  probationEndDate?: Date | string | null;
  internshipEndDate?: Date | string | null;
};

export function parseValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addCalendarMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

export function storedPeriodEnd(source: PeriodSource): Date | null {
  return (
    parseValidDate(source.periodEndDate) ||
    parseValidDate(source.probationEndDate) ||
    parseValidDate(source.internshipEndDate)
  );
}

export function durationMonthsOrDefault(value: number | null | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_DURATION_MONTHS;
}

/**
 * Older probation/internship profiles were saved without an end date, so their
 * review status stayed "Pending" even after the period had finished.
 * When no end date is stored, the review date is join date + duration.
 */
export function effectiveEmploymentPeriod(source: PeriodSource, now = new Date()) {
  const employmentType = source.employmentType || "";
  const storedStatus = source.reviewStatus || "Pending";
  const storedEnd = storedPeriodEnd(source);
  const durationMonths = durationMonthsOrDefault(source.lifecycleDurationMonths);
  const joinDate = parseValidDate(source.joinDate);

  if (!LIFECYCLE_TYPES.has(employmentType)) {
    return {
      reviewStatus: storedStatus,
      periodEndDate: storedEnd,
      durationMonths: source.lifecycleDurationMonths ?? null,
    };
  }

  const periodEndDate = storedEnd ?? (joinDate ? addCalendarMonths(joinDate, durationMonths) : null);
  const periodHasEnded = periodEndDate ? periodEndDate.getTime() <= now.getTime() : false;
  const reviewStatus =
    storedStatus === "Completed"
      ? storedStatus
      : storedStatus === "Due Review" || periodHasEnded
        ? "Due Review"
        : storedStatus;

  return {
    reviewStatus,
    periodEndDate,
    durationMonths,
  };
}

export function isEmploymentPeriodDue(source: PeriodSource, now = new Date()): boolean {
  return effectiveEmploymentPeriod(source, now).reviewStatus === "Due Review";
}
