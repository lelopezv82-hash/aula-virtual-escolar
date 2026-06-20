/**
 * Date utility functions for Colombian Timezone (UTC-5)
 */

/**
 * Converts a UTC Date object or string to a local ISO string (YYYY-MM-DDTHH:mm) 
 * representing the date and time in Colombia (UTC-5, no DST).
 */
export function toColombiaISOString(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  
  // Colombia is always UTC-5 (300 minutes behind UTC)
  const colTime = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return colTime.toISOString().slice(0, 16);
}

/**
 * Parses a local datetime-local input string (YYYY-MM-DDTHH:mm) or any date string
 * and returns a Date object in UTC, explicitly treating local string inputs as Colombia Timezone (UTC-5).
 */
export function fromColombiaLocalStringToDate(localStr: string | null | undefined): Date | null {
  if (!localStr || String(localStr).trim() === "") return null;
  const str = String(localStr);
  // If the string already has timezone or offset, parse normally.
  if (str.includes("Z") || str.includes("+") || /-\d{2}:\d{2}$/.test(str)) {
    return new Date(str);
  }
  // Otherwise, treat as Colombia local time by appending the -05:00 offset
  const hasSeconds = str.split(":").length > 2;
  const formattedStr = hasSeconds ? `${str}-05:00` : `${str}:00-05:00`;
  return new Date(formattedStr);
}
