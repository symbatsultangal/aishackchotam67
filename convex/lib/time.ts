function formatInTimeZone(
  value: string | Date,
  timeZone: string,
): Intl.DateTimeFormatPart[] {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
}

export function schoolDateParts(value: string | Date, timeZone: string): {
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = formatInTimeZone(value, timeZone);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    date: `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    year,
    month,
    day,
    hour,
    minute,
  };
}

export function hasCutoffPassed(
  value: string | Date,
  timeZone: string,
  cutoffHour: number,
  cutoffMinute: number,
): boolean {
  const parts = schoolDateParts(value, timeZone);
  return (
    parts.hour > cutoffHour ||
    (parts.hour === cutoffHour && parts.minute >= cutoffMinute)
  );
}

export function isSameSchoolDate(
  value: string | Date,
  schoolDate: string,
  timeZone: string,
): boolean {
  return schoolDateParts(value, timeZone).date === schoolDate;
}

export function nowIsoString(): string {
  return new Date().toISOString();
}
