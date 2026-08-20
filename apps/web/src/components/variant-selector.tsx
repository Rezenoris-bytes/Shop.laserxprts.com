'use client';

import { useMemo, useState } from 'react';
import type { ProductDetail, ProductVariantView } from '@/lib/api';

/**
 * Only the two fields the selector actually reads. Typed structurally so the
 * same component serves a catalogue row and any future surface, rather than
 * demanding a whole ProductDetail that no longer exists on the listing path.
 */
type SelectableProduct = Pick<ProductDetail, 'axes' | 'variants'>;
import { useQuoteRequest } from '@/lib/quote-request';

import { stockLabel, stockToneClass } from '@/lib/stock';

/**
 * Variant selector.
 *
 * ONE component renders every product family, because the axes are derived
 * from the data rather than configured:
 *
 *   0 axes  -> no selector at all (single-variant product)
 *   1 axis  -> one row of chips (diameter)
 *   2 axes  -> two rows (thread x diameter, or height x diameter)
 *   n axes  -> n rows, no code change
 *
 * Combinations that do not exist are disabled rather than hidden — the seed
 * deliberately contains an asymmetric family (3.5 and 4.0 exist only for H20)
 * so this path is exercised. Hiding them would make the range look smaller
 * than it is; disabling shows what is available for another thread.
 */
export function VariantSelector({ product }: { product: SelectableProduct }) {
  const { add } = useQuoteRequest();

  const initial = product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(
    initial ? { ...initial.axisValues } : {},
  );
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selected: ProductVariantView | null = useMemo(() => {
    if (product.axes.length === 0) return product.variants[0] ?? null;
    return (
      product.variants.find((variant) =>
        product.axes.every((axis) => variant.axisValues[axis.slug] === selection[axis.slug]),
      ) ?? null
    );
  }, [product, selection]);

  /** A value is selectable if some variant matches it plus the other choices. */
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

  const onAdd = () => {
    if (!selected) return;
    add(selected.id, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2500);
  };

  const canOrder =
    selected !== null &&
    selected.priceType !== 'CONTACT_SALES' &&
    selected.stockStatus !== 'DISCONTINUED';

  const stock = selected ? stockLabel(selected.stockStatus) : null;

  return (
    <div className="space-y-5">
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
                  onClick={() => setSelection((current) => ({ ...current, [axis.slug]: value }))}
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

      {/* No axes but several variants: fall back to a plain list, e.g. the
          ceramic ring's Standard / Heavy Duty, which differ by name only. */}
      {product.axes.length === 0 && product.variants.length > 1 && (
        <fieldset>
          <legend className="label">Option</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                aria-pressed={selected?.id === variant.id}
                onClick={() => setSelection({ __variant: String(variant.id) })}
                className={[
                  'rounded-md border px-3 py-2 text-sm font-medium',
                  selected?.id === variant.id
                    ? 'border-ink bg-ink text-white'
                    : 'border-ink-line bg-white hover:border-ink',
                ].join(' ')}
              >
                {variant.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="rounded-card border border-ink-line bg-ink-wash p-4">
        {selected ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="inline-flex items-center gap-1.5 rounded-md bg-amber/10 px-3 py-1 text-sm font-semibold text-amber-dark">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Price on enquiry
                </p>
                <p className="mt-0.5 font-mono text-xs text-ink-muted">
                  {selected.partNumber} · SKU {selected.sku}
                </p>
              </div>
              {stock && (
                <span className={`chip ${stockToneClass[stock.tone]}`}>{stock.label}</span>
              )}
            </div>

            {selected.packSize > 1 && (
              <p className="mt-2 text-xs text-ink-muted">
                Sold as a pack of {selected.packSize}. Quantity below is in packs.
              </p>
            )}
            {selected.leadTimeDays !== null && selected.leadTimeDays > 0 && (
              <p className="mt-1 text-xs text-ink-muted">
                Typical lead time {selected.leadTimeDays} days.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-28">
                <label htmlFor="qty" className="label">
                  Quantity
                </label>
                <input
                  id="qty"
                  type="number"
                  min={selected.minOrderQty}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="field"
                />
              </div>

              <button
                type="button"
                onClick={onAdd}
                disabled={!canOrder}
                className="btn-primary flex-1 sm:flex-none"
              >
                {justAdded ? 'Added to request' : 'Add to Quote Request'}
              </button>
            </div>

            {/* Announced to screen readers without stealing focus. */}
            <p aria-live="polite" className="sr-only">
              {justAdded ? `${selected.partNumber} added to your quote request` : ''}
            </p>

            {selected.priceType === 'CONTACT_SALES' && (
              <p className="mt-3 text-xs text-ink-muted">
                This item is quoted individually. Please{' '}
                <a href="/contact" className="font-medium underline">
                  contact our team
                </a>
                .
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
    </div>
  );
}
