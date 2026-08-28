'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi, type AdminCategory, type AdminPartBrand } from '@/lib/admin-api';
import { AdminBreadcrumb, AdminPageHeader } from '@/components/admin/data-table';
import { ApiRequestError } from '@/lib/api';

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [brands, setBrands] = useState<AdminPartBrand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    partBrandId: '',
    productType: 'SPARE_PART',
    shortDescription: '',
  });

  useEffect(() => {
    adminApi.categories().then(setCategories);
    adminApi.partBrands().then(setBrands);
  }, []);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const product = await adminApi.createProduct({
        name: form.name,
        categoryId: Number(form.categoryId),
        partBrandId: form.partBrandId ? Number(form.partBrandId) : null,
        productType: form.productType,
        shortDescription: form.shortDescription || undefined,
        isActive: true,
      });
      router.push(`/admin/products/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <AdminBreadcrumb
        items={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Products', href: '/admin/products' },
          { label: 'New product' },
        ]}
      />
      <AdminPageHeader
        title="New product"
        description="Add variants and compatibility after creating the product."
      />

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label htmlFor="name" className="label">
            Name
          </label>
          <input
            id="name"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="field"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="category" className="label">
              Category
            </label>
            <select
              id="category"
              required
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
              className="field"
            >
              <option value="">Select</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent ? `${c.parent.name} / ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="brand" className="label">
              Part brand
            </label>
            <select
              id="brand"
              value={form.partBrandId}
              onChange={(e) => set('partBrandId', e.target.value)}
              className="field"
            >
              <option value="">None</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="type" className="label">
            Product type
          </label>
          <select
            id="type"
            value={form.productType}
            onChange={(e) => set('productType', e.target.value)}
            className="field"
          >
            {['SPARE_PART', 'CONSUMABLE', 'COMPONENT', 'ACCESSORY', 'KIT'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="short" className="label">
            Short description
          </label>
          <textarea
            id="short"
            rows={2}
            value={form.shortDescription}
            onChange={(e) => set('shortDescription', e.target.value)}
            className="field"
          />
        </div>

        {error && <p className="text-xs text-bad">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Creating…' : 'Create product'}
        </button>
      </form>
    </div>
  );
}
