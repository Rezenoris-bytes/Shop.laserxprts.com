'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { quoteRequestSchema } from '@lei/shared';
import { ApiRequestError, api, type MachineBrandNode } from '@/lib/api';
import { useQuoteRequest } from '@/lib/quote-request';
import { formatInr } from '@/lib/format';

/**
 * Quote Request review and submission.
 *
 * Field discipline is deliberate: name, phone/email, company, city, message.
 * GSTIN is a SALES field collected later by an admin, not a barrier on a public
 * form. Every extra field here is drop-off on the site's primary conversion.
 *
 * Validation uses the same Zod schema the API validates against, imported from
 * @lei/shared — so client and server rules cannot drift.
 */
export function QuoteRequestForm({ machines }: { machines: MachineBrandNode[] }) {
  const { resolved, unavailable, setQuantity, setNote, remove, clear, isLoading } =
    useQuoteRequest();

  const [values, setValues] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactCompany: '',
    contactCity: '',
    message: '',
    machineBrandId: '',
    machineModelId: '',
    consent: false,
    website: '', // honeypot
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ publicRef: string; itemCount: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Time on form. A submission under ~2s is automated; recorded as a spam
  // signal server-side rather than used to block outright.
  const startedAt = useRef(Date.now());

  const models = useMemo(
    () => machines.find((brand) => String(brand.id) === values.machineBrandId)?.models ?? [],
    [machines, values.machineBrandId],
  );

  const estimate = resolved.reduce((sum, line) => {
    const price = line.resolved?.price;
    return price === null || price === undefined ? sum : sum + price * line.quantity;
  }, 0);

  const set = (key: keyof typeof values, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const payload = {
      contactName: values.contactName,
      contactEmail: values.contactEmail || undefined,
      contactPhone: values.contactPhone || undefined,
      contactCompany: values.contactCompany || undefined,
      contactCity: values.contactCity || undefined,
      message: values.message || undefined,
      machineBrandId: values.machineBrandId ? Number(values.machineBrandId) : undefined,
      machineModelId: values.machineModelId ? Number(values.machineModelId) : undefined,
      items: resolved
        .filter((line) => line.resolved !== null)
        .map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          note: line.note || undefined,
        })),
      consent: values.consent,
      website: values.website || undefined,
      elapsedMs: Date.now() - startedAt.current,
    };

    const parsed = quoteRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_';
        (fieldErrors[key] ??= []).push(issue.message);
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await api.submitQuoteRequest(parsed.data);
      setResult({ publicRef: response.publicRef, itemCount: response.itemCount });
      clear();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.fields) setErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again, or call us directly.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <SuccessPanel result={result} />;

  const usableLines = resolved.filter((line) => line.resolved !== null);

  if (!isLoading && resolved.length === 0) {
    return (
      <div className="card px-6 py-14 text-center">
        <p className="text-base font-semibold">Your quote request is empty</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          Add the parts you need and send them as one request.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/catalogue" className="btn-secondary text-sm">
            Browse catalogue
          </Link>
          <Link href="/compatibility" className="btn-primary text-sm">
            Find parts for my machine
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="text-base font-bold">Items ({usableLines.length})</h2>

        {unavailable.length > 0 && (
          <div className="mt-3 rounded-card border border-amber/40 bg-amber-wash px-4 py-3 text-sm">
            {unavailable.length} item(s) in your request are no longer available and have been
            excluded.
          </div>
        )}

        <ul className="mt-4 divide-y divide-ink-line border-y border-ink-line">
          {resolved.map((line) => (
            <li key={line.variantId} className="py-4">
              {line.resolved ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${line.resolved.product.slug}`}
                      className="text-sm font-semibold hover:text-amber-dark"
                    >
                      {line.resolved.product.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                      {line.resolved.partNumber} · {line.resolved.name}
                      {line.resolved.packSize > 1 && ` · pack of ${line.resolved.packSize}`}
                    </p>

                    <label htmlFor={`note-${line.variantId}`} className="sr-only">
                      Note for this item
                    </label>
                    <input
                      id={`note-${line.variantId}`}
                      value={line.note ?? ''}
                      onChange={(event) => setNote(line.variantId, event.target.value)}
                      placeholder="Add a note (optional)"
                      className="field mt-2 h-8 py-1 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label htmlFor={`q-${line.variantId}`} className="sr-only">
                      Quantity
                    </label>
                    <input
                      id={`q-${line.variantId}`}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        setQuantity(line.variantId, Math.max(1, Number(event.target.value) || 1))
                      }
                      className="field h-9 w-20 py-1"
                    />
                    <p className="w-24 text-right text-sm font-semibold">
                      {line.resolved.priceType === 'FIXED' && line.resolved.price !== null
                        ? formatInr(line.resolved.price * line.quantity)
                        : 'On request'}
                    </p>
                    <button
                      type="button"
                      onClick={() => remove(line.variantId)}
                      aria-label="Remove item"
                      className="text-xs text-ink-muted underline hover:text-bad"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-bad">This item is no longer available.</p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">Indicative total</span>
          <span className="text-lg font-bold">{formatInr(estimate)}</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">
          Excluding GST and freight. Your quotation will confirm final pricing.
        </p>
      </div>

      <div className="card h-fit p-5">
        <h2 className="text-base font-bold">Your details</h2>

        <div className="mt-4 space-y-4">
          <Field label="Name" name="contactName" required errors={errors.contactName}>
            <input
              id="contactName"
              value={values.contactName}
              onChange={(event) => set('contactName', event.target.value)}
              className="field"
              autoComplete="name"
            />
          </Field>

          <Field label="Phone" name="contactPhone" errors={errors.contactPhone}>
            <input
              id="contactPhone"
              type="tel"
              value={values.contactPhone}
              onChange={(event) => set('contactPhone', event.target.value)}
              className="field"
              autoComplete="tel"
              placeholder="98765 43210"
            />
          </Field>

          <Field label="Email" name="contactEmail" errors={errors.contactEmail}>
            <input
              id="contactEmail"
              type="email"
              value={values.contactEmail}
              onChange={(event) => set('contactEmail', event.target.value)}
              className="field"
              autoComplete="email"
            />
          </Field>

          <Field label="Company" name="contactCompany" errors={errors.contactCompany}>
            <input
              id="contactCompany"
              value={values.contactCompany}
              onChange={(event) => set('contactCompany', event.target.value)}
              className="field"
              autoComplete="organization"
            />
          </Field>

          <Field label="City" name="contactCity" errors={errors.contactCity}>
            <input
              id="contactCity"
              value={values.contactCity}
              onChange={(event) => set('contactCity', event.target.value)}
              className="field"
              autoComplete="address-level2"
            />
          </Field>

          {/* Machine context captured ONCE for the whole request. */}
          <fieldset className="rounded-md border border-ink-line p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Your machine (optional)
            </legend>
            <div className="space-y-2">
              <select
                aria-label="Machine brand"
                value={values.machineBrandId}
                onChange={(event) => {
                  set('machineBrandId', event.target.value);
                  set('machineModelId', '');
                }}
                className="field text-sm"
              >
                <option value="">Select brand</option>
                {machines.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Machine model"
                value={values.machineModelId}
                onChange={(event) => set('machineModelId', event.target.value)}
                disabled={!values.machineBrandId}
                className="field text-sm disabled:bg-ink-wash"
              >
                <option value="">Select model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          <Field label="Message" name="message" errors={errors.message}>
            <textarea
              id="message"
              rows={3}
              value={values.message}
              onChange={(event) => set('message', event.target.value)}
              className="field"
              placeholder="Anything else we should know?"
            />
          </Field>

          {/* Honeypot — invisible to people, filled by bots. */}
          <div aria-hidden className="absolute left-[-9999px]">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(event) => set('website', event.target.value)}
            />
          </div>

          <div>
            <label className="flex items-start gap-2 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={values.consent}
                onChange={(event) => set('consent', event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-line"
              />
              <span>
                I agree that LEI may use these details to respond to this request. See our{' '}
                <Link href="/privacy" className="underline">
                  privacy policy
                </Link>
                .
              </span>
            </label>
            {errors.consent && <p className="mt-1 text-xs text-bad">{errors.consent[0]}</p>}
          </div>

          {formError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-bad">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || usableLines.length === 0}
            className="btn-primary w-full"
          >
            {submitting ? 'Sending…' : 'Send quote request'}
          </button>

          <p className="text-center text-[11px] text-ink-muted">
            No payment is taken. We will reply with a quotation.
          </p>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  errors,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="ml-0.5 text-bad">*</span>}
      </label>
      {children}
      {errors?.length ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-bad">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Success state.
 *
 * Gives the reference, the item count and — most importantly — what happens
 * next and by when. "We'll be in touch" is not an expectation.
 */
function SuccessPanel({ result }: { result: { publicRef: string; itemCount: number } }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-50" aria-hidden>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="m5 13 4 4L19 7" stroke="#1d7a4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2 className="mt-4 text-xl font-bold">Request received</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Thank you. We have your request for {result.itemCount}{' '}
        {result.itemCount === 1 ? 'item' : 'items'} and will respond with a quotation, usually
        within one working day.
      </p>

      <div className="mt-5 rounded-md bg-ink-wash px-4 py-3">
        <p className="text-xs text-ink-muted">Your reference</p>
        <p className="mt-0.5 font-mono text-lg font-bold tracking-wide">{result.publicRef}</p>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Please quote this reference if you contact us about the request.
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <Link href="/catalogue" className="btn-secondary text-sm">
          Continue browsing
        </Link>
        <Link href="/" className="btn-primary text-sm">
          Back to home
        </Link>
      </div>
    </div>
  );
}
