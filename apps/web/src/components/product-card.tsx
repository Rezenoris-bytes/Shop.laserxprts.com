import Image from 'next/image';
import Link from 'next/link';
import { QuoteButton } from '@/components/quote-button';
import type { ProductCard as ProductCardData } from '@/lib/api';
import { mediaUrl } from '@/lib/format';


/**
 * Where a product lives.
 *
 * Products have no page of their own — each is a row on its category listing,
 * addressed by anchor. The category is always included: it keeps the row on the
 * first page of results, which is what makes the anchor resolve.
 */
function productHref(product: ProductCardData): string {
  return product.category
    ? `/catalogue?category=${product.category.slug}#${product.slug}`
    : `/catalogue#${product.slug}`;
}

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
    <article className="card group flex flex-col overflow-hidden card-hover">
      <Link
        href={productHref(product)}
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-white"
      >
        <ProductImage product={product} className="object-contain p-2 card-zoom" />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.brand && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {product.brand.name}
          </p>
        )}

        <h3 className="mt-1 text-sm font-semibold leading-snug">
          <Link href={productHref(product)} className="hover:text-amber-dark">
            {product.name}
          </Link>
        </h3>

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto pt-3">
          {/* Same wording as the catalogue rows — LEI quotes per customer, so
              no figure appears anywhere on the storefront. */}
          <p className="text-sm font-semibold text-amber-dark">Price on request</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {product.variantCount === 1
              ? '1 option'
              : `${product.variantCount} options`}
            {product.hasStock ? ' · in stock' : ' · on request'}
          </p>

          <QuoteButton product={product} />
        </div>
      </div>
    </article>
  );
}

/**
 * A product's primary photograph, falling back to the glyph.
 *
 * Plain <img> rather than next/image: these are served from our own API off a
 * content-addressed path with immutable caching already set, so the optimiser
 * would add a proxy hop and a config coupling to the API origin for no gain.
 */
function ProductImage({
  product,
  className,
}: {
  product: ProductCardData;
  className?: string;
}) {
  if (!product.image) {
    return <PartGlyph name={product.name} />;
  }

  return (
    <Image
      src={mediaUrl(product.image.path)}
      alt={product.image.alt ?? product.name}
      fill
      // Listing thumbnails are never displayed larger than a card column, so
      // the optimiser is told that rather than serving the 1000px original.
      sizes="(max-width: 640px) 100vw, 220px"
      className={className}
    />
  );
}

/**
 * Placeholder artwork, for products with no photograph on file.
 *
 * A deterministic geometric glyph — clearly not a photograph, so nobody
 * mistakes it for the actual part.
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
