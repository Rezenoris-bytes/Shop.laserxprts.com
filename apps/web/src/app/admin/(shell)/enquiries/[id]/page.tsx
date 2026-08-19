'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import type { AdminEnquiryDetail } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { AdminPageHeader, DemoBadge } from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

const STATUS_OPTIONS = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'QUOTED', 'CLOSED_WON', 'CLOSED_LOST', 'SPAM'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function EnquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auth = useAdminAuth();
  const id = Number(params.id);

  const [enquiry, setEnquiry] = useState<AdminEnquiryDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.enquiry(id).then((data) => setEnquiry(data as unknown as AdminEnquiryDetail));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canUpdate = auth.hasPermission('ENQUIRIES', 'update');
  const canCreateQuote = auth.hasPermission('QUOTES', 'create');

  const update = async (changes: Record<string, unknown>) => {
    setSaving(true);
    try {
      await adminApi.updateEnquiry(id, changes);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = () => update({ status: 'ACKNOWLEDGED' });
  const assignToMe = () => update({ assignedToId: auth.user?.id });

  if (!enquiry) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div>
      <AdminPageHeader
        title={
          <>
            {enquiry.publicRef} <DemoBadge isSeedData={enquiry.isSeedData} />
          </>
        }
        description={`Received ${formatDateTime(enquiry.createdAt)}`}
        action={
          canCreateQuote && (
            <button
              type="button"
              onClick={() => router.push('/admin/quotes')}
              className="btn-primary"
            >
              Create Quote
            </button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Items — pre-populates the quote builder with no retyping. */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Items ({enquiry.items.length})
            </h2>
            <ul className="mt-3 divide-y divide-ink-line">
              {enquiry.items.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.productNameSnapshot}</p>
                      <p className="mt-0.5 font-mono text-xs text-ink-muted">{item.partNumberSnapshot}</p>
                      {item.customerNote && (
                        <p className="mt-1 text-xs italic text-ink-muted">&ldquo;{item.customerNote}&rdquo;</p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <p>Qty {item.quantity}</p>
                      {item.unitPriceSnapshot && <p className="text-ink-muted">₹{item.unitPriceSnapshot}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {enquiry.message && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Message</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{enquiry.message}</p>
            </section>
          )}

          {enquiry.spamScore > 30 && (
            <div className="rounded-card border border-amber/40 bg-amber-wash px-4 py-3 text-sm">
              Spam score {enquiry.spamScore}/100 — review before acting on this enquiry.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Contact</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Name" value={enquiry.contactName} />
              <Row label="Company" value={enquiry.contactCompany ?? '—'} />
              <Row label="Email" value={enquiry.contactEmail ?? '—'} />
              <Row label="Phone" value={enquiry.contactPhone ?? '—'} />
              <Row label="City" value={enquiry.contactCity ?? '—'} />
            </dl>
            {enquiry.customer && (
              <a
                href={`/admin/customers/${enquiry.customer.id}`}
                className="mt-3 block text-xs font-medium text-ink underline"
              >
                View customer record →
              </a>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Status</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="status" className="label">
                  Status
                </label>
                <select
                  id="status"
                  value={enquiry.status}
                  disabled={!canUpdate || saving}
                  onChange={(event) => update({ status: event.target.value })}
                  className="field"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="priority" className="label">
                  Priority
                </label>
                <select
                  id="priority"
                  value={enquiry.priority}
                  disabled={!canUpdate || saving}
                  onChange={(event) => update({ priority: event.target.value })}
                  className="field"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {canUpdate && enquiry.status === 'NEW' && (
                <button type="button" onClick={acknowledge} disabled={saving} className="btn-secondary w-full text-xs">
                  Mark acknowledged
                </button>
              )}
              {canUpdate && !enquiry.assignedTo && (
                <button type="button" onClick={assignToMe} disabled={saving} className="btn-secondary w-full text-xs">
                  Assign to me
                </button>
              )}
              {enquiry.assignedTo && (
                <p className="text-xs text-ink-muted">Assigned to {enquiry.assignedTo.name}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
