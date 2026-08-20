'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { ProductDetail } from '@/lib/api';
import { mediaUrl } from '@/lib/format';

/** Only what the gallery reads, so a catalogue row can use it too. */
type GalleryProduct = Pick<ProductDetail, 'name' | 'images'>;

/**
 * Product image gallery.
 *
 * Large image plus thumbnail strip, following the reference layout. Thumbnails
 * are rendered as buttons rather than links so selecting one never leaves the
 * page or pushes history the customer has to unwind.
 *
 * Images are `object-contain` on white throughout: these are catalogue shots of
 * machined parts at assorted aspect ratios, and cropping them to fill a square
 * cuts the tip off a nozzle — the one feature the buyer is checking.
 */
export function ProductGallery({ product }: { product: GalleryProduct }) {
  const images = product.images ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className="card grid aspect-[4/3] place-items-center bg-ink-wash">
        <svg
          viewBox="0 0 200 150"
          className="h-3/5 w-3/5"
          role="img"
          aria-label={`${product.name} — no photograph on file`}
        >
          <g fill="none" stroke="#b9c2cc" strokeWidth="2">
            <circle cx="100" cy="75" r="46" />
            <circle cx="100" cy="75" r="30" />
            <circle cx="100" cy="75" r="14" />
            <path d="M100 20v110M45 75h110" strokeWidth="1" opacity="0.4" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    /*
      Main image left, thumbnail column right.

      THE MAIN IMAGE OWNS THE HEIGHT. The thumbnail list is taken out of flow
      (absolute inside a plain-width column) so its length can never drive the
      row: stretching the two together let eight thumbnails dictate a 568px row
      and squeezed the photo into a tall empty strip. Out of flow, the column
      inherits the main image's square height and scrolls inside it.

      Below sm the column becomes a horizontal strip under the image, where a
      64px-wide vertical rail would eat a third of the screen.
    */
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="card relative aspect-square min-w-0 flex-1 overflow-hidden bg-white">
        <Image
          src={mediaUrl(active.path)}
          alt={active.alt ?? product.name}
          fill
          sizes="(max-width: 1024px) 100vw, 560px"
          // A single small inset, not padding on both the card and the image —
          // doubling it shrank the photograph for no visual gain.
          className="object-contain p-3"
          // The largest element above the fold on this page, so it is fetched
          // eagerly and flagged for LCP rather than lazily like the thumbnails.
          priority
        />
      </div>

      {images.length > 1 && (
        /*
          This wrapper is what the row measures: it stretches to the main
          image's height while its absolutely-positioned list contributes no
          height of its own, so any number of thumbnails scrolls inside a row
          the photograph defines.
        */
        <div className="relative shrink-0 sm:w-[72px]">
          <ul
            className="flex gap-2 overflow-x-auto pb-1
                       sm:absolute sm:inset-0 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:pb-0 sm:pr-1"
          >
            {images.map((image, index) => (
              <li key={image.id} className="shrink-0">
                <button
                  type="button"
                  // Hover swaps the main image, so scanning the strip with the
                  // mouse previews each shot without a click. Click still does
                  // the same thing — it is the only way through on touch, where
                  // hover never fires — and focus mirrors it so tabbing along
                  // the strip previews too.
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-current={index === activeIndex}
                  className={[
                    'grid h-16 w-16 place-items-center overflow-hidden rounded border bg-white p-1 transition-colors',
                    index === activeIndex
                      ? 'border-amber ring-2 ring-amber'
                      : 'border-ink-line hover:border-ink',
                  ].join(' ')}
                >
                  <Image
                    src={mediaUrl(image.path)}
                    alt=""
                    width={56}
                    height={56}
                    // A fixed box, not `w-auto`: an auto-sized image has no
                    // intrinsic size until it loads, so it lays out at 0x0 and
                    // the lazy-loading observer never fires — it waits for a
                    // size that only loading would give it.
                    className="h-14 w-14 object-contain"
                    // Four ~3KB thumbnails sitting directly under the main image.
                    // Deferring them saves nothing worth having and leaves the
                    // strip blank in any context where the observer is slow to
                    // run, so they load with the page.
                    loading="eager"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
