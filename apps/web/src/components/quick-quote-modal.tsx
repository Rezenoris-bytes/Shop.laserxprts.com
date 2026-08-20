'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiRequestError, type ProductCard } from '@/lib/api';
import { mediaUrl } from '@/lib/format';

/**
 * One-step quote request, raised from a product card.
 *
 * The catalogue's full request builder is a basket: add several parts, give a
 * machine, submit once. That is right for someone specifying a job, and far too
 * much for someone who has spotted one part and wants a price. This asks for
 * the three fields the API actually needs and sends it.
 *
 * It posts to the SAME endpoint as the basket — one enquiry pipeline, so a
 * quick request and a full one land in the same admin queue rather than in two
 * places nobody reconciles.
 */
export function QuickQuoteModal({
  product,
  open,
  onClose,
}: {
  product: ProductCard;
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState({ name: '', phone: '', email: '', message: '' });
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // Portals need a DOM, so the first client render is what mounts this.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const openedAt = useRef<number>(0);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    openedAt.current = Date.now();
    // Focus the first field rather than the dialog: the customer came here to
    // type, and it puts a screen reader inside the form immediately.
    firstFieldRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // The page behind a modal must not scroll under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    if (!product.defaultVariant) {
      setFormError('This product cannot be quoted online yet. Please contact us directly.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.submitQuoteRequest({
        contactName: values.name,
        // Empty strings would fail the email/phone format checks; the API wants
        // the field absent when it was not filled in.
        contactEmail: values.email || undefined,
        contactPhone: values.phone || undefined,
        message: values.message || undefined,
        items: [
          {
            variantId: product.defaultVariant.id,
            quantity: product.defaultVariant.minOrderQty,
          },
        ],
        consent: consent as true,
        website,
        elapsedMs: Date.now() - openedAt.current,
      });
      setReference(result.publicRef);
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

  /*
    Rendered into <body>, not where it sits in the tree.

    The card lifts on hover via `transform`, and a transformed ancestor becomes
    the containing block for `position: fixed` — so a modal rendered inside the
    card was laid out against the CARD rather than the viewport, appearing as a
    narrow panel trapped in one grid column. A portal is the fix: the dialog has
    no transformed ancestor once it hangs off <body>.
  */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-quote-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-card bg-white shadow-xl sm:rounded-card"
      >
        <div className="grid md:grid-cols-2">
          {/*
            Product panel. Tinted so the part is the first thing read: the
            customer is quoting THIS item, and showing it beside the fields is
            what stops a request being raised against the wrong one.
          */}
          <div className="border-b border-ink-line bg-ink-wash p-5 md:border-b-0 md:border-r md:p-6">
            <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-card border border-ink-line bg-white">
              {product.image ? (
                <Image
                  src={mediaUrl(product.image.path)}
                  alt={product.image.alt ?? product.name}
                  fill
                  sizes="(max-width: 768px) 60vw, 260px"
                  className="object-contain p-3"
                />
              ) : (
                <div className="h-full w-full bg-ink-wash" />
              )}
            </div>

            {product.brand && (
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {product.brand.name}
              </p>
            )}

            <p id="quick-quote-title" className="mt-1 text-base font-bold leading-snug">
              {product.name}
            </p>

            <p className="mt-1 text-sm font-semibold text-amber-dark">Price on request</p>

            {product.specs.length > 0 && (
              <dl className="mt-4">
                {/* Four rows is what sits beside the form without the column
                    outgrowing it; the rest live on the product's row. */}
                {product.specs.slice(0, 4).map((spec) => (
                  <div
                    key={spec.slug}
                    className="flex justify-between gap-3 border-b border-ink-line py-1.5 text-[11px]"
                  >
                    <dt className="text-ink-muted">{spec.name}</dt>
                    <dd className="text-right font-medium">
                      {spec.value}
                      {spec.unit && <span className="ml-1 text-ink-muted">{spec.unit}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Form panel. */}
          <div className="relative p-5 md:p-6">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 rounded p-1.5 text-ink-muted hover:bg-ink-wash hover:text-ink"
            >
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden
              >
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>

            {reference ? (
              <div className="flex h-full flex-col justify-center py-10 text-center">
                <p className="text-lg font-bold">Request received</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
                  Your reference is <span className="font-semibold text-ink">{reference}</span>. Our
                  team will respond within one working day.
                </p>
                <div>
                  <button type="button" onClick={onClose} className="btn-secondary mt-6 text-sm">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="pr-8 text-lg font-bold leading-snug">Request a quote</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  Tell us how to reach you and we will send pricing and availability.
                </p>

                {product.variantCount > 1 && (
                  <p className="mt-3 rounded border border-ink-line bg-ink-wash px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
                    This part comes in {product.variantCount} options. We will confirm the exact one
                    with you — or{' '}
                    <Link href={productRowHref(product)} className="font-medium underline">
                      choose it yourself
                    </Link>
                    .
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  <Field label="Your name" htmlFor="qq-name" required error={errors.contactName}>
                    <input
                      ref={firstFieldRef}
                      id="qq-name"
                      value={values.name}
                      onChange={(event) => set('name', event.target.value)}
                      autoComplete="name"
                      className="field"
                      required
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Phone" htmlFor="qq-phone" error={errors.contactPhone}>
                      <input
                        id="qq-phone"
                        value={values.phone}
                        onChange={(event) => set('phone', event.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="+91"
                        className="field"
                      />
                    </Field>

                    <Field label="Email" htmlFor="qq-email" error={errors.contactEmail}>
                      <input
                        id="qq-email"
                        type="email"
                        value={values.email}
                        onChange={(event) => set('email', event.target.value)}
                        autoComplete="email"
                        className="field"
                      />
                    </Field>
                  </div>

                  <p className="text-[11px] text-ink-muted">
                    A phone number or an email — whichever you prefer we use.
                  </p>

                  <Field label="Message" htmlFor="qq-message" error={errors.message}>
                    <textarea
                      id="qq-message"
                      value={values.message}
                      onChange={(event) => set('message', event.target.value)}
                      rows={3}
                      placeholder="Quantity, machine model, anything else"
                      className="field"
                    />
                  </Field>
                </div>

                {/* Honeypot: off-screen rather than display:none, which some bots skip. */}
                <div className="absolute left-[-9999px]" aria-hidden>
                  <label htmlFor="qq-website">Website</label>
                  <input
                    id="qq-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </div>

                <label className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5"
                    required
                  />
                  <span>
                    I agree to be contacted about this enquiry, as described in the{' '}
                    <Link href="/privacy" className="underline">
                      privacy policy
                    </Link>
                    .
                  </span>
                </label>

                {formError && <p className="mt-3 text-xs text-bad">{formError}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary mt-4 w-full text-sm"
                >
                  {submitting ? 'Sending…' : 'Request a quote'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function productRowHref(product: ProductCard): string {
  return product.category
    ? `/catalogue?category=${product.category.slug}#${product.slug}`
    : `/catalogue#${product.slug}`;
}

function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="text-bad"> *</span>}
      </label>
      {children}
      {error?.[0] && <p className="mt-1 text-[11px] text-bad">{error[0]}</p>}
    </div>
  );
}
