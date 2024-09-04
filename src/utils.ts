import { format, toZonedTime } from "date-fns-tz";
import {
  getTime,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInYears,
  addYears,
  addDays,
  addHours,
  addMinutes,
  differenceInSeconds,
} from "date-fns";

export function joinMultiplePaths(...paths: string[]): string {
  return paths
    .map((path) => path.replace(/^\/|\/$/g, "")) // Remove barras do início e do final de cada path
    .filter((path) => path) // Filtra paths vazios
    .join("/"); // Junta todos os paths com uma única barra
}

export function toCamelCase(str: string) {
  return str
    .split("_")
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

export function toPascalCase(str: string) {
  return str
    .split("_")
    .map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

export function getCurrentUTCDate() {
  return toZonedTime(new Date(), "UTC");
}

export function utcTimespamp() {
  return getTime(getCurrentUTCDate());
}

export function formatDate(date: Date, date_format = "yyyy-MM-dd HH:mm:ss") {
  return format(date, date_format);
}

export function formatRemainingTime({
  expiration_timestamp,
  current_timestamp,
  seconds,
  token_type,
}: {
  expiration_timestamp: number;
  current_timestamp: number;
  seconds: number;
  token_type: string;
}) {
  if (seconds <= 0) {
    return `${token_type} has expired.`;
  }

  const expiration = toZonedTime(new Date(expiration_timestamp * 1000), "UTC");
  const current = toZonedTime(new Date(current_timestamp * 1000), "UTC");

  const years = differenceInYears(expiration, current);
  const withoutYears = addYears(current, years);

  const days = differenceInDays(expiration, withoutYears);
  const withoutDays = addDays(withoutYears, days);

  const hours = differenceInHours(expiration, withoutDays);
  const withoutHours = addHours(withoutDays, hours);

  const minutes = differenceInMinutes(expiration, withoutHours);
  const withoutMinutes = addMinutes(withoutHours, minutes);

  const remainingSeconds = differenceInSeconds(expiration, withoutMinutes);

  const parts = [];
  if (years > 0) parts.push(`${years} year(s)`);
  if (days > 0) parts.push(`${days} day(s)`);
  if (hours > 0) parts.push(`${hours} hour(s)`);
  if (minutes > 0) parts.push(`${minutes} minute(s)`);
  if (remainingSeconds > 0) parts.push(`${remainingSeconds} second(s)`);

  return `Remaining ${parts.join(", ")} to expire ${token_type}.`;
}
