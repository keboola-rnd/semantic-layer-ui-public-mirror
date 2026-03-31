import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract bucket from Keboola table ID: "in.c-bucket.table" → "in.c-bucket" */
export function extractBucket(tableId: string): string {
  const lastDot = tableId.lastIndexOf(".");
  return lastDot > 0 ? tableId.substring(0, lastDot) : tableId;
}

/** Format table ID for display: "in.c-crm_data.company" → "company" */
export function shortTableName(tableId: string): string {
  const lastDot = tableId.lastIndexOf(".");
  return lastDot > 0 ? tableId.substring(lastDot + 1) : tableId;
}

/** Truncate string with ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + "\u2026";
}
