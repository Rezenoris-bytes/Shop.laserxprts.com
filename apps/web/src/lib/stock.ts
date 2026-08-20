/** Stock presentation. Empty and edge states are designed, not accidental. */
export function stockLabel(status: string): {
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
} {
  switch (status) {
    case 'IN_STOCK':
      return { label: 'In stock', tone: 'ok' };
    case 'LOW_STOCK':
      return { label: 'Low stock', tone: 'warn' };
    case 'OUT_OF_STOCK':
      return { label: 'Out of stock', tone: 'bad' };
    case 'MADE_TO_ORDER':
      return { label: 'Made to order', tone: 'muted' };
    case 'DISCONTINUED':
      return { label: 'Discontinued', tone: 'bad' };
    default:
      return { label: 'Availability on request', tone: 'muted' };
  }
}

export const stockToneClass: Record<'ok' | 'warn' | 'bad' | 'muted', string> = {
  ok: 'bg-green-50 text-ok',
  warn: 'bg-amber-wash text-warn',
  bad: 'bg-red-50 text-bad',
  muted: 'bg-ink-wash text-ink-muted',
};
