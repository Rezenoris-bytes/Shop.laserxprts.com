'use client';

import { useMemo, useState } from 'react';
import type { ProductDetail, ProductVariantView } from '@/lib/api';
import { SingleOrderModal } from '@/components/single-order-modal';

/** How many no-axis variant chips to show before "Show more". */
const SHOW_LIMIT = 12;

type SelectableProduct = Pick<ProductDetail, 'axes' | 'variants'>;

export function VariantSelector({ product }: { product: SelectableProduct }) {
  // ── Variant selection ────────────────────────────────────────────────────
  const initial = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(
    initial ? { ...initial.axisValues } : {},
  );
  const [selectedId, setSelectedId] = useState<number | null>(initial?.id ?? null);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);

  // ── No-axis chip list collapse ────────────────────────────────────────────
  const [showAll, setShowAll] = useState(false);

  // ── Derive selected variant ───────────────────────────────────────────────
  const selected: ProductVariantView | null = useMemo(() => {
    if (product.axes.length === 0) {
      if (product.variants.length === 1) return product.variants[0] ?? null;
      return product.variants.find((v) => v.id === selectedId) ?? null;
    }
    return (
      product.variants.find((variant) =>
        product.axes.every((axis) => variant.axisValues[axis.slug] === selection[axis.slug]),
      ) ?? null
    );
  }, [product, selection, selectedId]);

  const isAvailable = (axisSlug: string, value: string): boolean =>
    product.variants.some((variant) => {
      if (variant.axisValues[axisSlug] !== value) return false;
      return product.axes
        .filter((axis) => axis.slug !== axisSlug)
        .every((axis) => {
          const chosen = selection[axis.slug];
          return chosen === undefined || variant.axisValues[axis.slug] === chosen;
        });
    });

  const canOrder = selected !== null && selected.priceType !== 'CONTACT_SALES';

  return (
    <div className="space-y-5">
      {/* ── Axis-based chips (e.g. D1.2, D1.4 …) ── */}
      {product.axes.map((axis) => (
        <fieldset key={axis.slug}>
          <legend className="label">
            {axis.name}
            {axis.unit && <span className="ml-1 font-normal text-ink-muted">({axis.unit})</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {axis.values.map((value) => {
              const active = selection[axis.slug] === value;
              const available = isAvailable(axis.slug, value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!available}
                  aria-pressed={active}
                  onClick={() => setSelection((cur) => ({ ...cur, [axis.slug]: value }))}
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

      {/* ── No-axis fallback: select by variant name ── */}
      {product.axes.length === 0 && product.variants.length > 1 && (
        <fieldset>
          <legend className="label">
            Option
            {product.variants.length > SHOW_LIMIT && (
              <span className="ml-2 font-normal text-ink-muted">
                ({product.variants.length} options)
              </span>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(showAll ? product.variants : product.variants.slice(0, SHOW_LIMIT)).map((variant) => {
              const active = selectedId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(variant.id)}
                  className={[
                    'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-ink bg-ink text-white'
                      : 'border-ink-line bg-white hover:border-ink',
                  ].join(' ')}
                >
                  {variant.name}
                </button>
              );
            })}
          </div>

          {/* Show more / Show less toggle */}
          {product.variants.length > SHOW_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs font-semibold text-amber underline-offset-2 hover:underline"
            >
              {showAll
                ? 'Show less'
                : `Show ${product.variants.length - SHOW_LIMIT} more options`}
            </button>
          )}
        </fieldset>
      )}

      {/* ── Price / order box ── */}
      <div className="rounded-card border border-ink-line bg-white p-5">
        {selected ? (
          <>
            {/* No price badge. The box states the selected option and the
                action; pricing language of any kind is off the storefront. */}

            {/* The SKU is an internal code and is deliberately not shown to
                customers. It still travels with the enquiry, so sales can
                identify the exact item from the request. */}
            <p className="text-lg font-bold text-ink">{selected.name}</p>

            {selected.packSize > 1 && (
              <p className="mt-2 text-xs text-ink-muted">
                Sold as a pack of {selected.packSize}.
              </p>
            )}
            {selected.leadTimeDays !== null && selected.leadTimeDays > 0 && (
              <p className="mt-1 text-xs text-ink-muted">
                Typical lead time {selected.leadTimeDays} days.
              </p>
            )}

            {/* Single "Enquire Now" button — no qty stepper on the page */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={!canOrder}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-amber
                         px-6 text-base font-bold text-ink transition-colors hover:bg-amber-dark
                         disabled:cursor-not-allowed disabled:opacity-50"
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

            {selected.priceType === 'CONTACT_SALES' && (
              <p className="mt-3 text-xs text-ink-muted">
                This item is quoted individually. Please{' '}
                <a href="/contact" className="font-medium underline">contact our team</a>.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            That combination is not available. Try a different{' '}
            {product.axes[0]?.name.toLowerCase() ?? 'option'}.
          </p>
        )}
      </div>

      {/* ── Unified order modal (Single / Bulk → contact form) ── */}
      <SingleOrderModal
        open={modalOpen}
        item={
          selected
            ? {
                variantId: selected.id,
                variantName: selected.name,
                minOrderQty: selected.minOrderQty,
              }
            : null
        }
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

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
