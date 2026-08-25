'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { PhoneInput } from '@/components/phone-input';

interface Props {
  prefillSubject?: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm({ prefillSubject }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [publicRef, setPublicRef] = useState('');
  const [phone, setPhone] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const data = new FormData(e.currentTarget);

    const body = {
      contactName: data.get('name') as string,
      contactEmail: data.get('email') as string,
      contactPhone: phone,
      contactCompany: data.get('company') as string,
      subject: data.get('subject') as string,
      message: data.get('message') as string,
      consent: true,
    };

    try {
      const result = await api.submitContactForm(body);
      setPublicRef(result.publicRef);
      setStatus('success');
      formRef.current?.reset();
      setPhone('');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again or call us directly.');
    }
  }

  if (status === 'success') {
    return (
      <div className="mt-8 rounded-card border border-ok/30 bg-ok/5 px-6 py-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-ok/10 text-ok">
          <CheckIcon />
        </div>
        <h3 className="text-lg font-bold text-ink">Message received!</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Your reference is <span className="font-mono font-semibold text-ink">{publicRef}</span>.
          We&apos;ll be in touch within one working day.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="btn-secondary mt-6 text-sm"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
      {/* Name + Company */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="label">
            Full name <span className="text-bad">*</span>
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Ravi Kumar"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="contact-company" className="label">
            Company
          </label>
          <input
            id="contact-company"
            name="company"
            type="text"
            autoComplete="organization"
            placeholder="Acme Laser Pvt. Ltd."
            className="field"
          />
        </div>
      </div>

      {/* Email + Phone */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-email" className="label">
            Email <span className="text-bad">*</span>
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ravi@example.com"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="contact-phone" className="label">
            Phone / WhatsApp
          </label>
          <PhoneInput
            id="contact-phone"
            value={phone}
            onChange={setPhone}
            className="field"
            autoComplete="tel"
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="contact-subject" className="label">
          Subject <span className="text-bad">*</span>
        </label>
        <select
          id="contact-subject"
          name="subject"
          required
          defaultValue={prefillSubject ?? ''}
          className="field"
        >
          <option value="" disabled>
            Select a subject…
          </option>
          <option value="Product Enquiry">Product / Part enquiry</option>
          <option value="Quote Request">Quote request</option>
          <option value="Technical Support">Technical support</option>
          <option value="Service Request">Service / Repair request</option>
          <option value="Bulk Order">Bulk / OEM order</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="contact-message" className="label">
          Message <span className="text-bad">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          placeholder="Describe what you need — part numbers, machine model, quantity, urgency…"
          className="field resize-none"
        />
      </div>

      {/* Error */}
      {status === 'error' && (
        <p className="rounded-md border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <p className="text-xs text-ink-muted">
          By submitting you agree to be contacted about your enquiry.
        </p>
        <button type="submit" disabled={status === 'submitting'} className="btn-primary shrink-0">
          {status === 'submitting' ? (
            <>
              <SpinnerIcon />
              Sending…
            </>
          ) : (
            'Send message'
          )}
        </button>
      </div>
    </form>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
