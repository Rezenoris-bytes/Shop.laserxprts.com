import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { QuoteRequestForm } from '@/components/quote-request-form';

export const metadata: Metadata = {
  title: 'Your quote request',
  robots: { index: false, follow: true },
};

export default async function QuoteRequestPage() {
  // The machine tree lets the customer attach machine context to the whole
  // request in one place, rather than being asked per line.
  const machines = await api.machineTree().catch(() => []);

  return (
    <div className="container-lei max-w-4xl py-8">
      <h1 className="text-2xl font-bold">Your quote request</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Review your items and send them as a single request. We usually respond within one working
        day.
      </p>

      <div className="mt-8">
        <QuoteRequestForm machines={machines} />
      </div>
    </div>
  );
}
