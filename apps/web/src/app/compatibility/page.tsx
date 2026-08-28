import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { canonical } from '@/lib/site';
import { FindMyPart } from '@/components/find-my-part';

export const metadata: Metadata = {
  title: 'Find my part',
  description:
    'Tell us your machine and cutting head and we will identify the spares and consumables that fit.',
  alternates: { canonical: canonical('/compatibility') },
};

export const revalidate = 3600;

export default async function FindMyPartPage() {
  // Two SEPARATE trees, not one merged list (§8). Fail soft when the API is
  // unreachable — see the homepage for why the build must survive a backend
  // that is not running yet.
  const [machines, heads] = await Promise.all([
    api.machineTree().catch(() => []),
    api.componentTree('cutting-heads').catch(() => []),
  ]);

  return (
    <div className="container-lei max-w-3xl py-12">
      <FindMyPart machines={machines} heads={heads} />
    </div>
  );
}
