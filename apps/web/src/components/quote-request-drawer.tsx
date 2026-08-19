'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useQuoteRequest } from '@/lib/quote-request';
import { formatInr } from '@/lib/format';

/**
 * Quote Request drawer.
 *
 * A drawer rather than a page navigation: adding a part should never interrupt
 * browsing. A customer replacing three consumables on one machine keeps their
 * place in the catalogue.
 */
export function QuoteRequestDrawer() {
  const { isOpen, close, resolved, unavailable, count, setQuantity, remove, isLoading } =
    useQuoteRequest();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes; focus moves into the panel so a keyboard user is not left
  // tabbing through the page behind it.
  useEffect(() => {
    if (!isOpen) return;

    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const estimate = resolved.reduce((sum, line) => {
    const price = line.resolved?.price;
    return price === null || price === undefined ? sum : sum + price * line.quantity;
  }, 0);

  const hasOnRequest = resolved.some((line) => line.resolved?.priceType !== 'FIXED');

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Quote request">
      <button
        type="button"
        aria-label="Close quote request"
        onClick={close}
        className="absolute inset-0 bg-ink/40"
      />

      <div
        ref={panelRef}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink-line px-5 py-4">
          <h2 className="text-base font-bold">
            Quote Request
            {count > 0 && <span className="ml-2 text-sm font-normal text-ink-muted">{count} item(s)</span>}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-ink-wash"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {resolved.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-4">
              {resolved.map((line) => (
                <li key={line.variantId} className="flex gap-3 border-b border-ink-line pb-4">
                  <div className="min-w-0 flex-1">
                    {line.resolved ? (
                      <>
                        <Link
                          href={`/products/${line.resolved.product.slug}`}
                          onClick={close}
                          className="block text-sm font-semibold leading-snug hover:text-amber-dark"
                        >
                          {line.resolved.product.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                          {line.resolved.partNumber} · {line.resolved.name}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {line.resolved.priceType === 'FIXED'
                            ? formatInr(line.resolved.price)
                            : 'Price on request'}
                        </p>
                      </>
                    ) : (
                      /* Resolved to nothing: deactivated or withdrawn since it
                         was added. One dead line must not break the basket. */
                      <p className="text-sm text-bad">
                        This item is no longer available.
                        {unavailable.includes(line.variantId) ? '' : ' Checking…'}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <label htmlFor={`qty-${line.variantId}`} className="sr-only">
                        Quantity
                      </label>
                      <input
                        id={`qty-${line.variantId}`}
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          setQuantity(line.variantId, Math.max(1, Number(event.target.value) || 1))
                        }
                        className="field h-9 w-20 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => remove(line.variantId)}
                        className="text-xs font-medium text-ink-muted underline hover:text-bad"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isLoading && <p className="mt-3 text-xs text-ink-muted">Checking availability…</p>}
        </div>

        {resolved.length > 0 && (
          <div className="border-t border-ink-line px-5 py-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-muted">Indicative total</span>
              <span className="text-lg font-bold">{formatInr(estimate)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              Indicative only, excluding GST and freight.
              {hasOnRequest && ' Some items are priced on request.'} Your quotation will confirm
              final pricing.
            </p>
            <Link href="/quote-request" onClick={close} className="btn-primary mt-3 w-full">
              Review and submit
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Empty state that does a job.
 *
 * A customer with an empty request is a customer who has not found their part
 * yet, so this points at the finder rather than just saying "nothing here".
 */
function EmptyState() {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-semibold">Your quote request is empty</p>
      <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">
        Add the parts you need and send them as one request — no need to enquire about each item
        separately.
      </p>
      <Link href="/compatibility" className="btn-secondary mt-4 text-xs">
        Find parts for my machine
      </Link>
    </div>
  );
}
