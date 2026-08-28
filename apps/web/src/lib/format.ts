/**
 * Display formatting.
 *
 * Deliberately NOT in quote-request.tsx: that module is 'use client', and a
 * server component calling a function exported from a client module is a build
 * error. Formatting is pure and belongs to both sides.
 */

/**
 * Indian rupee formatting, with the lakh/crore digit grouping.
 *
 * Retained for the admin side, which legitimately shows money. It has NO
 * callers on the storefront and must not gain any: the public site is
 * enquiry-led and shows no figure and no pricing language anywhere.
 *
 * The old null branch returned the string "Price on request", which is why
 * that phrase could reappear on any page that formatted a missing price. It
 * now returns an em dash — a formatter should not be a place where public
 * copy is decided.
 */
export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
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

/**
 * Public URL for a stored file.
 *
 * The API serves its storage root at /uploads, and `path` is the location
 * within it ("products/<sha256>.jpg"). Filenames are the SHA-256 of the bytes,
 * so a URL always denotes the same image and is cached immutably.
 */
export function mediaUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  return `${base.replace(/\/$/, '')}/uploads/${path.replace(/^\//, '')}`;
}
