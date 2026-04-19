import { schoolDateParts } from "./time";

/**
 * Parse a free-form due-date hint into an ISO-8601 timestamp interpreted in
 * the school's timezone. Returns null if we can't pull a date out — callers
 * should fall back to leaving dueAt empty and letting the UI set it.
 *
 * Handles:
 *   - ISO dates/datetimes passed through as-is
 *   - "today"/"сегодня" + optional HH:MM
 *   - "tomorrow"/"завтра" + optional HH:MM
 *   - "в пятницу", "friday", weekday names in ru/en (next occurrence)
 *   - "через N дней" / "in N days"
 *   - Plain HH:MM (assumed today)
 */
export function parseDueText(
  raw: string | undefined,
  referenceIso: string,
  timeZone: string,
): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  // Straight ISO string: trust it.
  const isoGuess = text.match(/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  if (isoGuess) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const normalized = text.toLocaleLowerCase();
  const refParts = schoolDateParts(referenceIso, timeZone);

  // Pull an HH:MM time hint if present.
  const timeMatch = normalized.match(/(\d{1,2})[:.](\d{2})/);
  const hour = timeMatch ? Math.min(23, Math.max(0, Number(timeMatch[1]))) : 17;
  const minute = timeMatch ? Math.min(59, Math.max(0, Number(timeMatch[2]))) : 0;

  let targetDayOffset: number | null = null;

  // Relative-day keywords. Use (?:^|\s|,) instead of \b since \b doesn't
  // recognize Cyrillic word boundaries in all JS engines.
  if (/(?:^|\s|,)(today|сегодня|бугун)(?:\s|,|$)/.test(normalized)) {
    targetDayOffset = 0;
  } else if (/(?:^|\s|,)(tomorrow|завтра|ертең|ertengi|erten)(?:\s|,|$)/.test(normalized)) {
    targetDayOffset = 1;
  } else {
    const inDaysMatch = normalized.match(/(?:in|через)\s+(\d+)\s*(?:days?|дн|дня|дней)/);
    if (inDaysMatch) {
      targetDayOffset = Number(inDaysMatch[1]);
    }
  }

  if (targetDayOffset === null) {
    const weekdayMap: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
      понедельник: 1,
      пн: 1,
      вторник: 2,
      вт: 2,
      среда: 3,
      ср: 3,
      среду: 3,
      четверг: 4,
      чт: 4,
      пятница: 5,
      пт: 5,
      пятницу: 5,
      суббота: 6,
      сб: 6,
      субботу: 6,
      воскресенье: 0,
      вс: 0,
    };
    for (const [keyword, weekday] of Object.entries(weekdayMap)) {
      if (new RegExp(`(?:^|\\s|,|в\\s*)${keyword}(?:\\s|,|$)`).test(normalized)) {
        const refDate = new Date(
          Date.UTC(refParts.year, refParts.month - 1, refParts.day),
        );
        const refWeekday = refDate.getUTCDay();
        let diff = weekday - refWeekday;
        if (diff <= 0) diff += 7;
        targetDayOffset = diff;
        break;
      }
    }
  }

  if (targetDayOffset === null && timeMatch) {
    // Plain HH:MM with no date hint → today.
    targetDayOffset = 0;
  }

  if (targetDayOffset === null) {
    return null;
  }

  // Build the school-local date, then reconstruct to UTC by finding the
  // UTC moment whose localized parts match the target. Approximate by
  // walking the UTC timestamp an hour at a time within a ±1 day window.
  // (Good enough for 1-minute precision without pulling in tz libs.)
  const target = new Date(
    Date.UTC(refParts.year, refParts.month - 1, refParts.day + targetDayOffset, hour, minute),
  );
  // Adjust for timezone offset at the target moment. Use a single Intl
  // round-trip: compute what local parts target currently renders as, then
  // shift UTC by the difference.
  const localParts = schoolDateParts(target.toISOString(), timeZone);
  const desiredUtc = Date.UTC(
    refParts.year,
    refParts.month - 1,
    refParts.day + targetDayOffset,
    hour,
    minute,
  );
  const renderedUtc = Date.UTC(
    localParts.year,
    localParts.month - 1,
    localParts.day,
    localParts.hour,
    localParts.minute,
  );
  const delta = desiredUtc - renderedUtc;
  const final = new Date(target.getTime() + delta);
  if (Number.isNaN(final.getTime())) return null;
  return final.toISOString();
}
