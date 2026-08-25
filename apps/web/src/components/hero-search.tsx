'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SearchAutocomplete } from './search-autocomplete';

/**
 * Primary keyword search.
 *
 * The one prominent search box on the page; the header search collapses to an
 * icon so the two do not compete at the moment of highest intent.
 */
export function HeroSearch() {
  return (
    <div className="flex gap-2">
      <SearchAutocomplete
        id="hero-search"
        placeholder="Search by part number, model or brand…"
        inputClassName="field h-12 flex-1 text-base w-full"
        buttonClassName="btn-primary h-12 px-6 shrink-0"
        autoFocus={false}
      />
    </div>
  );
}
