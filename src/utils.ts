import { format, toZonedTime } from "date-fns-tz";

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

export function formatDate(date: Date, date_format = "yyyy-MM-dd HH:mm:ss") {
  return format(date, date_format);
}
