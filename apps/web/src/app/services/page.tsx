import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Repair, calibration, maintenance and retrofit services for laser cutting machines, cutting heads, sources, chillers and drives.',
  alternates: { canonical: canonical('/services') },
};

export const revalidate = 3600;

/**
 * §18 services architecture.
 *
 * The eleven names come from the specification, so nothing here is invented.
 * What is deliberately ABSENT is equally important: no description, no
 * turnaround time, no price, no capability claim. §18 and §25 both forbid
 * writing those before LEI supplies and approves them, and a plausible-sounding
 * invented turnaround is exactly the kind of claim that costs a customer's
 * trust the first time it is wrong.
 *
 * These are static rather than database-backed for the same reason: creating
 * eleven empty Service rows would imply content exists. When approved copy
 * arrives, this list becomes the seed for real records.
 */
const SERVICES = [
  'Cutting Head Repair',
  'Laser Source Repair',
  'Chiller Repair',
  'PCB Repair',
  'Servo Repair',
  'Calibration',
  'Preventive Maintenance',
  'Breakdown Service',
  'Retrofit',
  'Upgrade',
  'AMC (Annual Maintenance Contract)',
];

export default function ServicesPage() {
  return (
    <div className="container-lei py-12">
      <h1 className="text-2xl font-bold">Services</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
        Alongside spares, LEI supports the machines themselves. Tell us the machine, the symptom and
        what you have already tried, and our engineers will confirm what is needed before anything
        is quoted.
      </p>

      <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <li
            key={service}
            className="flex items-center justify-between gap-4 rounded-lg border border-ink-line bg-white p-4"
          >
            <span className="text-sm font-semibold text-ink">{service}</span>
            <Link
              href={`/contact?subject=${encodeURIComponent(service)}`}
              className="shrink-0 rounded-md bg-amber px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-amber-dark"
            >
              Enquire Now
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-muted">
        Scope, turnaround and pricing depend entirely on the fault and the machine, so we confirm
        them with you directly rather than publishing figures that would not hold.
      </p>
    </div>
  );
}
