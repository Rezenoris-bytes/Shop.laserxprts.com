'use client';

import { useState } from 'react';
import type { ProductCard } from '@/lib/api';
import { QuickQuoteModal } from '@/components/quick-quote-modal';

/**
 * The card's quote action.
 *
 * A thin client boundary so the card itself stays a server component — only
 * the button and its modal need state, and pushing 'use client' up to the card
 * would ship every tile's markup to the browser for no reason.
 */
export function QuoteButton({ product }: { product: ProductCard }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mt-3 w-full text-xs"
        aria-label={`Get a quote for ${product.name}`}
        aria-haspopup="dialog"
      >
        Get a Quote
      </button>

      <QuickQuoteModal product={product} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
