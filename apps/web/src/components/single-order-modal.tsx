'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiRequestError } from '@/lib/api';
import { PhoneInput } from '@/components/phone-input';

export interface SingleOrderItem {
  variantId: number;
  variantName: string;
  minOrderQty: number;
}

type Step = 'choice' | 'bulk-qty' | 'contact' | 'success';

export function SingleOrderModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: SingleOrderItem | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('choice');
  const [orderType, setOrderType] = useState<'single' | 'bulk'>('single');
  const [bulkQty, setBulkQty] = useState(10);

  const [values, setValues] = useState({ name: '', phone: '', email: '', company: '', message: '' });
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const openedAt = useRef<number>(0);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset everything when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStep('choice');
      setOrderType('single');
      setBulkQty(10);
      setValues({ name: '', phone: '', email: '', company: '', message: '' });
      setConsent(false);
      setErrors({});
      setFormError(null);
      setReference(null);
      return;
    }
    openedAt.current = Date.now();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Focus first field when contact step appears
  useEffect(() => {
    if (step === 'contact') {
      window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [step]);

  if (!open || !mounted || !item) return null;

  const finalQty = orderType === 'single' ? 1 : bulkQty;
  const minQty = item.minOrderQty ?? 1;
  const set = (key: keyof typeof values, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSingleChoice = () => {
    setOrderType('single');
    setStep('contact');
  };

  const handleBulkChoice = () => {
    setOrderType('bulk');
    setBulkQty(Math.max(minQty, 10));
    setStep('bulk-qty');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    if (!values.name.trim()) {
      setErrors({ contactName: ['Name is required'] });
      return;
    }
    if (!values.phone.trim() && !values.email.trim()) {
      setErrors({ contactPhone: ['Please provide a phone or email'] });
      return;
    }
    if (!consent) {
      setErrors({ consent: ['Please accept to continue'] });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.submitQuoteRequest({
        contactName: values.name,
        contactEmail: values.email || undefined,
        contactPhone: values.phone || undefined,
        contactCompany: values.company || undefined,
        message: values.message || undefined,
        items: [{ variantId: item.variantId, quantity: finalQty }],
        consent: true,
        website,
        elapsedMs: Date.now() - openedAt.current,
      });
      setReference(result.publicRef);
      setStep('success');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fields ?? {});
        setFormError(error.fields ? null : error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-line px-6 py-4">
          <div>
            <h2 id="order-modal-title" className="text-base font-bold text-ink">
              {step === 'choice' && 'How would you like to order?'}
              {step === 'bulk-qty' && 'Set bulk quantity'}
              {step === 'contact' && (orderType === 'single' ? 'Single order — your details' : `Bulk order — ${bulkQty} pcs`)}
              {step === 'success' && 'Order request sent!'}
            </h2>
            {/* SKU withheld from customers; it still reaches sales with the order. */}
            <p className="mt-0.5 text-xs text-ink-muted">{item.variantName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-ink-wash hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Step: choice ── */}
        {step === 'choice' && (
          <div className="space-y-3 px-6 py-6">
            {/* Single */}
            <button
              type="button"
              onClick={handleSingleChoice}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-ink-line p-5 text-left
                         transition-all hover:border-ink hover:bg-ink-wash"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber text-xl font-black text-ink">
                1
              </span>
              <div>
                <p className="text-base font-bold text-ink">Single order</p>
                <p className="mt-0.5 text-sm text-ink-muted">Order 1 piece — we'll confirm pricing and delivery</p>
              </div>
              <ChevronIcon className="ml-auto shrink-0 text-ink-muted" />
            </button>

            {/* Bulk */}
            <button
              type="button"
              onClick={handleBulkChoice}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-ink-line p-5 text-left
                         transition-all hover:border-amber hover:bg-amber-wash"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-base font-black text-white">
                10+
              </span>
              <div>
                <p className="text-base font-bold text-ink">Bulk enquiry</p>
                <p className="mt-0.5 text-sm text-ink-muted">Tell us how many you need and our team will come back to you</p>
              </div>
              <ChevronIcon className="ml-auto shrink-0 text-ink-muted" />
            </button>
          </div>
        )}

        {/* ── Step: bulk-qty ── */}
        {step === 'bulk-qty' && (
          <div className="px-6 py-6">
            <p className="text-sm text-ink-muted">How many pieces do you need?</p>

            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setBulkQty((q) => Math.max(minQty, q - 1))}
                disabled={bulkQty <= minQty}
                className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink-line text-xl
                           font-bold text-ink-muted transition-colors hover:border-ink hover:text-ink
                           disabled:opacity-40"
              >
                −
              </button>
              <input
                type="number"
                min={minQty}
                value={bulkQty}
                onChange={(e) => setBulkQty(Math.max(minQty, Number(e.target.value) || minQty))}
                className="h-16 w-28 rounded-xl border-2 border-amber text-center text-3xl font-bold
                           text-ink [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-amber
                           [&::-webkit-inner-spin-button]:appearance-none
                           [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setBulkQty((q) => q + 1)}
                className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink-line text-xl
                           font-bold text-ink-muted transition-colors hover:border-ink hover:text-ink"
              >
                +
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-ink-muted">pieces</p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep('choice')}
                className="flex-1 rounded-xl border-2 border-ink-line py-3 text-sm font-semibold text-ink-muted
                           transition-colors hover:border-ink hover:text-ink"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('contact')}
                className="flex-1 rounded-xl bg-amber py-3 text-sm font-bold text-ink
                           transition-colors hover:bg-amber-dark"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step: contact form ── */}
        {step === 'contact' && (
          <form onSubmit={submit} className="space-y-4 px-6 pb-6 pt-4">
            {/* Order summary pill */}
            <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-wash px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber text-sm font-black text-ink">
                {finalQty}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.variantName}</p>
                <p className="text-xs text-ink-muted">
                  {finalQty} {finalQty === 1 ? 'pc' : 'pcs'}
                </p>
              </div>
            </div>

            <p className="text-sm text-ink-muted">Fill in your details and we'll confirm pricing.</p>

            <Field label="Your name" htmlFor="so-name" required error={errors.contactName}>
              <input
                ref={firstFieldRef}
                id="so-name"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                autoComplete="name"
                placeholder="Rajesh Kumar"
                className="field"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone" htmlFor="so-phone" error={errors.contactPhone}>
                <PhoneInput
                  id="so-phone"
                  value={values.phone}
                  onChange={(val) => set('phone', val)}
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Email" htmlFor="so-email" error={errors.contactEmail}>
                <input
                  id="so-email"
                  type="email"
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="field"
                />
              </Field>
            </div>
            <p className="text-[11px] text-ink-muted">Provide at least a phone or email.</p>

            <Field label="Company" htmlFor="so-company" error={errors.contactCompany}>
              <input
                id="so-company"
                value={values.company}
                onChange={(e) => set('company', e.target.value)}
                autoComplete="organization"
                placeholder="Optional"
                className="field"
              />
            </Field>

            <Field label="Message" htmlFor="so-message" error={errors.message}>
              <textarea
                id="so-message"
                value={values.message}
                onChange={(e) => set('message', e.target.value)}
                rows={2}
                placeholder="Delivery requirements, machine model, anything else…"
                className="field"
              />
            </Field>

            {/* Honeypot */}
            <div className="absolute left-[-9999px]" aria-hidden>
              <label htmlFor="so-website">Website</label>
              <input id="so-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 shrink-0" />
              <span>
                I agree that LEI may contact me about this request.{' '}
                <Link href="/privacy" className="underline">Privacy policy</Link>.
              </span>
            </label>
            {errors.consent && <p className="text-xs text-bad">{errors.consent[0]}</p>}

            {formError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-bad">{formError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(orderType === 'bulk' ? 'bulk-qty' : 'choice')}
                className="rounded-xl border-2 border-ink-line px-5 py-3 text-sm font-semibold text-ink-muted
                           transition-colors hover:border-ink hover:text-ink"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-amber py-3 text-sm font-bold text-ink
                           transition-colors hover:bg-amber-dark disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send order request'}
              </button>
            </div>

            <p className="text-center text-[11px] text-ink-muted">
              No payment now. We'll confirm pricing &amp; delivery first.
            </p>
          </form>
        )}

        {/* ── Step: success ── */}
        {step === 'success' && (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-50">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m5 13 4 4L19 7" stroke="#1d7a4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-bold">Order request sent!</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
              Our team will get back to you with pricing and confirmation within one working day.
            </p>
            <div className="mt-4 inline-block rounded-xl bg-ink-wash px-6 py-3">
              <p className="text-xs text-ink-muted">Your reference</p>
              <p className="mt-0.5 font-mono text-xl font-bold tracking-wide">{reference}</p>
            </div>
            <div className="mt-6">
              <button type="button" onClick={onClose} className="btn-secondary text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, htmlFor, required, error, children }: {
  label: string; htmlFor: string; required?: boolean; error?: string[]; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}{required && <span className="ml-0.5 text-bad">*</span>}
      </label>
      {children}
      {error?.[0] && <p className="mt-1 text-[11px] text-bad">{error[0]}</p>}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
