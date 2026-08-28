'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Crosshair, ArrowRight } from 'lucide-react';
import type { MachineBrandNode } from '@/lib/api';

/**
 * Homepage "Find my part" entry point.
 *
 * Mirrors the full flow on /compatibility, compacted for the hero:
 *   machine brand -> machine model -> cutting head brand -> cutting head model
 *
 * Two rules this component exists to honour:
 *
 * 1. The machine and cutting-head trees are SEPARATE payloads. A cutting head
 *    is not a machine, and a chiller maker is neither — offering "S&A / TEYU"
 *    as an answer to "what machine do you have?" would destroy confidence in
 *    every answer that follows.
 *
 * 2. Fields are revealed progressively. Four dropdowns stacked in a hero reads
 *    as a form to fill in; one dropdown that grows as you answer reads as a
 *    question being asked. The customer only ever sees the next decision.
 */
export function CompatibilityFinder({
  machines,
  heads = [],
}: {
  machines: MachineBrandNode[];
  /** Cutting-head tree. Optional so an API failure degrades to machine-only. */
  heads?: MachineBrandNode[];
}) {
  const router = useRouter();
  const [machineBrandId, setMachineBrandId] = useState('');
  const [machineModelId, setMachineModelId] = useState('');
  const [headBrandId, setHeadBrandId] = useState('');
  const [headModelId, setHeadModelId] = useState('');

  const machineModels = useMemo(
    () => machines.find((brand) => String(brand.id) === machineBrandId)?.models ?? [],
    [machines, machineBrandId],
  );
  const headModels = useMemo(
    () => heads.find((brand) => String(brand.id) === headBrandId)?.models ?? [],
    [heads, headBrandId],
  );

  const headBrand = heads.find((brand) => String(brand.id) === headBrandId);
  const headModel = headModels.find((model) => String(model.id) === headModelId);

  /*
    Progressive reveal.

    The machine model step is skipped entirely when the chosen brand has no
    models recorded — showing a dropdown whose only entry is "no models listed"
    is a dead end that makes the tool look broken.
  */
  const showMachineModel = Boolean(machineBrandId) && machineModels.length > 0;
  const showHeadBrand = Boolean(machineBrandId) && heads.length > 0;
  const showHeadModel = Boolean(headBrandId) && headModels.length > 0;

  const canSearch = Boolean(machineBrandId || headBrandId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSearch) return;

    // A head model page is the better destination when we have one: it is
    // grouped by part type and carries the compatibility empty state.
    if (headBrand && headModel) {
      router.push(`/brands/cutting-heads/${headBrand.slug}/${headModel.slug}`);
      return;
    }

    const params = new URLSearchParams();
    if (headModelId) params.set('machineModel', headModelId);
    else if (machineModelId) params.set('machineModel', machineModelId);
    else if (headBrandId) params.set('machineBrand', headBrandId);
    else if (machineBrandId) params.set('machineBrand', machineBrandId);
    router.push(`/catalogue?${params.toString()}`);
  };

  const selectClass =
    'w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber [&>option]:text-ink';
  const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/80';

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm sm:p-5"
      aria-labelledby="finder-heading"
    >
      <div className="mb-4 flex items-start gap-3">
        <Crosshair className="mt-0.5 h-7 w-7 shrink-0 text-amber" strokeWidth={2} />
        <div>
          <h2 id="finder-heading" className="text-lg font-bold uppercase tracking-wide text-white">
            Find the right part for your laser cutting machine
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Start with your machine. Nozzles, windows and ceramics are decided by the cutting head,
            so we will ask for that next.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="finder-machine-brand" className={labelClass}>
            Machine brand
          </label>
          <select
            id="finder-machine-brand"
            value={machineBrandId}
            onChange={(event) => {
              setMachineBrandId(event.target.value);
              setMachineModelId('');
            }}
            className={selectClass}
          >
            <option value="">Select your machine brand</option>
            {machines.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        {showMachineModel && (
          <div>
            <label htmlFor="finder-machine-model" className={labelClass}>
              Machine model
            </label>
            <select
              id="finder-machine-model"
              value={machineModelId}
              onChange={(event) => setMachineModelId(event.target.value)}
              className={selectClass}
            >
              <option value="">Select model</option>
              {machineModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showHeadBrand && (
          <div>
            <label htmlFor="finder-head-brand" className={labelClass}>
              Cutting head brand
            </label>
            <select
              id="finder-head-brand"
              value={headBrandId}
              onChange={(event) => {
                setHeadBrandId(event.target.value);
                setHeadModelId('');
              }}
              className={selectClass}
            >
              <option value="">Select your cutting head</option>
              {heads.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showHeadModel && (
          <div>
            <label htmlFor="finder-head-model" className={labelClass}>
              Cutting head model
            </label>
            <select
              id="finder-head-model"
              value={headModelId}
              onChange={(event) => setHeadModelId(event.target.value)}
              className={selectClass}
            >
              <option value="">Select model</option>
              {headModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-amber px-4 py-3 text-sm font-bold uppercase tracking-wide text-ink transition-colors hover:bg-amber-dark disabled:opacity-70 disabled:hover:bg-amber"
        disabled={!canSearch}
      >
        Find my part
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
