import { Injectable, Logger } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';

export interface CompanyProfile {
  legalName: string;
  gstin: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
}

export interface QuoteDefaults {
  numberPrefix: string;
  validityDays: number;
  paymentTerms: string;
  deliveryTerms: string;
  terms: string;
}

/**
 * Settings, with a short-lived in-process cache.
 *
 * Settings are read on every quote render but change perhaps twice a year.
 * A 60-second in-process cache avoids a database round trip per read.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, string>();
  private cachedAt = 0;
  private readonly ttlMs = 60_000;

  constructor(private readonly repository: SettingsRepository) {}

  private async load(): Promise<Map<string, string>> {
    if (Date.now() - this.cachedAt < this.ttlMs && this.cache.size > 0) {
      return this.cache;
    }
    const rows = await this.repository.findAll();
    this.cache = new Map(rows.map((row) => [row.key, row.value]));
    this.cachedAt = Date.now();
    return this.cache;
  }

  invalidate(): void {
    this.cachedAt = 0;
  }

  async get(key: string, fallback = ''): Promise<string> {
    return (await this.load()).get(key) ?? fallback;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const value = Number(await this.get(key));
    return Number.isFinite(value) ? value : fallback;
  }

  async all() {
    return this.repository.findAll();
  }

  async set(key: string, value: string, updatedById?: number) {
    const result = await this.repository.upsert(key, value, updatedById);
    this.invalidate();
    return result;
  }

  /** LEI's own details, required on every quotation. */
  async companyProfile(): Promise<CompanyProfile> {
    const settings = await this.load();
    return {
      legalName: settings.get('company.legal_name') ?? '',
      gstin: settings.get('company.gstin') ?? '',
      address: settings.get('company.address') ?? '',
      city: settings.get('company.city') ?? '',
      pincode: settings.get('company.pincode') ?? '',
      phone: settings.get('company.phone') ?? '',
      email: settings.get('company.email') ?? '',
      website: settings.get('company.website') ?? '',
    };
  }

  async quoteDefaults(): Promise<QuoteDefaults> {
    const settings = await this.load();
    return {
      numberPrefix: settings.get('quote.number_prefix') ?? 'LEI/Q',
      validityDays: Number(settings.get('quote.validity_days') ?? 15),
      paymentTerms: settings.get('quote.payment_terms') ?? '',
      deliveryTerms: settings.get('quote.delivery_terms') ?? '',
      terms: settings.get('quote.terms') ?? '',
    };
  }

  /**
   * Who gets told about a new enquiry.
   *
   * Returning an empty list is a real operational failure — enquiries would sit
   * unnoticed — so the caller logs loudly rather than failing silently.
   */
  async salesNotificationRecipients(): Promise<string[]> {
    const raw = await this.get('notify.sales_emails');
    return raw
      .split(',')
      .map((address) => address.trim())
      .filter((address) => address.includes('@'));
  }

  /** Storefront contact details, served to the frontend so nothing is hardcoded. */
  async publicContact() {
    const settings = await this.load();
    return {
      phone: settings.get('contact.phone') ?? '',
      email: settings.get('company.email') ?? '',
      whatsappNumber: settings.get('whatsapp.number') ?? '',
      address: settings.get('company.address') ?? '',
      city: settings.get('company.city') ?? '',
      gstin: settings.get('company.gstin') ?? '',
    };
  }

  /** Keys still holding PLACEHOLDER — surfaced on the admin dashboard. */
  async placeholderKeys(): Promise<string[]> {
    const settings = await this.load();
    return [...settings.entries()]
      .filter(([, value]) => value.includes('PLACEHOLDER'))
      .map(([key]) => key);
  }
}
