'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminSetting } from '@/lib/admin-api';
import { PermissionGate } from '@/components/admin/permission-gate';
import { AdminPageHeader } from '@/components/admin/data-table';

/**
 * SUPER_ADMIN only. Every PLACEHOLDER value here must be replaced before
 * DEMO_MODE can be turned off — the API refuses to boot otherwise.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const load = () => adminApi.settings().then(setSettings);

  useEffect(() => {
    load();
  }, []);

  const groups = [...new Set(settings.map((s) => s.group))];

  const save = async (key: string) => {
    const value = editing[key];
    if (value === undefined) return;
    await adminApi.updateSetting(key, value);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
    await load();
  };

  return (
    <PermissionGate module="SETTINGS">
    <div>
      <AdminPageHeader title="Settings" description="Company details, quote defaults and notification recipients." />

      {groups.map((group) => (
        <section key={group} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">{group}</h2>
          <div className="card divide-y divide-ink-line p-0">
            {settings
              .filter((s) => s.group === group)
              .map((setting) => {
                const isPlaceholder = setting.value.includes('PLACEHOLDER');
                const value = editing[setting.key] ?? setting.value;
                return (
                  <div key={setting.key} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="w-56 shrink-0">
                      <p className="font-mono text-xs">{setting.key}</p>
                      {setting.description && <p className="mt-0.5 text-[11px] text-ink-muted">{setting.description}</p>}
                    </div>
                    <input
                      value={value}
                      onChange={(e) => setEditing((current) => ({ ...current, [setting.key]: e.target.value }))}
                      disabled={setting.isSecret}
                      className={`field flex-1 text-sm ${isPlaceholder ? 'border-amber' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => save(setting.key)}
                      disabled={setting.isSecret}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      {saved === setting.key ? 'Saved' : 'Save'}
                    </button>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
    </PermissionGate>
  );
}
