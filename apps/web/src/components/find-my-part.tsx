'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Crosshair, ArrowRight, Info } from 'lucide-react';
import type { MachineBrandNode } from '@/lib/api';

/**
 * §8 Find My Part — machine -> model -> cutting head -> head model -> parts.
 *
 * Two things about this flow are load-bearing:
 *
 * 1. The machine and cutting-head trees are SEPARATE payloads, never one list.
 *    A cutting head is not a machine, and offering "S&A / TEYU" as an answer to
 *    "what machine do you have?" destroys the customer's confidence in every
 *    answer that follows.
 *
 * 2. The head, not the machine, is what a nozzle actually fits. So the head
 *    steps are the ones that drive the search, and the machine steps are
 *    optional context — a customer who knows only "Bodor" can still proceed.
 *
 * Because a cutting-head model and a machine model are both MachineModel rows,
 * the existing `machineModel` catalogue filter already accepts either; no
 * second filter parameter is needed.
 */
export function FindMyPart({
  machines,
  heads,
}: {
  machines: MachineBrandNode[];
  heads: MachineBrandNode[];
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

  const headBrandSlug = heads.find((brand) => String(brand.id) === headBrandId)?.slug;
  const headModelSlug = headModels.find((model) => String(model.id) === headModelId)?.slug;

  // Something must be selected before searching, or the customer is just sent
  // to the unfiltered catalogue they could already reach from the menu.
  const canSearch = Boolean(headModelId || headBrandId || machineModelId || machineBrandId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSearch) return;

    // A head model page is a better destination than a filtered list when we
    // have one: it is grouped by part type and carries the empty state.
    if (headBrandSlug && headModelSlug) {
      router.push(`/brands/cutting-heads/${headBrandSlug}/${headModelSlug}`);
      return;
    }

    const params = new URLSearchParams();
    // Most specific selection wins.
    if (headModelId) params.set('machineModel', headModelId);
    else if (machineModelId) params.set('machineModel', machineModelId);
    else if (headBrandId) params.set('machineBrand', headBrandId);
    else if (machineBrandId) params.set('machineBrand', machineBrandId);
    router.push(`/catalogue?${params.toString()}`);
  };

  const selectClass =
    'w-full rounded-md border border-ink-line bg-white px-3 py-2 text-sm text-ink focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber disabled:bg-ink-wash disabled:opacity-60';
  const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted';

  return (
    <form onSubmit={submit} aria-labelledby="fmp-heading">
      <div className="mb-6 flex items-start gap-3">
        <Crosshair className="mt-0.5 h-7 w-7 shrink-0 text-amber" strokeWidth={2} />
        <div>
          <h1 id="fmp-heading" className="text-2xl font-bold">
            Find my part
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Nozzles, windows and ceramics are chosen by the <strong>cutting head</strong>, not the
            machine. If you know the head, start there — it gives the most accurate answer.
          </p>
        </div>
      </div>

      {/* ── Step 1 & 2: the machine (optional context) ─────────────────── */}
      <fieldset className="rounded-lg border border-ink-line p-4">
        <legend className="px-2 text-sm font-semibold text-ink">Your machine (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fmp-machine-brand" className={labelClass}>
              Machine brand
            </label>
            <select
              id="fmp-machine-brand"
              value={machineBrandId}
              onChange={(event) => {
                setMachineBrandId(event.target.value);
                setMachineModelId('');
              }}
              className={selectClass}
            >
              <option value="">Select brand</option>
              {machines.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fmp-machine-model" className={labelClass}>
              Machine model
            </label>
            <select
              id="fmp-machine-model"
              value={machineModelId}
              onChange={(event) => setMachineModelId(event.target.value)}
              disabled={!machineBrandId || machineModels.length === 0}
              className={selectClass}
            >
              <option value="">
                {!machineBrandId
                  ? 'Choose a brand first'
                  : machineModels.length === 0
                    ? 'No models listed yet'
                    : 'Select model'}
              </option>
              {machineModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* ── Step 3 & 4: the cutting head (what actually decides fitment) ─ */}
      <fieldset className="mt-4 rounded-lg border-2 border-amber/40 bg-amber-wash p-4">
        <legend className="px-2 text-sm font-semibold text-ink">Your cutting head</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fmp-head-brand" className={labelClass}>
              Cutting head brand
            </label>
            <select
              id="fmp-head-brand"
              value={headBrandId}
              onChange={(event) => {
                setHeadBrandId(event.target.value);
                setHeadModelId('');
              }}
              className={selectClass}
            >
              <option value="">Select brand</option>
              {heads.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fmp-head-model" className={labelClass}>
              Cutting head model
            </label>
            <select
              id="fmp-head-model"
              value={headModelId}
              onChange={(event) => setHeadModelId(event.target.value)}
              disabled={!headBrandId || headModels.length === 0}
              className={selectClass}
            >
              <option value="">
                {!headBrandId
                  ? 'Choose a brand first'
                  : headModels.length === 0
                    ? 'No models listed yet'
                    : 'Select model'}
              </option>
              {headModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          The model is usually printed on the head body, near the nozzle.
        </p>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSearch}
          className="inline-flex items-center gap-2 rounded-md bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Find my part
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <Link href="/contact" className="text-sm font-semibold text-ink underline">
          Not sure? Send us a photo instead
        </Link>
      </div>

      {/*
        Honesty about the state of the data. Compatibility is verified part by
        part; while that work is in progress, saying so is better than letting a
        customer conclude the search is broken.
      */}
      <p className="mt-6 flex items-start gap-2 rounded-lg border border-ink-line bg-ink-wash p-3 text-xs leading-relaxed text-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          We are building our compatibility database and publish fitment only once our engineers
          have verified it, so some heads do not yet show a parts list. If yours is one of them,
          contact LEI with the model and we will identify the correct part for you.
        </span>
      </p>
    </form>
  );
}
