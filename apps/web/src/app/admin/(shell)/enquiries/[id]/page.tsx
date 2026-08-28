'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import type { AdminEnquiryDetail } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { AdminBreadcrumb, AdminPageHeader, DemoBadge } from '@/components/admin/data-table';

/** Ordered pipeline stages — drive both the select and the quick-action buttons. */
const PIPELINE_STAGES = [
  { value: 'NEW', label: 'New', tone: 'warn' },
  { value: 'ASSIGNED', label: 'Assigned', tone: 'warn' },
  { value: 'CONTACTED', label: 'Contacted', tone: 'ok' },
  { value: 'TECHNICAL_VERIFICATION', label: 'Technical verification', tone: 'warn' },
  { value: 'QUOTE_REQUIRED', label: 'Quote required', tone: 'warn' },
  { value: 'QUOTED', label: 'Quoted', tone: 'ok' },
  { value: 'FOLLOW_UP', label: 'Follow-up', tone: 'warn' },
  { value: 'WON', label: 'Won', tone: 'ok' },
  { value: 'LOST', label: 'Lost', tone: 'muted' },
] as const;

type Stage = (typeof PIPELINE_STAGES)[number]['value'];

const TONE_CLASSES: Record<string, string> = {
  warn: 'border-amber/50 bg-amber-wash text-amber-900',
  ok: 'border-ok/40 bg-ok/5 text-ok',
  muted: 'border-ink-line bg-ink-wash text-ink-muted',
};

export default function EnquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [enquiry, setEnquiry] = useState<AdminEnquiryDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    adminApi.enquiry(id).then((data) => setEnquiry(data as unknown as AdminEnquiryDetail));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = async (changes: Record<string, unknown>) => {
    setSaving(true);
    try {
      await adminApi.updateEnquiry(id, changes);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const setStatus = (status: Stage) => update({ status });

  if (!enquiry) return <p className="text-sm text-ink-muted">Loading…</p>;

  const currentStage = PIPELINE_STAGES.find((s) => s.value === enquiry.status);

  return (
    <div>
      <AdminBreadcrumb
        items={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Enquiries', href: '/admin/enquiries' },
          { label: enquiry.publicRef },
        ]}
      />
      <AdminPageHeader
        title={
          <>
            {enquiry.publicRef} <DemoBadge isSeedData={enquiry.isSeedData} />
          </>
        }
        description={`Received ${formatDateTime(enquiry.createdAt)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left column ───────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Items */}
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
                      <p className="mt-0.5 font-mono text-xs text-ink-muted">
                        {item.partNumberSnapshot}
                      </p>
                      {item.customerNote && (
                        <p className="mt-1 text-xs italic text-ink-muted">
                          &ldquo;{item.customerNote}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <p>Qty {item.quantity}</p>
                      {item.unitPriceSnapshot && (
                        <p className="text-ink-muted">₹{item.unitPriceSnapshot}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Message */}
          {enquiry.message && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Message
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm">{enquiry.message}</p>
            </section>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Contact / customer info */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Contact
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Name" value={enquiry.contactName} />
              <Row label="Company" value={enquiry.contactCompany ?? '—'} />
              <Row label="Email" value={enquiry.contactEmail ?? '—'} />
              <Row label="Phone" value={enquiry.contactPhone ?? '—'} />
              <Row label="City" value={enquiry.contactCity ?? '—'} />
            </dl>
          </section>

          {/* Pipeline / status */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Pipeline Stage
            </h2>

            {/* Current stage badge */}
            {currentStage && (
              <div
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASSES[currentStage.tone]}`}
              >
                {currentStage.label}
              </div>
            )}

            {/* Quick-action pipeline buttons */}
            <div className="mt-4 flex flex-col gap-2">
              {PIPELINE_STAGES.map((stage) => {
                const isCurrent = enquiry.status === stage.value;
                return (
                  <button
                    key={stage.value}
                    type="button"
                    disabled={isCurrent || saving}
                    onClick={() => setStatus(stage.value)}
                    className={[
                      'rounded-md border px-4 py-2 text-sm font-medium transition-opacity',
                      isCurrent
                        ? 'cursor-default opacity-40'
                        : 'cursor-pointer hover:opacity-80',
                      TONE_CLASSES[stage.tone],
                    ].join(' ')}
                  >
                    {isCurrent ? `✓ ${stage.label}` : `Move to ${stage.label}`}
                  </button>
                );
              })}
            </div>

            {saving && (
              <p className="mt-2 text-xs text-ink-muted">Saving…</p>
            )}
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
