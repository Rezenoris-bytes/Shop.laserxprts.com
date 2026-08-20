import Link from 'next/link';
import Image from 'next/image';
import { siteName, siteTagline, businessPhone } from '@/lib/site';


export function SiteFooter() {
  return (
    <footer className="mt-20 bg-ink text-white">
      {/* ── Call to Action Banner ── */}
      <div className="container-lei py-12 lg:py-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: headline copy */}
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber sm:text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              <span>Get in touch</span>
            </div>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Eliminate <span className="text-amber">Machine Downtime</span> – Today
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-base">
              India&apos;s best laser machine service network. One call gets you certified engineers nationwide.
            </p>
          </div>

          {/* Right: callback form */}
          <div className="flex w-full max-w-sm flex-col items-start gap-3 lg:items-end lg:text-right">
            <a href={`tel:${businessPhone.replace(/\s/g, '')}`} className="text-2xl font-black tracking-tight text-amber transition-colors hover:text-amber-dark sm:text-3xl">
              {businessPhone}
            </a>
            <div className="w-full space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input 
                  type="text" 
                  placeholder="Your Name" 
                  className="w-full rounded-sm border border-white/20 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber" 
                  required 
                />
                <input 
                  type="tel" 
                  placeholder="Phone Number" 
                  className="w-full rounded-sm border border-white/20 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber" 
                  required 
                />
              </div>
              <button 
                type="button" 
                className="w-full rounded-sm bg-amber px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-dark sm:w-auto lg:w-full"
              >
                REQUEST CALLBACK
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-amber" />

      <div className="container-lei grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Link href="/" aria-label={siteName}>
            <Image
              src="/Footer-laser-expert-circle.png"
              alt={siteName}
              width={96}
              height={96}
              className="h-24 w-24 object-contain"
            />
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{siteTagline}</p>
        </div>

        <nav aria-label="Catalogue">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Catalogue</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/catalogue" className="text-sm text-white/80 transition-colors hover:text-amber">
                All products
              </Link>
            </li>
            <li>
              <Link href="/compatibility" className="text-sm text-white/80 transition-colors hover:text-amber">
                Find parts for my machine
              </Link>
            </li>
            <li>
              <Link href="/quote-request" className="text-sm text-white/80 transition-colors hover:text-amber">
                Quote request
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Company</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/contact" className="text-sm text-white/80 transition-colors hover:text-amber">
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Share us">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Share us</p>
          <div className="mt-3 flex items-center gap-4 text-white/40">
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-amber" aria-label="LinkedIn">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-amber" aria-label="X (Twitter)">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-amber" aria-label="Facebook">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
            </a>
          </div>
        </nav>

        <nav aria-label="Legal">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Legal</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/privacy" className="text-sm text-white/80 transition-colors hover:text-amber">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-sm text-white/80 transition-colors hover:text-amber">
                Terms of use
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="container-lei py-5 text-xs text-white/45">
          &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
