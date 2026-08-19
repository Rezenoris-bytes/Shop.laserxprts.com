import Link from 'next/link';
import { siteName, siteTagline } from '@/lib/site';

const columns = [
  {
    title: 'Catalogue',
    links: [
      { label: 'All products', href: '/catalogue' },
      { label: 'Find parts for my machine', href: '/compatibility' },
      { label: 'Quote request', href: '/quote-request' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About LEI', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of use', href: '/terms' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-line bg-ink text-white">
      <div className="container-lei grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-bold">{siteName}</p>
          <p className="mt-1.5 text-sm text-white/60">{siteTagline}</p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
              {column.title}
            </p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/80 hover:text-amber">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-lei py-5 text-xs text-white/45">
          &copy; {new Date().getFullYear()} {siteName}. Prices in INR, exclusive of GST unless stated.
        </div>
      </div>
    </footer>
  );
}
