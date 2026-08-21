/** Shared birthday date helpers (Asia/Karachi calendar). */

export const BIRTHDAY_TIMEZONE = "Asia/Karachi";

export function getKarachiDateParts(date: Date = new Date()): {
  year: number;
  month: number; // 1-12
  day: number;
  dateStr: string; // YYYY-MM-DD
  monthDay: string; // MM-DD
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BIRTHDAY_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "0", 10);
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "0", 10);
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");

  return {
    year,
    month,
    day,
    dateStr: `${year}-${monthStr}-${dayStr}`,
    monthDay: `${monthStr}-${dayStr}`,
  };
}

/**
 * Parse a YYYY-MM-DD calendar date into a Date stored at UTC noon.
 * Noon avoids day-boundary shifts across timezones when using $month/$dayOfMonth.
 */
export function parseCalendarDateToUtcNoon(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** Calendar month (1-12) / day from a stored DOB (UTC components). */
export function getStoredBirthMonthDay(dob: Date): { month: number; day: number; monthDay: string } {
  const month = dob.getUTCMonth() + 1;
  const day = dob.getUTCDate();
  return {
    month,
    day,
    monthDay: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Shift a Karachi calendar date by N days and return MM-DD. */
export function shiftKarachiMonthDay(base: Date, dayOffset: number): string {
  const shifted = new Date(base.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  return getKarachiDateParts(shifted).monthDay;
}

/**
 * Mongo $expr clause: DOB calendar month/day (UTC) matches one of the given MM-DD keys.
 * Works with DOBs stored as UTC midnight or UTC noon of the intended calendar day.
 */
export function mongoDobMatchesMonthDays(monthDays: string[]): Record<string, unknown> {
  return {
    $expr: {
      $in: [
        {
          $dateToString: {
            format: "%m-%d",
            date: "$dateOfBirth",
            timezone: "UTC",
          },
        },
        monthDays,
      ],
    },
  };
}
