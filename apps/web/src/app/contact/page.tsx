import type { Metadata } from 'next';
import { canonical, siteName, offices } from '@/lib/site';
import { ContactForm } from './contact-form';
import { OfficesMap } from './offices-map';
import {
  businessPhone,
  businessEmail,
  businessAddress,
} from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Laser Experts India for genuine laser cutting machine spares, nozzles, protective windows, focus lenses and ceramic rings. Quick response guaranteed.',
  alternates: { canonical: canonical('/contact') },
  openGraph: {
    title: 'Contact Us | Laser Experts India',
    description:
      'Reach our expert team for laser spares, consumables and technical support.',
    url: canonical('/contact'),
    siteName,
    type: 'website',
  },
};

interface PageProps {
  searchParams: Promise<{ subject?: string }>;
}

export default async function ContactPage({ searchParams }: PageProps) {
  const { subject } = await searchParams;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-ink py-14 text-white">
        <div className="container-lei">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber">
            Get in touch
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight lg:text-5xl">
            We&apos;re here to help.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">
            Tell us what you need — part numbers, machine model, quantity — and
            our team will respond within one working day.
          </p>
        </div>
      </section>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <section className="container-lei py-14">
        <div className="grid gap-12 lg:grid-cols-5">

          {/* ── Left: contact details ───────────────────────────────── */}
          <aside className="lg:col-span-2 space-y-6">

            {/* Phone */}
            <a
              href={`tel:${businessPhone.replace(/\s/g, '')}`}
              className="card flex items-start gap-4 p-5 transition-shadow hover:shadow-md"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-amber/10 text-amber">
                <PhoneIcon />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Phone / WhatsApp
                </p>
                <p className="mt-1 text-base font-bold text-ink">{businessPhone}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Mon – Sat, 9 am – 6 pm IST
                </p>
              </div>
            </a>

            {/* Email */}
            <a
              href={`mailto:${businessEmail}`}
              className="card flex items-start gap-4 p-5 transition-shadow hover:shadow-md"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-amber/10 text-amber">
                <MailIcon />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Email
                </p>
                <p className="mt-1 text-base font-bold text-ink">{businessEmail}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  We reply within one working day
                </p>
              </div>
            </a>

            {/* Location */}
            <div className="card flex items-start gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-amber/10 text-amber">
                <PinIcon />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Head Office
                </p>
                <p className="mt-1 text-sm font-bold text-ink">{businessAddress.line1}</p>
                <p className="text-sm text-ink">{businessAddress.line2}</p>
                <p className="text-sm text-ink-muted">{businessAddress.state}</p>
              </div>
            </div>

            {/* Business hours */}
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Business hours
              </p>
              <table className="mt-3 w-full text-sm">
                <tbody className="divide-y divide-ink-line">
                  {[
                    ['Monday – Friday', '9:00 am – 6:00 pm'],
                    ['Saturday', '9:00 am – 2:00 pm'],
                    ['Sunday', 'Closed'],
                  ].map(([day, hours]) => (
                    <tr key={day}>
                      <td className="py-2 text-ink-muted">{day}</td>
                      <td className="py-2 text-right font-medium text-ink">{hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>

          {/* ── Right: contact form ─────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="card p-7 sm:p-10">
              <h2 className="text-xl font-bold">Send us a message</h2>
              <p className="mt-1 text-sm text-ink-muted">
                All fields marked <span className="text-bad">*</span> are required.
              </p>
              <ContactForm prefillSubject={subject} />
            </div>
          </div>

        </div>
      </section>

      {/* ── Our Locations Map Section ──────────────────────────────── */}
      <section className="bg-ink-wash border-t border-ink-line py-14">
        <div className="container-lei text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber">
            Nationwide presence
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Our locations
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Interactive map of physical office branches and service hubs across India.
          </p>
        </div>

        {/* Dynamic widescreen interactive map switcher */}
        <div className="mt-6 mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <OfficesMap offices={offices} />
        </div>
      </section>
    </main>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.58 3.44 2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
