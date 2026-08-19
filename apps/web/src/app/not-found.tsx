import Link from 'next/link';

/**
 * 404.
 *
 * Withdrawn products land here rather than rendering a 200 empty page — a soft
 * 404 is read as "a working page with no content" and drags on site quality.
 */
export default function NotFound() {
  return (
    <div className="container-lei max-w-lg py-20 text-center">
      <p className="font-mono text-sm text-ink-muted">404</p>
      <h1 className="mt-2 text-2xl font-bold">We could not find that page</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        The part may have been withdrawn, or the address may be mistyped. Try searching for the
        part number, or browse by machine.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/catalogue" className="btn-secondary text-sm">
          Browse catalogue
        </Link>
        <Link href="/compatibility" className="btn-primary text-sm">
          Find parts for my machine
        </Link>
      </div>
    </div>
  );
}
