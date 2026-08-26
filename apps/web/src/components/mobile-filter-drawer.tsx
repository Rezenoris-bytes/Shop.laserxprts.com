'use client';

import { useState, useEffect } from 'react';
import { CatalogueFilters } from '@/components/catalogue-filters';
import type { CategoryNode, Facet } from '@/lib/api';

/**
 * Mobile filter drawer and bottom sticky action button.
 * Hidden on desktop.
 */
export function MobileFilterDrawer({
  facets,
  categories,
}: {
  facets: Facet[];
  categories: CategoryNode[];
}) {
  const [open, setOpen] = useState(false);

  // Prevent scrolling on body when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Sticky Bottom Bar with "Show Filters" FAB */}
      <div className="fixed bottom-0 left-0 right-0 z-40 block bg-gradient-to-t from-white via-white to-white/0 pb-4 pt-10 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-auto flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-amber-dark px-6 text-sm font-bold text-white shadow-lg shadow-amber/20 transition-transform active:scale-95"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4h14M5 10h10M8 16h4" strokeLinecap="round" />
          </svg>
          Show Filters
          <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 13l-5-5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Full-screen Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-line px-4">
            <h2 className="text-base font-bold text-ink">Filters</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-ink-muted hover:bg-ink-wash hover:text-ink"
              aria-label="Close filters"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            <CatalogueFilters facets={facets} categories={categories} />
          </div>

          <div className="shrink-0 border-t border-ink-line p-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary w-full"
            >
              View Results
            </button>
          </div>
        </div>
      )}
    </>
  );
}
