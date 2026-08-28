'use client';

import { useState, useMemo } from 'react';
import {
  type ProductFamily,
  type NozzleVariantLeaf,
  isOptionAvailable,
  resolveVariant,
} from '@/lib/nozzle-family';
import { SingleOrderModal } from '@/components/single-order-modal';
import { ProductGallery } from '@/components/product-gallery';

interface Props {
  family: ProductFamily;
}

/**
 * Renders a nozzle family using the same card + two-column layout as
 * ProductRow. The right column uses the same fieldset/legend/chip pattern
 * as VariantSelector, and the price box is identical to VariantSelector's.
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
          {/* Left: image — identical to ProductRow via ProductGallery */}
          <ProductGallery
            product={{
              name: family.familyName,
              images: family.imagePath
                ? [
                    {
                      id: 0,
                      alt: family.imageAlt,
                      isPrimary: true,
                      storedName: '',
                      path: family.imagePath,
                      width: null,
                      height: null,
                    },
                  ]
                : [],
            }}
          />

          {/* Right: title + selectors + price box — mirrors VariantSelector layout */}
          <div className="space-y-5">
            {/* Header */}
            <div>
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
            </div>

            {/* Option selectors — same fieldset/legend/chip pattern as VariantSelector */}
            {family.optionGroups.map((group) => (
              <fieldset key={group.key}>
                <legend className="label">{group.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {group.values.map((value) => {
                    const active = selections[group.key] === value;
                    const available = isOptionAvailable(family, group.key, value, selections);
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!available}
                        aria-pressed={active}
                        onClick={() => select(group.key, value)}
                        className={[
                          'min-w-[3.25rem] rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'border-ink bg-ink text-white'
                            : available
                              ? 'border-ink-line bg-white hover:border-ink'
                              : 'cursor-not-allowed border-ink-line bg-ink-wash text-ink-muted line-through',
                        ].join(' ')}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {/* Price / order box — identical to VariantSelector */}
            <div className="rounded-card border border-ink-line bg-white p-5">
              {selectedVariant ? (
                <>
                  {/* No price badge — see product-card.tsx. */}
                  <p className="text-lg font-bold text-ink">{selectedVariant.variantName}</p>

                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="mt-5 flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-amber
                               px-6 text-base font-bold text-ink transition-colors hover:bg-amber-dark"
                  >
                    <QuoteIcon />
                    Enquire Now
                  </button>

                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-line pt-4 text-sm text-ink-muted">
                    <span className="flex items-center gap-2"><ShieldIcon /> Genuine Parts</span>
                    <span aria-hidden className="text-ink-line">|</span>
                    <span className="flex items-center gap-2"><TruckIcon /> Fast Shipping</span>
                    <span aria-hidden className="text-ink-line">|</span>
                    <span className="flex items-center gap-2"><SupportIcon /> Expert Support</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  That combination is not available. Try a different option.
                </p>
              )}
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

// ── Icons (identical copies from VariantSelector) ─────────────────────────────

function Icon({ size = 18, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}
function TagIcon() {
  return <Icon><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><circle cx="7" cy="7" r="1.5" /></Icon>;
}
function QuoteIcon() {
  return <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></Icon>;
}
function ShieldIcon() {
  return <Icon size={16}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></Icon>;
}
function TruckIcon() {
  return <Icon size={16}><path d="M10 17h4V5H2v12h3" /><path d="M14 9h4l4 4v4h-3" /><circle cx="7.5" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></Icon>;
}
function SupportIcon() {
  return <Icon size={16}><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><path d="M4 15a2 2 0 0 1 2-2h1v5H6a2 2 0 0 1-2-2Z" /><path d="M20 15a2 2 0 0 0-2-2h-1v5h1a2 2 0 0 0 2-2Z" /><path d="M18 18v1a3 3 0 0 1-3 3h-2" /></Icon>;
}
