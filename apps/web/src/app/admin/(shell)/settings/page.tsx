'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminSetting } from '@/lib/admin-api';
import { AdminPageHeader } from '@/components/admin/data-table';

const GROUP_LABELS: Record<string, string> = {
  company: 'Company details',
  quote: 'Quote defaults',
  notify: 'Notifications',
  whatsapp: 'WhatsApp',
  contact: 'Storefront contact',
};

/** Turns "company.legal_name" into "Legal name" when no description exists. */
function labelFor(key: string): string {
  const last = key.split('.').at(-1) ?? key;
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/_/g, ' ');
}

/**
 * SUPER_ADMIN only. Every PLACEHOLDER value here must be replaced before
 * DEMO_MODE can be turned off — the API refuses to boot otherwise.
 *
 * Deliberately does NOT duplicate anything already editable elsewhere in the
 * admin panel (products, categories, machines) — this page is only for
 * values that have nowhere else to live: company identity, quote defaults,
 * and who gets notified.
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
    <div>
      <div>
        <AdminPageHeader
          title="Settings"
          description="Company identity, quote defaults and who gets notified. Everything else — products, categories, machines — is managed on its own page."
        />

        {groups.map((group) => (
          <section key={group} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {GROUP_LABELS[group] ?? group}
            </h2>
            <div className="card divide-y divide-ink-line p-0">
              {settings
                .filter((s) => s.group === group)
                .map((setting) => {
                  const isPlaceholder = setting.value.includes('PLACEHOLDER');
                  const isLong = setting.value.length > 60 || setting.value.includes('\n');
                  const value = editing[setting.key] ?? setting.value;
                  return (
                    <div key={setting.key} className="flex flex-wrap items-start gap-3 p-3">
                      <div className="w-44 shrink-0 pt-1.5">
                        <p className="text-sm font-medium">{labelFor(setting.key)}</p>
                        {setting.description && (
                          <p className="mt-0.5 text-[11px] text-ink-muted">{setting.description}</p>
                        )}
                      </div>
                      {isLong ? (
                        <textarea
                          rows={3}
                          value={value}
                          onChange={(e) =>
                            setEditing((current) => ({ ...current, [setting.key]: e.target.value }))
                          }
                          disabled={setting.isSecret}
                          className={`field flex-1 text-sm ${isPlaceholder ? 'border-amber' : ''}`}
                        />
                      ) : (
                        <input
                          value={value}
                          onChange={(e) =>
                            setEditing((current) => ({ ...current, [setting.key]: e.target.value }))
                          }
                          disabled={setting.isSecret}
                          className={`field flex-1 text-sm ${isPlaceholder ? 'border-amber' : ''}`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => save(setting.key)}
                        disabled={setting.isSecret}
                        className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
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
    </div>
  );
}
