import type { Metadata } from 'next';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  alternates: { canonical: canonical('/privacy') },
};

/**
 * Required before any PII is collected. The Digital Personal Data Protection
 * Act 2023 applies to the names, phone numbers, emails and company details
 * every quote request captures.
 */
export default function PrivacyPage() {
  return (
    <div className="container-lei max-w-2xl py-12">
      <h1 className="text-2xl font-bold">Privacy policy</h1>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink-muted">
        <p className="rounded-md bg-amber-wash px-4 py-3 text-xs text-ink">
          Draft for review. LEI must confirm this text, and name a grievance officer, before the
          site accepts real enquiries.
        </p>

        <section>
          <h2 className="text-base font-semibold text-ink">What we collect</h2>
          <p className="mt-1.5">
            When you send a quote request or contact us we collect your name, phone number, email
            address, company name and city, along with the items you asked about and anything you
            write in the message field.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Why we collect it</h2>
          <p className="mt-1.5">
            Solely to respond to your enquiry, prepare a quotation and contact you about it. We do
            not sell your details, and we do not use them for unrelated marketing.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">How long we keep it</h2>
          <p className="mt-1.5">
            Enquiry and quotation records are retained as commercial records. Website activity data
            is retained for 180 days and then aggregated.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Your rights</h2>
          <p className="mt-1.5">
            You may ask us what we hold about you, ask for corrections, or ask us to delete your
            details. Contact us and we will respond.
          </p>
        </section>
      </div>
    </div>
  );
}
