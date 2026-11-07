const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatHolidayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}, ${ordinal(day)} ${MONTHS[month - 1]} ${year}`;
}

export function nextOfficeDay(endDate: string): string {
  const [year, month, day] = endDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const iso = date.toISOString().slice(0, 10);
  return formatHolidayDate(iso);
}

export function holidaySubject(title: string): string {
  return `Holiday Announcement – ${title.trim() || "Public Holiday"}`;
}

export function buildHolidayAnnouncement(input: {
  title: string;
  startDate: string;
  endDate: string;
}): string {
  const title = input.title.trim() || "Public Holiday";
  const startLabel = formatHolidayDate(input.startDate);
  const sameDay = input.startDate === input.endDate;
  const observed = sameDay ? startLabel : `${startLabel} to ${formatHolidayDate(input.endDate)}`;
  const closedOn = sameDay
    ? startLabel.split(",")[0]
    : `${startLabel.split(",")[0]} through ${formatHolidayDate(input.endDate).split(",")[0]}`;
  const resume = nextOfficeDay(input.endDate);

  return `📢 Holiday Announcement – ${title}

To: All Departments

Dear Team,

Please be informed that ${observed} will be observed as a public holiday on account of ${title}.

The office will remain closed on ${closedOn}, and regular operations will resume on ${resume}.

Enjoy your holiday!

Regards,
Sync Up Management`;
}
