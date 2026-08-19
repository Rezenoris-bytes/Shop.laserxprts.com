import type { Metadata } from 'next';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of use',
  alternates: { canonical: canonical('/terms') },
};

export default function TermsPage() {
  return (
    <div className="container-lei max-w-2xl py-12">
      <h1 className="text-2xl font-bold">Terms of use</h1>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink-muted">
        <p className="rounded-md bg-amber-wash px-4 py-3 text-xs text-ink">
          Draft for review. LEI must confirm this text before launch.
        </p>

        <section>
          <h2 className="text-base font-semibold text-ink">Quotations, not orders</h2>
          <p className="mt-1.5">
            Submitting a quote request does not create an order and takes no payment. We respond
            with a quotation; an order is placed only when you accept it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Pricing</h2>
          <p className="mt-1.5">
            Prices shown are indicative, in INR, and exclusive of GST and freight unless stated.
            The quotation we issue governs.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Compatibility information</h2>
          <p className="mt-1.5">
            Compatibility data is provided to help you identify parts and is not a warranty of
            fitment. Please confirm with our team before ordering if you are unsure.
          </p>
        </section>
      </div>
    </div>
  );
}
