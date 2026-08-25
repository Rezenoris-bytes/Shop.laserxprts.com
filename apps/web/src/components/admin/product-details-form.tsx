'use client';

import { useState } from 'react';
import { slugify } from '@lei/shared';
import {
  adminApi,
  type AdminCategory,
  type AdminPartBrand,
  type AdminProductDetail,
} from '@/lib/admin-api';

/**
 * Product fields, editable in place.
 *
 * Previously the only thing this screen could change was the active flag —
 * everything else had to go through the CSV importer, which is the wrong tool
 * for fixing one typo in one description.
 *
 * Only changed fields are sent. The API's update schema is partial, and posting
 * the whole record back would overwrite a field another admin edited in the
 * meantime with a value this form merely displayed.
 */
export function ProductDetailsForm({
  product,
  categories,
  brands,
  canUpdate,
  onSaved,
}: {
  product: AdminProductDetail;
  categories: AdminCategory[];
  brands: AdminPartBrand[];
  canUpdate: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const initial = {
    name: product.name,
    slug: product.slug,
    categoryId: String(product.categoryId),
    partBrandId: product.partBrandId === null ? '' : String(product.partBrandId),
    productType: product.productType,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    metaTitle: product.metaTitle ?? '',
    metaDescription: product.metaDescription ?? '',
    isFeatured: product.isFeatured,
  };

  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  // Slug follows the name until the admin edits it directly.
  const [slugTouched, setSlugTouched] = useState(false);

  const set = (key: keyof typeof values, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const setName = (value: string) => {
    setValues((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
    setSaved(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    // Empty text means "clear this optional field", which the API expresses as
    // undefined rather than an empty string that would fail its length rules.
    const payload: Record<string, unknown> = {
      name: values.name,
      slug: values.slug || undefined,
      categoryId: Number(values.categoryId),
      partBrandId: values.partBrandId === '' ? null : Number(values.partBrandId),
      productType: values.productType,
      shortDescription: values.shortDescription || undefined,
      description: values.description || undefined,
      metaTitle: values.metaTitle || undefined,
      metaDescription: values.metaDescription || undefined,
      isFeatured: values.isFeatured,
    };

    try {
      await adminApi.updateProduct(product.id, payload);
      await onSaved();
      setSaved(true);
    } catch (caught) {
      const err = caught as { message: string; fields?: Record<string, string[]> };
      setFieldErrors(err.fields ?? {});
      setError(err.fields ? 'Please correct the highlighted fields.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card mb-6 p-5">
      <h2 className="mb-4 text-base font-semibold">Details</h2>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="p-name" required error={fieldErrors.name}>
            <input
              id="p-name"
              value={values.name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canUpdate}
              className="field"
              required
            />
          </Field>

          <Field
            label="Slug"
            htmlFor="p-slug"
            error={fieldErrors.slug}
            hint="Auto-generated from the name — edit only if you need a different URL."
          >
            <input
              id="p-slug"
              value={values.slug}
              onChange={(event) => {
                setSlugTouched(true);
                set('slug', event.target.value);
              }}
              disabled={!canUpdate}
              className="field"
              // The hyphen is escaped: modern browsers compile `pattern` with
              // the `v` flag, where a bare trailing `-` in a class is a syntax
              // error and the whole attribute is discarded.
              pattern="[a-z0-9\-]+"
              title="Lower case letters, numbers and hyphens only"
            />
          </Field>

          <Field label="Category" htmlFor="p-category" required error={fieldErrors.categoryId}>
            <select
              id="p-category"
              value={values.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
              disabled={!canUpdate}
              className="field"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Brand" htmlFor="p-brand" error={fieldErrors.partBrandId}>
            <select
              id="p-brand"
              value={values.partBrandId}
              onChange={(event) => set('partBrandId', event.target.value)}
              disabled={!canUpdate}
              className="field"
            >
              <option value="">— none —</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type" htmlFor="p-type" error={fieldErrors.productType}>
            <select
              id="p-type"
              value={values.productType}
              onChange={(event) => set('productType', event.target.value)}
              disabled={!canUpdate}
              className="field"
            >
              {['SPARE_PART', 'CONSUMABLE', 'COMPONENT', 'ACCESSORY', 'KIT'].map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Short description"
          htmlFor="p-short"
          error={fieldErrors.shortDescription}
          hint="Shown on cards and search results."
        >
          <textarea
            id="p-short"
            rows={2}
            value={values.shortDescription}
            onChange={(event) => set('shortDescription', event.target.value)}
            disabled={!canUpdate}
            className="field"
          />
        </Field>

        <Field
          label="Description"
          htmlFor="p-description"
          error={fieldErrors.description}
          hint="Shown on the product's row in the catalogue."
        >
          <textarea
            id="p-description"
            rows={5}
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            disabled={!canUpdate}
            className="field"
          />
        </Field>

        <details className="rounded border border-ink-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Search engine listing</summary>
          <div className="mt-3 space-y-3">
            <Field label="Meta title" htmlFor="p-meta-title" error={fieldErrors.metaTitle}>
              <input
                id="p-meta-title"
                value={values.metaTitle}
                onChange={(event) => set('metaTitle', event.target.value)}
                disabled={!canUpdate}
                className="field"
              />
            </Field>
            <Field
              label="Meta description"
              htmlFor="p-meta-description"
              error={fieldErrors.metaDescription}
            >
              <textarea
                id="p-meta-description"
                rows={2}
                value={values.metaDescription}
                onChange={(event) => set('metaDescription', event.target.value)}
                disabled={!canUpdate}
                className="field"
              />
            </Field>
          </div>
        </details>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isFeatured}
            onChange={(event) => set('isFeatured', event.target.checked)}
            disabled={!canUpdate}
          />
          Featured — leads the homepage product strip
        </label>

        {error && <p className="text-xs text-bad">{error}</p>}
        {saved && !error && (
          <p className="text-xs text-ok">Saved. The storefront has been updated.</p>
        )}

        {canUpdate && (
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </form>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="text-bad"> *</span>}
      </label>
      {children}
      {hint && !error?.[0] && <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>}
      {error?.[0] && <p className="mt-1 text-[11px] text-bad">{error[0]}</p>}
    </div>
  );
}
