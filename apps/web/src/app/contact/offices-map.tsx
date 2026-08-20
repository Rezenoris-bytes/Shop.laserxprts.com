'use client';

import { useState } from 'react';
import type { Office } from '@/lib/site';

interface Props {
  offices: Office[];
}

export function OfficesMap({ offices }: Props) {
  // Default to Hosur (Head Office)
  const [selectedOffice, setSelectedOffice] = useState<Office>(offices[0]);

  return (
    <div className="rounded-card border border-ink-line bg-white overflow-hidden shadow-sm">
      {/* ── Mobile Header: Dropdown selector + Active Address Details (visible only on mobile/tablet) ── */}
      <div className="lg:hidden p-5 border-b border-ink-line bg-white flex flex-col gap-3.5">
        <div>
          <label htmlFor="branch-select-mobile" className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
            Select a location
          </label>
          <div className="relative">
            <select
              id="branch-select-mobile"
              value={selectedOffice.city}
              onChange={(e) => {
                const found = offices.find((o) => o.city === e.target.value);
                if (found) setSelectedOffice(found);
              }}
              className="w-full text-sm font-bold bg-ink-wash border border-ink-line py-3 px-4 rounded-md focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber appearance-none"
            >
              {offices.map((office) => (
                <option key={office.city} value={office.city}>
                  {office.city} — {office.type === 'head-office' ? 'Head Office' : office.type === 'branch' ? 'Branch' : 'Service Hub'}
                </option>
              ))}
            </select>
            {/* Custom dropdown arrow indicator */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Selected Branch Active Info Card */}
        <div className="p-4 rounded-md bg-ink-wash border border-ink-line flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-ink">{selectedOffice.city}</span>
            <span
              className={[
                'chip text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                selectedOffice.type === 'head-office'
                  ? 'bg-amber text-ink'
                  : selectedOffice.type === 'branch'
                  ? 'bg-ink text-white'
                  : 'bg-ink-wash text-ink-muted',
              ].join(' ')}
            >
              {selectedOffice.type === 'head-office' ? 'Head Office' : selectedOffice.type === 'branch' ? 'Branch' : 'Service Hub'}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">{selectedOffice.address}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 min-h-[500px]">
        {/* Left Column: Office Selector List (4 cols) — visible only on Desktop */}
        <div className="hidden lg:flex lg:col-span-4 border-r border-ink-line flex-col bg-white">
          <div className="p-4 border-b border-ink-line bg-ink-wash">
            <h3 className="font-bold text-ink text-sm uppercase tracking-wider">Our Branches</h3>
            <p className="text-xs text-ink-muted mt-0.5">Select a location to view on Google Maps</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-ink-line max-h-[450px]">
            {offices.map((office) => {
              const isSelected = selectedOffice.city === office.city;
              return (
                <button
                  key={office.city}
                  type="button"
                  onClick={() => setSelectedOffice(office)}
                  className={[
                    'w-full text-left p-4 transition-colors flex flex-col gap-1.5 focus:outline-none',
                    isSelected
                      ? 'bg-amber-wash border-l-4 border-amber pl-3'
                      : 'hover:bg-ink-wash border-l-4 border-transparent',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-ink">{office.city}</span>
                    <span
                      className={[
                        'chip text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                        office.type === 'head-office'
                          ? 'bg-amber text-ink'
                          : office.type === 'branch'
                          ? 'bg-ink text-white'
                          : 'bg-ink-wash text-ink-muted',
                      ].join(' ')}
                    >
                      {office.type === 'head-office' ? 'Head Office' : office.type === 'branch' ? 'Branch' : 'Service Hub'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                    {office.address}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Google Maps Iframe (8 cols) — active on both mobile & desktop */}
        <div className="lg:col-span-8 relative min-h-[400px] lg:min-h-0 flex flex-col">
          {selectedOffice.type === 'service-hub' ? (
            // Service Hub placeholder with useful support text
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-ink-wash min-h-[350px]">
              <div className="h-16 w-16 rounded-full bg-amber/10 flex items-center justify-center text-amber mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <h4 className="text-base font-bold text-ink">Remote Support & Service Hub</h4>
              <p className="text-sm text-ink-muted max-w-sm mt-2 leading-relaxed">
                We provide reliable on-site engineering, remote diagnostics, and support for clients across {selectedOffice.city}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <a
                  href="tel:+918925842285"
                  className="btn-primary text-xs font-semibold px-4 py-2"
                >
                  Call Support
                </a>
                <a
                  href="mailto:business@laserxprts.com"
                  className="btn-secondary text-xs font-semibold px-4 py-2"
                >
                  Email Enquiry
                </a>
              </div>
            </div>
          ) : (
            // Direct interactive Google Maps iframe embed
            <iframe
              title={`Laser Experts India - ${selectedOffice.city} Map`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(
                selectedOffice.city === 'Hosur' 
                  ? 'Laser Experts India LLP Hosur' 
                  : selectedOffice.address
              )}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
              width="100%"
              height="100%"
              className="flex-1 min-h-[350px] lg:min-h-[480px] border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}

          {/* Quick info overlay banner at the bottom of the map */}
          <div className="bg-ink p-3.5 text-white flex flex-wrap items-center justify-between gap-2 px-4 text-xs">
            <span className="font-medium">
              📍 Current Pin: <span className="text-amber font-bold">{selectedOffice.label}</span>
            </span>
            {selectedOffice.type !== 'service-hub' && (
              <a
                href={selectedOffice.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber font-semibold hover:underline flex items-center gap-1"
              >
                Directions in Google Maps
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
