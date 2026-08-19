'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi, type AdminMachineBrand, type AdminProductDetail } from '@/lib/admin-api';
import { AdminPageHeader, StatusChip } from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAdminAuth();
  const id = Number(params.id);

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [machines, setMachines] = useState<AdminMachineBrand[]>([]);

  const load = () => adminApi.product(id).then(setProduct);

  useEffect(() => {
    load();
    adminApi.machines().then(setMachines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canUpdate = auth.hasPermission('CATALOGUE', 'update');
  const canUpdateStock = auth.hasPermission('INVENTORY', 'update');

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
              {product.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusChip label={product.isActive ? 'Active' : 'Inactive'} tone={product.isActive ? 'ok' : 'muted'} />
        <StatusChip label={product.productType} tone="muted" />
        {product.hsnCode && <StatusChip label={`HSN ${product.hsnCode}`} tone="muted" />}
        {product.gstRate && <StatusChip label={`GST ${product.gstRate}%`} tone="muted" />}
      </div>

      <VariantsSection product={product} canUpdate={canUpdate} canUpdateStock={canUpdateStock} onChange={load} />
      <CompatibilitySection product={product} machines={machines} canUpdate={canUpdate} onChange={load} />
    </div>
  );
}

function VariantsSection({
  product,
  canUpdate,
  canUpdateStock,
  onChange,
}: {
  product: AdminProductDetail;
  canUpdate: boolean;
  canUpdateStock: boolean;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingStock, setEditingStock] = useState<number | null>(null);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Variants</h2>
        {canUpdate && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className="text-xs font-medium underline">
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
              {['SKU', 'Part number', 'Name', 'Price', 'Stock', 'Status', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line">
            {product.variants.map((variant) => (
              <tr key={variant.id}>
                <td className="px-3 py-2 font-mono text-xs">{variant.sku}</td>
                <td className="px-3 py-2 font-mono text-xs">{variant.partNumber}</td>
                <td className="px-3 py-2">{variant.variantName}</td>
                <td className="px-3 py-2">{variant.price ? `₹${variant.price}` : variant.priceType}</td>
                <td className="px-3 py-2">
                  {editingStock === variant.id ? (
                    <StockEditor
                      variantId={variant.id}
                      current={variant.inventory?.quantity ?? 0}
                      onDone={() => {
                        setEditingStock(null);
                        onChange();
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!canUpdateStock}
                      onClick={() => setEditingStock(variant.id)}
                      className="underline decoration-dotted disabled:no-underline"
                    >
                      {variant.inventory?.quantity ?? 0}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusChip
                    label={variant.inventory?.stockStatus ?? 'UNKNOWN'}
                    tone={
                      variant.inventory?.stockStatus === 'IN_STOCK'
                        ? 'ok'
                        : variant.inventory?.stockStatus === 'LOW_STOCK'
                          ? 'warn'
                          : 'bad'
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <StatusChip label={variant.isActive ? 'Active' : 'Inactive'} tone={variant.isActive ? 'ok' : 'muted'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
        <input id="sku" required value={sku} onChange={(e) => setSku(e.target.value)} className="field w-36" />
      </div>
      <div>
        <label htmlFor="pn" className="label">
          Part number
        </label>
        <input id="pn" required value={partNumber} onChange={(e) => setPartNumber(e.target.value)} className="field w-36" />
      </div>
      <div>
        <label htmlFor="vn" className="label">
          Variant name
        </label>
        <input id="vn" required value={variantName} onChange={(e) => setVariantName(e.target.value)} className="field w-32" />
      </div>
      <div>
        <label htmlFor="price" className="label">
          Price (blank = on request)
        </label>
        <input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="field w-28" />
      </div>
      <button type="submit" className="btn-primary">
        Add
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </form>
  );
}

function StockEditor({ variantId, current, onDone }: { variantId: number; current: number; onDone: () => void }) {
  const [quantity, setQuantity] = useState(String(current));

  const save = async () => {
    await adminApi.updateInventory(variantId, { quantity: Number(quantity), reason: 'COUNT' });
    onDone();
  };

  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="field h-7 w-16 py-0.5 text-xs"
        autoFocus
      />
      <button type="button" onClick={save} className="text-xs font-medium text-ok">
        Save
      </button>
    </span>
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
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Machine compatibility</h2>

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
            <select id="cmodel" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!brandId} className="field w-40">
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
              {row.machineVariant && <span className="text-ink-muted"> ({row.machineVariant.name})</span>}
            </span>
            {row.isVerified ? (
              <span className="text-[11px] text-ok">verified</span>
            ) : (
              canUpdate && (
                <button type="button" onClick={() => verify(row.id)} className="text-[11px] underline">
                  verify
                </button>
              )
            )}
            {canUpdate && (
              <button type="button" onClick={() => remove(row.id)} className="text-[11px] text-bad underline">
                remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
