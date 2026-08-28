'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';

export interface UploadedPhoto {
  fileId: number;
  name: string;
}

/**
 * "Upload a Photo of Your Part" (§24).
 *
 * Uploads immediately on selection rather than at submit, and reports ids back
 * to the parent form. Two reasons, both about not losing enquiries:
 *
 *   - A workshop photo over site 4G can take far longer than the rest of the
 *     form. Deferring it to submit means the customer sits on a spinner after
 *     pressing the button they were told would finish the job.
 *   - If an upload fails, only that photo fails. The enquiry itself still
 *     submits, which matters because the enquiry is the thing with commercial
 *     value.
 *
 * Deliberately makes NO claim about what the photo shows. §24 forbids inferring
 * compatibility from an image; this control routes it to a human and says so.
 */
export function PartPhotoUpload({
  photos,
  onChange,
  max = 4,
}: {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const room = max - photos.length;
      const uploaded = await api.uploadEnquiryPhotos(Array.from(files).slice(0, room));
      onChange([...photos, ...uploaded]);
    } catch {
      setError('That photo could not be uploaded. You can still send your enquiry without it.');
    } finally {
      setBusy(false);
      // Clear the input so re-picking the same file fires onChange again.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (fileId: number) => onChange(photos.filter((photo) => photo.fileId !== fileId));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
        Photo of your part (optional)
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        A photo of the nozzle, ceramic ring, window, head or machine nameplate helps us identify the
        exact part. Our team confirms it — we never guess fitment from a photo alone.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => void pick(event.target.files)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || photos.length >= max}
          className="inline-flex items-center gap-2 rounded-md border border-ink-line bg-white px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-amber disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
          {busy ? 'Uploading…' : photos.length >= max ? `Maximum ${max} photos` : 'Add a photo'}
        </button>

        {photos.map((photo) => (
          <span
            key={photo.fileId}
            className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md border border-ink-line bg-ink-wash px-2.5 py-1.5 text-xs"
          >
            <span className="truncate">{photo.name}</span>
            <button
              type="button"
              onClick={() => remove(photo.fileId)}
              aria-label={`Remove ${photo.name}`}
              className="shrink-0 text-ink-muted hover:text-bad"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
