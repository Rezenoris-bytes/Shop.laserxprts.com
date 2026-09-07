'use client';

import { useRef, useState } from 'react';
import { adminApi, type AdminProductMedia } from '@/lib/admin-api';
import { mediaUrl } from '@/lib/format';

/**
 * Product gallery management.
 *
 * Order and primary flag here ARE the storefront gallery — the public product
 * row reads the same `sortOrder` and `isPrimary`, so what an admin arranges is
 * exactly what a customer sees, with no second "publish images" step to forget.
 *
 * Reordering is by move-left/move-right rather than drag: it works on touch and
 * with a keyboard, and the whole order is submitted as one list so the server
 * can reject a partial sequence instead of interleaving positions.
 */
export function ProductMediaManager({
  productId,
  media,
  canUpdate,
  canDelete,
  onChange,
}: {
  productId: number;
  media: AdminProductMedia[];
  canUpdate: boolean;
  canDelete: boolean;
  onChange: (media: AdminProductMedia[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  // Counter prevents isDragging flickering when cursor moves across child elements.
  const dragCounter = useRef(0);

  /** Every mutation reports through here so one failure cannot leave the UI stuck busy. */
  const run = async (action: () => Promise<AdminProductMedia[]>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      onChange(await action());
      if (success) setNotice(success);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await adminApi.uploadProductMedia(productId, Array.from(files));
      onChange(result.media);
      if (result.failures.length > 0) {
        setError(
          result.failures.map((failure) => `${failure.filename}: ${failure.message}`).join(' · '),
        );
      }
      if (result.added > 0) {
        setNotice(`${result.added} image${result.added === 1 ? '' : 's'} uploaded`);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
      if (addRef.current) addRef.current.value = '';
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...media];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void run(
      () =>
        adminApi.reorderProductMedia(
          productId,
          next.map((row) => row.id),
        ),
      'Order saved',
    );
  };

  return (
    <section className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Images</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {media.length === 0
              ? 'No images yet — the storefront shows a placeholder.'
              : `${media.length} image${media.length === 1 ? '' : 's'}. The first is used on cards and search.`}
          </p>
        </div>

        {canUpdate && (
          <div>
            <input
              ref={addRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              multiple
              className="hidden"
              onChange={(event) => void upload(event.target.files)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => addRef.current?.click()}
              className="btn-primary text-sm"
            >
              {busy ? 'Working…' : 'Upload images'}
            </button>
          </div>
        )}
      </div>

      {canUpdate && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop images here or click to browse"
          onClick={() => !busy && addRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !busy && addRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            dragCounter.current += 1;
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            dragCounter.current -= 1;
            if (dragCounter.current === 0) setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragCounter.current = 0;
            setIsDragging(false);
            const files = Array.from(e.dataTransfer.files).filter((f) =>
              f.type.startsWith('image/'),
            );
            if (files.length === 0) {
              setError('Only image files are accepted (JPEG, PNG, WebP, AVIF, GIF).');
              return;
            }
            void upload({
              length: files.length,
              item: (i: number) => files[i] ?? null,
              [Symbol.iterator]: () => files[Symbol.iterator](),
            } as unknown as FileList);
          }}
          className={[
            'mb-4 flex cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-all duration-150',
            media.length === 0 ? 'py-12' : 'py-5',
            isDragging
              ? 'scale-[1.01] border-amber bg-amber/10 text-amber'
              : 'border-ink-line text-ink-muted hover:border-amber/50 hover:text-ink',
            busy ? 'pointer-events-none opacity-50' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-transform duration-150 ${isDragging ? 'scale-125' : ''} ${media.length === 0 ? 'h-9 w-9' : 'h-6 w-6'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <span className={`font-medium ${media.length === 0 ? 'text-sm' : 'text-xs'}`}>
            {isDragging ? 'Drop to upload' : 'Drag & drop images here'}
          </span>
          {media.length === 0 && (
            <span className="text-xs">or click to browse · JPEG, PNG, WebP, AVIF, GIF</span>
          )}
        </div>
      )}

      {/* Hidden input reused for whichever slot is being replaced. */}
      <input
        ref={replaceRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const mediaId = replacingId;
          if (file && mediaId !== null) {
            void run(
              () => adminApi.replaceProductMedia(productId, mediaId, file),
              'Image replaced',
            );
          }
          setReplacingId(null);
          if (replaceRef.current) replaceRef.current.value = '';
        }}
      />

      {error && <p className="mb-3 text-xs text-bad">{error}</p>}
      {notice && !error && <p className="mb-3 text-xs text-ok">{notice}</p>}

      {media.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((row, index) => (
            <li key={row.id} className="rounded border border-ink-line p-2">
              <div className="relative aspect-square overflow-hidden rounded bg-white">
                {/* Plain <img>: these are admin previews behind auth, and the
                    optimiser would cache variants of images being replaced. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(row.file.path)}
                  alt={row.altText ?? ''}
                  className="h-full w-full object-contain"
                />
                {row.isPrimary && (
                  <span className="absolute left-1 top-1 rounded bg-amber px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                    Primary
                  </span>
                )}
              </div>

              <p
                className="mt-1.5 truncate text-[10px] text-ink-muted"
                title={row.file.originalName}
              >
                {row.file.width}×{row.file.height} · {Math.round(row.file.sizeBytes / 1024)}KB
              </p>

              {canUpdate && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                    aria-label="Move earlier"
                    className="rounded border border-ink-line px-1.5 py-0.5 text-[11px] disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === media.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Move later"
                    className="rounded border border-ink-line px-1.5 py-0.5 text-[11px] disabled:opacity-40"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    disabled={busy || row.isPrimary}
                    onClick={() =>
                      void run(
                        () => adminApi.setPrimaryProductMedia(productId, row.id),
                        'Primary image set',
                      )
                    }
                    className="rounded border border-ink-line px-1.5 py-0.5 text-[11px] disabled:opacity-40"
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setReplacingId(row.id);
                      replaceRef.current?.click();
                    }}
                    className="rounded border border-ink-line px-1.5 py-0.5 text-[11px] disabled:opacity-40"
                  >
                    Replace
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm('Remove this image from the product?')) return;
                        void run(
                          () => adminApi.deleteProductMedia(productId, row.id),
                          'Image removed',
                        );
                      }}
                      className="rounded border border-ink-line px-1.5 py-0.5 text-[11px] text-bad disabled:opacity-40"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
