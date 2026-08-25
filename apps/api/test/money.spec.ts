import { calculateLine, calculateQuoteTotals, formatInr, fromPaise, roundHalfUp, toPaise } from '@lei/shared';

/**
 * Money arithmetic.
 *
 * These tests exist because a quote that shows one total in the admin panel and
 * a different one on the PDF is a commercial credibility problem.
 */
describe('paise conversion', () => {
  it('parses rupee strings without floating-point drift', () => {
    expect(toPaise('1234.56')).toBe(123456);
    expect(toPaise('0.01')).toBe(1);
    expect(toPaise('124999.99')).toBe(12499999);
    expect(toPaise('850')).toBe(85000);
  });

  it('rounds the third decimal rather than truncating it', () => {
    expect(toPaise('1.005')).toBe(101);
    expect(toPaise('1.004')).toBe(100);
  });

  it('round-trips through fromPaise', () => {
    for (const amount of ['0.00', '1.05', '999.99', '124999.99']) {
      expect(fromPaise(toPaise(amount))).toBe(amount);
    }
  });

  it('rounds half-away-from-zero, unlike Math.round', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    // Math.round(-2.5) is -2, which would under-credit a credit note.
    expect(roundHalfUp(-2.5)).toBe(-3);
  });

  it('formats with Indian digit grouping', () => {
    expect(formatInr(12499999)).toBe('₹1,24,999.99');
    expect(formatInr(85000)).toBe('₹850.00');
    expect(formatInr(100000000)).toBe('₹10,00,000.00');
  });
});

describe('line calculation', () => {
  it('computes a simple line', () => {
    // 2 x ₹890 nozzle
    const line = calculateLine({
      unitPricePaise: toPaise('890.00'),
      quantityMilli: 2000,
    });

    expect(fromPaise(line.grossPaise)).toBe('1780.00');
    expect(fromPaise(line.lineSubtotalPaise)).toBe('1780.00');
    expect(fromPaise(line.lineTotalPaise)).toBe('1780.00');
  });

  it('applies a discount', () => {
    const line = calculateLine({
      unitPricePaise: toPaise('1000.00'),
      quantityMilli: 1000,
      discountPercent: 10,
    });

    expect(fromPaise(line.discountPaise)).toBe('100.00');
    expect(fromPaise(line.lineSubtotalPaise)).toBe('900.00');
    expect(fromPaise(line.lineTotalPaise)).toBe('900.00');
  });

  it('supports fractional quantities for metred goods', () => {
    // 2.5 metres of cable at ₹340/m
    const line = calculateLine({
      unitPricePaise: toPaise('340.00'),
      quantityMilli: 2500,
    });
    expect(fromPaise(line.grossPaise)).toBe('850.00');
  });
});

describe('quote totals', () => {
  // Rajesh's three parts: nozzle, protective window, ceramic ring.
  const lines = [
    { unitPricePaise: toPaise('890.00'), quantityMilli: 2000 },
    { unitPricePaise: toPaise('420.00'), quantityMilli: 3000 },
    { unitPricePaise: toPaise('180.00'), quantityMilli: 1000 },
  ];

  it('sums line subtotals into the grand total', () => {
    const totals = calculateQuoteTotals({ lines });
    expect(fromPaise(totals.subtotalPaise)).toBe('3220.00');
    expect(fromPaise(totals.totalPaise)).toBe('3220.00');
  });

  it('adds freight to the total', () => {
    const totals = calculateQuoteTotals({
      lines: [{ unitPricePaise: toPaise('1000.00'), quantityMilli: 1000 }],
      freightPaise: toPaise('250.00'),
    });
    expect(fromPaise(totals.totalPaise)).toBe('1250.00');
  });

  it('rounds the grand total to whole rupees and records the adjustment', () => {
    const totals = calculateQuoteTotals({
      lines: [{ unitPricePaise: toPaise('100.05'), quantityMilli: 1000 }],
    });

    expect(fromPaise(totals.totalPaise)).toBe('100.00');
    expect(fromPaise(totals.roundOffPaise)).toBe('-0.05');

    // The printed lines plus round-off must equal the printed total.
    expect(totals.subtotalPaise - totals.discountPaise + totals.freightPaise + totals.roundOffPaise).toBe(
      totals.totalPaise,
    );
  });
});
