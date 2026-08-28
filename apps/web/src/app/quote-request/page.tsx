import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { QuoteRequestForm } from '@/components/quote-request-form';

export const metadata: Metadata = {
  title: 'Your enquiry',
  robots: { index: false, follow: true },
};

export default async function QuoteRequestPage() {
  // The machine tree lets the customer attach machine context to the whole
  // request in one place, rather than being asked per line.
  // Two separate trees (§8): a cutting head is not a machine.
  const [machines, heads] = await Promise.all([
    api.machineTree().catch(() => []),
    api.componentTree('cutting-heads').catch(() => []),
  ]);

  return (
    <div className="container-lei max-w-4xl py-8">
      <h1 className="text-2xl font-bold">Your enquiry</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Review your items and send them as a single request. We usually respond within one working
        day.
      </p>

      <div className="mt-8">
        <QuoteRequestForm machines={machines} heads={heads} />
      </div>
    </div>
  );
}
