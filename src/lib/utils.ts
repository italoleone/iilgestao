import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Brazilian currency: R$ 1.000,00 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parse a Brazilian-formatted currency string to a number: "12.050,89" → 12050.89 */
export function parseBRL(input: string): number {
  const cleaned = input.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a YYYY-MM-DD string as a LOCAL date (no timezone shift).
 * Prevents the -1 day bug caused by `new Date("YYYY-MM-DD")` parsing as UTC.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a YYYY-MM-DD string as DD/MM/YYYY for display, without timezone issues. */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}
