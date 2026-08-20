'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Primary keyword search.
 *
 * The one prominent search box on the page; the header search collapses to an
 * icon so the two do not compete at the moment of highest intent.
 */
export function HeroSearch() {
  const router = useRouter();
  const [term, setTerm] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = term.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} role="search" className="flex gap-2">
      <label htmlFor="hero-search" className="sr-only">
        Search by part name, number, model or brand
      </label>
      <input
        id="hero-search"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search by part number, model or brand…"
        className="field h-12 flex-1 text-base"
      />
      <button type="submit" className="btn-primary h-12 px-6">
        Search
      </button>
    </form>
  );
}
