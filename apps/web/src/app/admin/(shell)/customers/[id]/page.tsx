'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { AdminPageHeader, StatusChip } from '@/components/admin/data-table';
import { formatDateTime } from '@/lib/format';

interface CustomerDetail {
  id: number;
  companyName: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  stateCode: string | null;
  status: string;
  isVerified: boolean;
  notes: string | null;
  enquiries: Array<{ id: number; publicRef: string; status: string; createdAt: string }>;
  quotes: Array<{ id: number; quoteNumber: string; status: string; createdAt: string }>;
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    adminApi.customer(id).then((data) => setCustomer(data as CustomerDetail));
  }, [id]);

  if (!customer) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div>
      <AdminPageHeader title={customer.companyName ?? customer.contactName} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Enquiries
            </h2>
            {customer.enquiries.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">None yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-line">
                {customer.enquiries.map((enquiry) => (
                  <li key={enquiry.id} className="flex items-center justify-between py-2 text-sm">
                    <a
                      href={`/admin/enquiries/${enquiry.id}`}
                      className="font-mono text-xs underline"
                    >
                      {enquiry.publicRef}
                    </a>
                    <span className="text-ink-muted">{formatDateTime(enquiry.createdAt)}</span>
                    <StatusChip label={enquiry.status} tone="muted" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Quotes</h2>
            {customer.quotes.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">None yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-line">
                {customer.quotes.map((quote) => (
                  <li key={quote.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-xs">{quote.quoteNumber}</span>
                    <span className="text-ink-muted">{formatDateTime(quote.createdAt)}</span>
                    <StatusChip label={quote.status} tone="muted" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card h-fit space-y-2 p-5 text-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Details</h2>
          <Row label="Contact" value={customer.contactName} />
          <Row label="Email" value={customer.email ?? '—'} />
          <Row label="Phone" value={customer.phone ?? '—'} />
          <Row label="GSTIN" value={customer.gstin ?? '—'} />
          <Row label="State code" value={customer.stateCode ?? '—'} />
          <Row label="Status" value={customer.status} />
          <Row
            label="Verified"
            value={customer.isVerified ? 'Yes' : 'No — auto-created from a public form'}
          />
          {customer.notes && (
            <div className="pt-2">
              <p className="text-ink-muted">Notes</p>
              <p className="mt-1 whitespace-pre-line">{customer.notes}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
