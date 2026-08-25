'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  adminApi,
  type AdminCategory,
  type AdminMachineBrand,
  type AdminPartBrand,
  type AdminProductDetail,
} from '@/lib/admin-api';
import { AdminPageHeader, StatusChip } from '@/components/admin/data-table';
import { ProductDetailsForm } from '@/components/admin/product-details-form';
import { ProductMediaManager } from '@/components/admin/product-media-manager';
import { useAdminAuth } from '@/lib/admin-auth';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAdminAuth();
  const id = Number(params.id);

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [machines, setMachines] = useState<AdminMachineBrand[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [brands, setBrands] = useState<AdminPartBrand[]>([]);

  const load = () => adminApi.product(id).then(setProduct);

  useEffect(() => {
    load();
    adminApi.machines().then(setMachines);
    adminApi.categories().then(setCategories);
    adminApi.partBrands().then(setBrands);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canUpdate = auth.hasPermission('CATALOGUE', 'update');
  const canDelete = auth.hasPermission('CATALOGUE', 'delete');

  if (!product) return <p className="text-sm text-ink-muted">Loading…</p>;

  const toggleActive = async () => {
    await adminApi.updateProduct(id, { isActive: !product.isActive });
    await load();
  };

  return (
    <div>
      <AdminPageHeader
        title={product.name}
        description={`${product.variants.length} variant(s)`}
        action={
          canUpdate && (
            <button type="button" onClick={toggleActive} className="btn-secondary text-sm">
              {product.isActive ? 'Unpublish' : 'Publish'}
            </button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusChip
          label={product.isActive ? 'Published' : 'Unpublished'}
          tone={product.isActive ? 'ok' : 'muted'}
        />
        <StatusChip label={product.productType} tone="muted" />
      </div>

      <ProductDetailsForm
        product={product}
        categories={categories}
        brands={brands}
        canUpdate={canUpdate}
        onSaved={load}
      />

      <ProductMediaManager
        productId={product.id}
        media={product.media ?? []}
        canUpdate={canUpdate}
        canDelete={canDelete}
        // The manager returns the fresh gallery, so the page updates without a
        // second round trip for the whole product.
        onChange={(media) => setProduct((current) => (current ? { ...current, media } : current))}
      />

      <VariantsSection
        product={product}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onChange={load}
      />
      <CompatibilitySection
        product={product}
        machines={machines}
        canUpdate={canUpdate}
        onChange={load}
      />
    </div>
  );
}

function VariantsSection({
  product,
  canUpdate,
  canDelete,
  onChange,
}: {
  product: AdminProductDetail;
  canUpdate: boolean;
  canDelete: boolean;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Variants</h2>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="text-xs font-medium underline"
          >
            {showForm ? 'Cancel' : '+ Add variant'}
          </button>
        )}
      </div>

      {showForm && (
        <AddVariantForm
          productId={product.id}
          onCreated={() => {
            setShowForm(false);
            onChange();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-md border border-ink-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-ink-line bg-ink-wash">
            <tr>
              {['SKU', 'Part number', 'Name', 'Price', 'Status', ''].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line">
            {product.variants.map((variant) =>
              editingId === variant.id ? (
                <EditVariantRow
                  key={variant.id}
                  productId={product.id}
                  variant={variant}
                  onDone={() => {
                    setEditingId(null);
                    onChange();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={variant.id}>
                  <td className="px-3 py-2 font-mono text-xs">{variant.sku}</td>
                  <td className="px-3 py-2 font-mono text-xs">{variant.partNumber}</td>
                  <td className="px-3 py-2">{variant.variantName}</td>
                  <td className="px-3 py-2">
                    {variant.price ? `₹${variant.price}` : variant.priceType}
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip
                      label={variant.isActive ? 'Active' : 'Inactive'}
                      tone={variant.isActive ? 'ok' : 'muted'}
                    />
                    {variant.isDefault && (
                      <span className="ml-1.5 text-[11px] text-ink-muted">default</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => setEditingId(variant.id)}
                        className="text-xs font-medium underline"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete variant "${variant.variantName}" (${variant.sku})? This can't be undone from here.`,
                            )
                          )
                            return;
                          await adminApi.deleteVariant(variant.id, product.id);
                          onChange();
                        }}
                        className="ml-3 text-xs font-medium text-bad underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditVariantRow({
  productId,
  variant,
  onDone,
  onCancel,
}: {
  productId: number;
  variant: AdminProductDetail['variants'][number];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [sku, setSku] = useState(variant.sku);
  const [partNumber, setPartNumber] = useState(variant.partNumber);
  const [variantName, setVariantName] = useState(variant.variantName);
  const [price, setPrice] = useState(variant.price ?? '');
  const [isActive, setIsActive] = useState(variant.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateVariant(variant.id, {
        productId,
        sku,
        partNumber,
        variantName,
        price: price === '' ? null : Number(price),
        priceType: price === '' ? 'ON_REQUEST' : 'FIXED',
        isActive,
      });
      onDone();
    } catch {
      setError('Could not save. SKU may already be in use.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-amber-wash/40">
      <td className="px-3 py-2">
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="field w-32 font-mono text-xs"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={partNumber}
          onChange={(e) => setPartNumber(e.target.value)}
          className="field w-32 font-mono text-xs"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={variantName}
          onChange={(e) => setVariantName(e.target.value)}
          className="field w-28"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={price}
          placeholder="On request"
          onChange={(e) => setPrice(e.target.value)}
          className="field w-24"
        />
      </td>
      <td className="px-3 py-2">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="btn-primary px-3 py-1 text-xs"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="ml-2 text-xs underline">
          Cancel
        </button>
        {error && <p className="mt-1 text-[11px] text-bad">{error}</p>}
      </td>
    </tr>
  );
}

function AddVariantForm({ productId, onCreated }: { productId: number; onCreated: () => void }) {
  const [sku, setSku] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [variantName, setVariantName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await adminApi.createVariant({
        productId,
        sku,
        partNumber,
        variantName,
        price: price ? Number(price) : null,
        priceType: price ? 'FIXED' : 'ON_REQUEST',
        unitOfMeasure: 'PIECE',
        packSize: 1,
        minOrderQty: 1,
        isDefault: false,
        position: 0,
      });
      onCreated();
    } catch {
      setError('Could not create variant. SKU may already be in use.');
    }
  };

  return (
    <form onSubmit={submit} className="card mb-3 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label htmlFor="sku" className="label">
          SKU
        </label>
        <input
          id="sku"
          required
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="field w-36"
        />
      </div>
      <div>
        <label htmlFor="pn" className="label">
          Part number
        </label>
        <input
          id="pn"
          required
          value={partNumber}
          onChange={(e) => setPartNumber(e.target.value)}
          className="field w-36"
        />
      </div>
      <div>
        <label htmlFor="vn" className="label">
          Variant name
        </label>
        <input
          id="vn"
          required
          value={variantName}
          onChange={(e) => setVariantName(e.target.value)}
          className="field w-32"
        />
      </div>
      <div>
        <label htmlFor="price" className="label">
          Price (blank = on request)
        </label>
        <input
          id="price"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="field w-28"
        />
      </div>
      <button type="submit" className="btn-primary">
        Add
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </form>
  );
}

function CompatibilitySection({
  product,
  machines,
  canUpdate,
  onChange,
}: {
  product: AdminProductDetail;
  machines: AdminMachineBrand[];
  canUpdate: boolean;
  onChange: () => void;
}) {
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');

  const models = machines.find((b) => String(b.id) === brandId)?.models ?? [];

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!brandId || !modelId) return;
    await adminApi.createCompatibility({
      productId: product.id,
      machineBrandId: Number(brandId),
      machineModelId: Number(modelId),
      isVerified: true, // an admin adding it directly is confirming it
    });
    setModelId('');
    onChange();
  };

  const verify = async (id: number) => {
    await adminApi.verifyCompatibility(id);
    onChange();
  };

  const remove = async (id: number) => {
    await adminApi.deleteCompatibility(id);
    onChange();
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Machine compatibility
      </h2>

      {canUpdate && (
        <form onSubmit={add} className="card mb-3 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label htmlFor="cbrand" className="label">
              Brand
            </label>
            <select
              id="cbrand"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setModelId('');
              }}
              className="field w-40"
            >
              <option value="">Select</option>
              {machines.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cmodel" className="label">
              Model
            </label>
            <select
              id="cmodel"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={!brandId}
              className="field w-40"
            >
              <option value="">Select</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Add (verified)
          </button>
        </form>
      )}

      <ul className="flex flex-wrap gap-2">
        {product.compatibility.map((row) => (
          <li
            key={row.id}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
              row.isVerified ? 'border-ok/30 bg-green-50' : 'border-ink-line bg-white'
            }`}
          >
            <span>
              {row.machineBrand.name} {row.machineModel.name}
              {row.machineVariant && (
                <span className="text-ink-muted"> ({row.machineVariant.name})</span>
              )}
            </span>
            {row.isVerified ? (
              <span className="text-[11px] text-ok">verified</span>
            ) : (
              canUpdate && (
                <button
                  type="button"
                  onClick={() => verify(row.id)}
                  className="text-[11px] underline"
                >
                  verify
                </button>
              )
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => remove(row.id)}
                className="text-[11px] text-bad underline"
              >
                remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
