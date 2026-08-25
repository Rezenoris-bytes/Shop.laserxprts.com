'use client';

import { useState } from 'react';
import type { ProductCard } from '@/lib/api';
import { QuickQuoteModal } from '@/components/quick-quote-modal';

export function QuickViewTrigger({
  product,
  children,
}: {
  product: ProductCard;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-white"
        aria-label={`Quick view ${product.name}`}
      >
        {children}
      </button>
      <QuickQuoteModal product={product} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
