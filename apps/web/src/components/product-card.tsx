import Link from 'next/link';
import type { ProductCard as ProductCardData } from '@/lib/api';


/**
 * Product card.
 *
 * A card links to the product page rather than adding to the request directly:
 * a product has variants, and which one the customer needs is a decision that
 * belongs on the detail page. Adding "the default variant" from a card is how
 * customers end up with the wrong diameter.
 */
export function ProductCardTile({ product }: { product: ProductCardData }) {


  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link
        href={`/products/${product.slug}`}
        className="flex aspect-[4/3] items-center justify-center bg-ink-wash"
      >
        <PartGlyph name={product.name} />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.brand && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {product.brand.name}
          </p>
        )}

        <h3 className="mt-1 text-sm font-semibold leading-snug">
          <Link href={`/products/${product.slug}`} className="hover:text-amber-dark">
            {product.name}
          </Link>
        </h3>

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto pt-3">
          <p className="text-sm font-semibold text-amber-dark">Get Quote</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {product.variantCount === 1
              ? '1 option'
              : `${product.variantCount} options`}
            {product.hasStock ? ' · in stock' : ' · on request'}
          </p>

          <Link
            href={`/products/${product.slug}`}
            className="btn-secondary mt-3 w-full text-xs"
            aria-label={`View options for ${product.name}`}
          >
            View options
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Placeholder artwork.
 *
 * Real product photography is a dependency LEI has not supplied yet. Rather
 * than shipping a grey box or a stock photo of the wrong part, each card gets a
 * deterministic geometric glyph — clearly not a photograph, so nobody mistakes
 * it for the actual part.
 */
function PartGlyph({ name }: { name: string }) {
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rings = 2 + (seed % 3);
  const rotate = seed % 45;

  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" role="img" aria-label="Product image placeholder">
      <g transform={`rotate(${rotate} 60 45)`} fill="none" stroke="#c3cad3" strokeWidth="1.5">
        {Array.from({ length: rings }).map((_, index) => (
          <circle key={index} cx="60" cy="45" r={10 + index * 8} />
        ))}
        <path d="M60 20v50M35 45h50" strokeWidth="1" opacity="0.5" />
      </g>
    </svg>
  );
}
