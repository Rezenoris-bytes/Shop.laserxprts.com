'use client';

import Image from 'next/image';
import { useState, useMemo } from 'react';
import {
  type ProductFamily,
  type NozzleVariantLeaf,
  isOptionAvailable,
  resolveVariant,
} from '@/lib/nozzle-family';
import { SingleOrderModal } from '@/components/single-order-modal';
import { mediaUrl } from '@/lib/format';

interface Props {
  family: ProductFamily;
}

/**
 * Renders a nozzle family using the same card + two-column layout as
 * ProductRow, so the nozzle category page looks identical to all other
 * category pages — same sidebar, same layout, same "Add to Quote" flow.
 *
 * The only difference from ProductRow is that the right column shows
 * option selectors (Layer, Cut Type, Size) instead of a flat variant list.
 */
export function NozzleFamilyRow({ family }: Props) {
  // ── Option selection ──────────────────────────────────────────────────────
  const initialSelections = useMemo(() => {
    const init: Record<string, string> = {};
    for (const group of family.optionGroups) {
      if (group.values[0]) init[group.key] = group.values[0];
    }
    return init;
  }, [family]);

  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedVariant: NozzleVariantLeaf | null = useMemo(
    () => resolveVariant(family, selections),
    [family, selections],
  );

  const select = (axis: string, value: string) =>
    setSelections((prev) => ({ ...prev, [axis]: value }));

  const modalItem = selectedVariant
    ? {
        variantId: selectedVariant.variantId,
        variantName: `${family.familyName} — ${selectedVariant.variantName}`,
        sku: selectedVariant.sku,
        minOrderQty: selectedVariant.minOrderQty,
      }
    : null;

  return (
    <>
      <article
        id={family.familyKey}
        className="card scroll-mt-24 p-4 sm:p-6"
      >
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
          {/* Left: image — same slot as ProductGallery */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-ink-wash">
            {family.imagePath ? (
              <Image
                src={mediaUrl(family.imagePath)}
                alt={family.imageAlt ?? family.familyName}
                fill
                className="object-contain p-6"
                sizes="(max-width: 1024px) 100vw, 380px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-muted/30">
                <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              </div>
            )}
          </div>

          {/* Right: title + selectors + CTA — same slot as the right column in ProductRow */}
          <div className="min-w-0">
            {family.brand && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {family.brand}
              </p>
            )}

            <h2 className="mt-1 text-lg font-bold leading-snug">{family.familyName}</h2>

            {family.shortDescription && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {family.shortDescription}
              </p>
            )}

            {/* Option selectors */}
            <div className="mt-4 space-y-4">
              {family.optionGroups.map((group) => (
                <div key={group.key}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((value) => {
                      const isSelected = selections[group.key] === value;
                      const available = isOptionAvailable(family, group.key, value, selections);
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!available}
                          onClick={() => select(group.key, value)}
                          className={[
                            'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                            isSelected
                              ? 'border-ink bg-ink text-white'
                              : available
                                ? 'border-ink-line bg-white text-ink hover:border-ink hover:bg-ink-wash'
                                : 'cursor-not-allowed border-ink-line/40 bg-white/50 text-ink-muted/40 line-through',
                          ].join(' ')}
                          aria-pressed={isSelected}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Price + CTA — same layout as ProductRow */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-amber-dark">Price on request</p>

              {/* Selected variant readout */}
              {selectedVariant ? (
                <p className="mt-1 font-mono text-[11px] text-ink-muted">
                  {selectedVariant.variantName} &nbsp;·&nbsp; {selectedVariant.sku}
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-dark/80">
                  Select options above to continue
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!selectedVariant}
                  onClick={() => setModalOpen(true)}
                  className="btn-primary disabled:opacity-50"
                >
                  Add to Quote
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-5 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z"/><path d="M6 8l1.5 1.5L10 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Genuine Parts
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 5h12l-1 8H3L2 5Z"/><path d="M5 5V3.5a3 3 0 0 1 6 0V5" strokeLinecap="round"/></svg>
                  Fast Shipping
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5l2 2" strokeLinecap="round"/></svg>
                  Expert Support
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>

      <SingleOrderModal
        open={modalOpen}
        item={modalItem}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
