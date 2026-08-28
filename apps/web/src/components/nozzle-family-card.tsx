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

export function NozzleFamilyCard({ family }: Props) {
  // ── Option selection state ────────────────────────────────────────────────
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

  // ── Modal item shape ──────────────────────────────────────────────────────
  const modalItem = selectedVariant
    ? {
        variantId: selectedVariant.variantId,
        variantName: `${family.familyName} — ${selectedVariant.variantName}`,
        minOrderQty: selectedVariant.minOrderQty,
      }
    : null;

  return (
    <>
      <article className="card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-ink-wash">
          {family.imagePath ? (
            <Image
              src={mediaUrl(family.imagePath)}
              alt={family.imageAlt ?? family.familyName}
              fill
              className="object-contain p-3"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-muted">
              <svg className="h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </div>
          )}
          {/* Brand badge */}
          {family.brand && (
            <span className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink shadow-sm">
              {family.brand}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Title */}
          <div>
            <h3 className="text-sm font-bold leading-snug text-ink">{family.familyName}</h3>
            {family.shortDescription && (
              <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{family.shortDescription}</p>
            )}
          </div>

          {/* Option selectors — rendered only for axes with ≥2 values */}
          <div className="space-y-3">
            {family.optionGroups.map((group) => (
              <div key={group.key}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.values.map((value) => {
                    const isSelected = selections[group.key] === value;
                    const available = isOptionAvailable(
                      family,
                      group.key,
                      value,
                      selections,
                    );
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() => select(group.key, value)}
                        className={[
                          'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          isSelected
                            ? 'border-ink bg-ink text-white'
                            : available
                              ? 'border-ink-line bg-white text-ink hover:border-ink hover:bg-ink-wash'
                              : 'cursor-not-allowed border-ink-line/50 bg-white/50 text-ink-muted/50 line-through',
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

          {/* Selected variant badge */}
          <div className="flex-1" />
          {selectedVariant ? (
            /*
              Confirms the chosen combination WITHOUT the SKU or a price line.
              The SKU is an internal code (§21) and was previously rendered
              here; it still travels with the enquiry so sales can identify the
              exact item.
            */
            <div className="rounded-lg border border-ink-line bg-ink-wash px-3 py-2 text-[11px] text-ink-muted">
              Selected: <span className="font-semibold text-ink">{selectedVariant.variantName}</span>
            </div>
          ) : (
            <div className="rounded-lg border border-amber/40 bg-amber-wash px-3 py-2 text-[11px] text-amber-dark">
              Select options to see this combination
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            disabled={!selectedVariant}
            onClick={() => setModalOpen(true)}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            Enquire Now
          </button>
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
