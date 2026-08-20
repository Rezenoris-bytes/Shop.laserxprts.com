import Image from 'next/image';
import Link from 'next/link';
import type { CategoryNode } from '@/lib/api';
import { mediaUrl } from '@/lib/format';

/** Product links shown on a card before "View all" takes over. */
const PREVIEW_LINKS = 3;

/**
 * The catalogue's front door.
 *
 * A grid of categories rather than 150 products: the unfiltered listing was a
 * wall of parts with no way in, and its anchors were unreliable anyway once a
 * result set spilled past one page. Choosing a category first means every row
 * link lands on a page that actually renders it.
 *
 * Each card carries a few product names, not just a count — a buyer looking for
 * a Precitec nozzle can see the category holds one without opening it.
 */
export function CategoryIndex({ categories }: { categories: CategoryNode[] }) {
  const listed = categories.filter((category) => category.productCount > 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listed.map((category) => {
        const products = (category.products ?? []).slice(0, PREVIEW_LINKS);

        return (
          <article key={category.id} className="card group flex flex-col p-4 card-hover">
            <Link
              href={`/catalogue?category=${category.slug}`}
              className="relative mb-4 block aspect-square overflow-hidden rounded border border-ink-line bg-white"
              tabIndex={-1}
              aria-hidden
            >
              {category.image ? (
                <Image
                  src={mediaUrl(category.image.path)}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 260px"
                  className="object-contain p-3 card-zoom"
                />
              ) : (
                <div className="h-full w-full bg-ink-wash" />
              )}
            </Link>

            <h2 className="text-base font-bold leading-snug">
              <Link href={`/catalogue?category=${category.slug}`} className="hover:text-amber-dark">
                {category.name}
              </Link>
            </h2>

            {products.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {products.map((product) => (
                  <li key={product.slug}>
                    <Link
                      href={`/catalogue?category=${category.slug}#${product.slug}`}
                      className="block text-[13px] leading-snug text-ink-muted hover:text-amber-dark"
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto pt-3">
              <Link
                href={`/catalogue?category=${category.slug}`}
                className="text-[13px] font-semibold text-amber-dark underline"
              >
                View all
              </Link>
              <span className="ml-2 text-[11px] text-ink-muted">
                {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
