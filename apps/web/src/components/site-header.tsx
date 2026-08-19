'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuoteRequest } from '@/lib/quote-request';
import {
  primaryNav,
  siteName,
  businessPhone,
  businessEmail,
  businessLocation,
  businessGst,
} from '@/lib/site';

export function SiteHeader() {
  const router = useRouter();
  const { count, open } = useQuoteRequest();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Detect scroll past the identity bar (~60 px)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input[type="search"]') as HTMLInputElement;
    const trimmed = (input?.value ?? '').trim();
    if (!trimmed) return;
    setMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          Full header — visible at top of page
      ═══════════════════════════════════════════════════════════════════ */}
      <header
        className={[
          'sticky top-0 z-40 shadow-sm transition-all duration-300',
          scrolled ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0',
        ].join(' ')}
      >
        {/* Layer 1: Identity bar */}
        <div className="border-b border-white/10 bg-ink">
          <div className="container-lei flex flex-wrap items-center justify-between gap-y-2 py-2.5">
            {/* Logo + company info */}
            <Link href="/" className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-amber text-sm font-black text-ink"
              >
                LEI
              </span>
              <div>
                <p className="text-sm font-bold leading-tight text-white">{siteName}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-white/60">
                  <span className="flex items-center gap-1">
                    <PinIcon />
                    {businessLocation}
                  </span>
                  <span className="flex items-center gap-1">
                    <CardIcon />
                    GST No. <span className="font-semibold text-white">{businessGst}</span>
                  </span>
                  <span className="flex items-center gap-1 font-medium text-amber">
                    <ShieldCheckIcon />
                    Payment Protected
                  </span>
                </div>
              </div>
            </Link>

            {/* CTA buttons */}
            <div className="flex items-center gap-2">
              <a
                href={`tel:${businessPhone.replace(/\s/g, '')}`}
                className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <PhoneIcon />
                <span className="hidden sm:inline">Call </span>{businessPhone}
              </a>
              <a
                href={`mailto:${businessEmail}`}
                className="flex items-center gap-2 rounded-md bg-amber px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-amber/80"
              >
                <MailIcon />
                Send Email
              </a>
            </div>
          </div>
        </div>

        {/* Layer 2: Nav bar */}
        <div className="border-b border-ink-line bg-white/95 backdrop-blur">
          <div className="container-lei flex h-14 items-center gap-4">
            <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 lg:flex">
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

            <div className="ml-auto flex items-center gap-2">
              {/* Always-visible search */}
              <form onSubmit={submit} className="flex items-center gap-2" role="search">
                <label htmlFor="header-search" className="sr-only">Search parts</label>
                <input
                  id="header-search"
                  name="q"
                  type="search"
                  defaultValue=""
                  placeholder="Part number, model or brand"
                  className="field w-44 sm:w-64"
                />
                <button type="submit" className="btn-primary px-3 py-2">Search</button>
              </form>

              <button
                type="button"
                onClick={open}
                className="relative grid h-11 w-11 place-items-center rounded-md hover:bg-ink-wash"
                aria-label={`Quote request, ${count} item${count === 1 ? '' : 's'}`}
              >
                <ListIcon />
                {count > 0 && (
                  <span className="absolute right-1 top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-amber px-1 text-[11px] font-bold text-ink">
                    {count}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label="Toggle navigation"
                className="grid h-11 w-11 place-items-center rounded-md hover:bg-ink-wash lg:hidden"
              >
                <MenuIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-ink-line bg-white lg:hidden">
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
              <li className="mt-2 border-t border-ink-line pt-2">
                <a
                  href={`tel:${businessPhone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2 rounded-md px-2 py-3 text-sm font-medium hover:bg-ink-wash"
                >
                  <PhoneIcon />
                  {businessPhone}
                </a>
              </li>
            </ul>
          </nav>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          Compact scrolled header — slides in when scrolled > 60 px
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        aria-hidden={!scrolled}
        className={[
          'fixed inset-x-0 top-0 z-50 bg-ink shadow-lg transition-all duration-300',
          scrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <div className="container-lei flex h-16 items-center gap-3">
          {/* Hamburger + logo link */}
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Home">
            <span className="grid h-9 w-9 place-items-center rounded bg-amber text-xs font-black text-ink">
              LEI
            </span>
          </Link>

          {/* Nav links — desktop */}
          <nav aria-label="Scrolled primary" className="hidden items-center gap-0.5 lg:flex">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Search bar */}
          <form
            onSubmit={submit}
            role="search"
            className="ml-auto flex min-w-0 flex-1 items-center gap-2 lg:max-w-sm"
          >
            <label htmlFor="scroll-search" className="sr-only">Search products</label>
            <div className="relative flex-1">
              <input
                id="scroll-search"
                name="q"
                type="search"
                placeholder="Search Products / Services"
                className="h-10 w-full rounded-md border border-white/20 bg-white/10 pl-3 pr-3 text-sm text-white placeholder:text-white/50 focus:border-amber focus:bg-white/20 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-amber px-4 text-sm font-semibold text-ink hover:bg-amber/80"
            >
              <SearchIcon className="text-ink" />
              Search
            </button>
          </form>

          {/* Call + Email */}
          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            <a
              href={`tel:${businessPhone.replace(/\s/g, '')}`}
              className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <PhoneIcon />
              <div className="text-left leading-none">
                <div>Call {businessPhone}</div>
                <div className="text-[10px] text-white/60 font-normal">Quick response guaranteed</div>
              </div>
            </a>
            <a
              href={`mailto:${businessEmail}`}
              className="flex items-center gap-2 rounded-md bg-amber px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-amber/80"
            >
              <MailIcon />
              Send Email
            </a>
          </div>

          {/* Quote cart */}
          <button
            type="button"
            onClick={open}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md hover:bg-white/10"
            aria-label={`Quote request, ${count} item${count === 1 ? '' : 's'}`}
          >
            <ListIcon className="text-white" />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-amber px-1 text-[11px] font-bold text-ink">
                {count}
              </span>
            )}
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="grid h-10 w-10 place-items-center rounded-md hover:bg-white/10 lg:hidden"
          >
            <MenuIcon className="text-white" />
          </button>
        </div>

        {/* Compact mobile dropdown */}
        {menuOpen && (
          <nav className="border-t border-white/10 bg-ink lg:hidden">
            <ul className="container-lei py-1">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-2 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────── */

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.58 3.44 2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ListIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
