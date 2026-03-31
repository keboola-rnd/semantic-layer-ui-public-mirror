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

/** Format ISO date to relative time (e.g. "3 days ago") or short date */
export function timeAgo(iso: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Format ISO date to full readable string */
export function formatDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
