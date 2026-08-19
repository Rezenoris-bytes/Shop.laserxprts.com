/**
 * Display formatting.
 *
 * Deliberately NOT in quote-request.tsx: that module is 'use client', and a
 * server component calling a function exported from a client module is a build
 * error. Formatting is pure and belongs to both sides.
 */

/** Indian rupee formatting, with the lakh/crore digit grouping. */
export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Price on request';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Dates are stored UTC and displayed in IST. */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}
