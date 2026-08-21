'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminMachineBrand } from '@/lib/admin-api';
import { AdminPageHeader } from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

export default function MachinesPage() {
  const auth = useAdminAuth();
  const [brands, setBrands] = useState<AdminMachineBrand[]>([]);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState<Record<number, string>>({});

  const load = () => adminApi.machines().then(setBrands);

  useEffect(() => {
    load();
  }, []);

  const canCreate = auth.hasPermission('MACHINES', 'create');

  const addBrand = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newBrand.trim()) return;
    await adminApi.createMachineBrand(newBrand.trim());
    setNewBrand('');
    await load();
  };

  const addModel = async (brandId: number) => {
    const name = newModel[brandId]?.trim();
    if (!name) return;
    await adminApi.createMachineModel(brandId, name);
    setNewModel((current) => ({ ...current, [brandId]: '' }));
    await load();
  };

  return (
    <div>
      <AdminPageHeader
        title="Machines / OEM"
        description="Brand -> model -> variant tree used by the compatibility finder and product fitment."
      />

      {canCreate && (
        <form onSubmit={addBrand} className="card mb-6 flex items-end gap-3 p-4">
          <div>
            <label htmlFor="brand" className="label">
              New machine brand
            </label>
            <input
              id="brand"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              className="field"
            />
          </div>
          <button type="submit" className="btn-primary">
            Add brand
          </button>
        </form>
      )}

      <div className="space-y-4">
        {brands.map((brand) => (
          <section key={brand.id} className="card p-4">
            <h2 className="text-sm font-bold">{brand.name}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {brand.models.map((model) => (
                <li
                  key={model.id}
                  className="rounded-md border border-ink-line px-2.5 py-1 text-xs"
                >
                  {model.name}
                  {model.variants.length > 0 && (
                    <span className="ml-1 text-ink-muted">
                      ({model.variants.map((v) => v.name).join(', ')})
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {canCreate && (
              <div className="mt-3 flex gap-2">
                <input
                  placeholder="New model name"
                  value={newModel[brand.id] ?? ''}
                  onChange={(e) =>
                    setNewModel((current) => ({ ...current, [brand.id]: e.target.value }))
                  }
                  className="field h-8 max-w-xs py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => addModel(brand.id)}
                  className="btn-secondary px-3 py-1 text-xs"
                >
                  Add model
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
