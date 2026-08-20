import { demoBannerText } from '@/lib/site';

/**
 * Sample-data banner.
 *
 * The staging site sits on a subdomain of a real trading company's domain and
 * carries invented compatibility claims and placeholder prices. Anyone who
 * reaches it must be told, on every page, before they believe a price.
 */
export function DemoBanner() {
  return (
    <div role="status" className="bg-amber-wash text-ink border-b border-amber/40">
      <div className="container-lei flex items-start gap-2 py-2 text-[13px] leading-snug">
        <span aria-hidden className="mt-px font-semibold">
          Demo
        </span>
        <p className="text-ink-muted">{demoBannerText}</p>
      </div>
    </div>
  );
}
