import {
  buildVariantSearchKey,
  normalizeEmail,
  normalizePhone,
  normalizeSearchKey,
  slugify,
} from '@lei/shared';

/**
 * Search-key normalisation.
 *
 * This is the fix for the failure mode that matters most on this site: a
 * customer typing their exact part number and being told it does not exist.
 * MySQL FULLTEXT splits "D27.9 T4.1" on punctuation and then discards tokens
 * shorter than innodb_ft_min_token_size, so the query degrades to "D27".
 */
describe('normalizeSearchKey', () => {
  it('strips punctuation and spaces from real part numbers', () => {
    expect(normalizeSearchKey('D27.9 T4.1')).toBe('D279T41');
    expect(normalizeSearchKey('M11 H15')).toBe('M11H15');
    expect(normalizeSearchKey('NZ-SL-H15-15')).toBe('NZSLH1515');
  });

  it('produces the same key regardless of how the customer types it', () => {
    const variants = ['D27.9 T4.1', 'd27.9t4.1', 'D27-9 T4/1', 'D27,9  T4.1'];
    const keys = variants.map(normalizeSearchKey);
    expect(new Set(keys).size).toBe(1);
  });

  it('is applied identically at write time and read time', () => {
    // If these ever diverge, the index written by the importer silently stops
    // matching queries built by the search endpoint.
    const stored = buildVariantSearchKey({
      partNumber: 'D27.9 T4.1',
      sku: 'PW-D279-T41',
      variantName: 'T4.1',
      productName: 'Protective Window',
    });
    expect(stored).toContain(normalizeSearchKey('D27.9 T4.1'));
    expect(stored).toContain(normalizeSearchKey('PW-D279-T41'));
  });

  it('puts the part number first, as the highest-confidence match', () => {
    const key = buildVariantSearchKey({ partNumber: 'D1.5 H15', sku: 'NZ-SL-H15-15' });
    expect(key.startsWith('D15H15')).toBe(true);
  });

  it('tolerates missing fields', () => {
    expect(buildVariantSearchKey({ sku: 'ABC-1' })).toBe('ABC1');
    expect(buildVariantSearchKey({})).toBe('');
  });
});

describe('customer match keys', () => {
  it('normalises email for find-or-create', () => {
    expect(normalizeEmail('  Rajesh@Example.COM ')).toBe('rajesh@example.com');
  });

  it('normalises Indian phone numbers to E.164', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });

  it('returns null for input that cannot be a phone number', () => {
    // The caller falls back to email matching rather than creating a junk key.
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('n/a')).toBeNull();
  });
});

describe('slugify', () => {
  it('produces clean URL slugs', () => {
    expect(slugify('Raytools Single Layer Nozzle — H15')).toBe('raytools-single-layer-nozzle-h15');
    expect(slugify('Protective Windows  &  Lenses')).toBe('protective-windows-lenses');
  });

  it('never emits leading, trailing or doubled hyphens', () => {
    const slug = slugify('  ***Focus Lens***  ');
    expect(slug).toBe('focus-lens');
    expect(slug).not.toMatch(/^-|-$|--/);
  });
});
