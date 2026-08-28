import Link from 'next/link';
import { ShieldQuestion } from 'lucide-react';

/**
 * The one place the "we have not verified this yet" message is written.
 *
 * §7 forbids guessing compatibility, which means every fitment surface has an
 * empty state — and an empty state a customer meets on four different pages
 * must say the same thing each time, or it reads like a bug rather than a
 * deliberate position. Centralised so it stays one message.
 *
 * Note what this does NOT do: it never says "no compatible parts exist". It
 * says the fitment is unconfirmed and offers a human. Those are very different
 * claims, and only the second one is true.
 */
export function CompatibilityEmpty({
  context,
  className = '',
}: {
  /** What the customer was looking at, e.g. "the RayTools BM111". */
  context?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-ink-line bg-ink-wash p-6 text-center ${className}`}
    >
      <ShieldQuestion className="mx-auto h-8 w-8 text-ink-muted" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-ink">
        Compatibility to be confirmed — please contact LEI
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        We are building our compatibility database and publish fitment only once our engineers have
        verified it
        {context ? `, so ${context} does not have a parts list yet` : ''}. Tell us what you run and
        we will identify the correct part for you.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/quote-request"
          className="inline-flex items-center justify-center rounded-md bg-amber px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-amber-dark"
        >
          Enquire Now
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-md border border-ink-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-amber"
        >
          Contact LEI
        </Link>
      </div>
    </div>
  );
}
