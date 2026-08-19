'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuoteRequest } from '@/lib/quote-request';
import { primaryNav, siteName } from '@/lib/site';

/**
 * Site header.
 *
 * The approved design had three concurrent search affordances on the homepage
 * (header, hero, compatibility finder). Three overlapping ways to do the same
 * thing at the moment of highest intent is friction, so the header search
 * collapses to an icon and only expands on demand — leaving the hero search as
 * the single prominent keyword entry point, and the finder as its distinct
 * "browse by machine" counterpart.
 *
 * Deliberately absent: Login/Register and Track Order. Customer accounts are
 * not in this release, and a control that does nothing damages more trust than
 * the missing feature.
 */
export function SiteHeader() {
  const router = useRouter();
  const { count, open } = useQuoteRequest();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) return;
    setSearchOpen(false);
    setMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-line bg-white/95 backdrop-blur">
      {/* Trust strip. Deliberately no "Secure Payments" — there is no checkout. */}
      <div className="hidden bg-ink text-white lg:block">
        <div className="container-lei flex items-center justify-between py-1.5 text-xs">
          <p className="text-white/70">India&rsquo;s trusted laser spares &amp; consumables partner</p>
          <ul className="flex items-center gap-6 text-white/70">
            <li>100% genuine parts</li>
            <li>Pan-India delivery</li>
            <li>Expert technical support</li>
          </ul>
        </div>
      </div>

      <div className="container-lei flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-md bg-ink text-sm font-black text-amber"
          >
            LEI
          </span>
          <span className="hidden text-sm font-bold leading-tight sm:block">
            Laser Experts
            <span className="block text-[11px] font-medium text-ink-muted">India</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-ink-wash"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {searchOpen ? (
            <form onSubmit={submit} className="flex items-center gap-2" role="search">
              <label htmlFor="header-search" className="sr-only">
                Search parts
              </label>
              <input
                ref={inputRef}
                id="header-search"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onBlur={() => !term && setSearchOpen(false)}
                placeholder="Part number, model or brand"
                className="field w-52 sm:w-72"
              />
              <button type="submit" className="btn-primary px-3 py-2">
                Search
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              className="grid h-11 w-11 place-items-center rounded-md hover:bg-ink-wash"
            >
              <SearchIcon />
            </button>
          )}

          <button
            type="button"
            onClick={open}
            className="relative grid h-11 w-11 place-items-center rounded-md hover:bg-ink-wash"
            aria-label={`Quote request, ${count} item${count === 1 ? '' : 's'}`}
          >
            <ListIcon />
            {count > 0 && (
              <span
                className="absolute right-1 top-1 grid h-5 min-w-[20px] place-items-center rounded-full
                           bg-amber px-1 text-[11px] font-bold text-ink"
              >
                {count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
            className="grid h-11 w-11 place-items-center rounded-md hover:bg-ink-wash lg:hidden"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-ink-line lg:hidden">
          <ul className="container-lei py-2">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-md px-2 py-3 text-sm font-medium hover:bg-ink-wash"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
