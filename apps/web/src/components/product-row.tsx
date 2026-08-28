import type { ProductListing } from '@/lib/api';
import { ProductGallery } from '@/components/product-gallery';
import { VariantSelector } from '@/components/variant-selector';

/**
 * A catalogue row — the product itself, not a link to it.
 *
 * There are no per-product pages: the reference catalogue this follows puts
 * every product's gallery, specification table and enquiry action on the
 * category page, and links to a product are anchors within it. So a row carries
 * the lot, server-rendered, which is also what keeps the category page worth
 * indexing now that no product page exists to carry that weight.
 *
 * The `id` is the product slug, so /catalogue?category=x#some-product still
 * lands on the right row from anywhere that used to link to a product page.
 */
export function ProductRow({ product }: { product: ProductListing }) {
  return (
    <article
      id={product.slug}
      // Anchored links would otherwise drop the row flush against the sticky
      // header with its heading hidden underneath.
      className="card scroll-mt-24 p-4 sm:p-6"
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
        {/* items-start: without it the grid stretches the gallery to match the
            taller specification column, and the square main image is pulled into
            a tall strip with the photograph stranded in the middle of it. */}
        <ProductGallery product={product} />

        <div className="min-w-0">
          {product.brand && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {product.brand.name}
            </p>
          )}

          <h2 className="mt-1 text-lg font-bold leading-snug">{product.name}</h2>

          {product.description ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {product.description}
            </p>
          ) : (
            product.shortDescription && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {product.shortDescription}
              </p>
            )
          )}

          {product.specs.length > 0 && (
            <dl className="mt-4 grid gap-x-8 gap-y-0 sm:grid-cols-2">
              {product.specs.map((spec) => (
                <div
                  key={spec.slug}
                  className="flex justify-between gap-4 border-b border-ink-line py-2 text-xs"
                >
                  <dt className="text-ink-muted">{spec.name}</dt>
                  <dd className="text-right font-medium">
                    {spec.value}
                    {spec.unit && <span className="ml-1 text-ink-muted">{spec.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-5">
            {/* No price line — see product-card.tsx for why the element goes
                entirely rather than being reworded. */}
            <VariantSelector product={product} />
          </div>
        </div>
      </div>
    </article>
  );
}
