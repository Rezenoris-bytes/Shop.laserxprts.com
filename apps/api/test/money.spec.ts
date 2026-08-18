import {
  TaxTreatment,
  calculateLine,
  calculateQuoteTotals,
  formatInr,
  fromPaise,
  resolveTaxTreatment,
  roundHalfUp,
  toPaise,
} from '@lei/shared';

/**
 * Money and GST arithmetic.
 *
 * These tests exist because a quote that shows one total in the admin panel and
 * a different one on the PDF is a commercial credibility problem, and because
 * charging the wrong GST split leaves the customer unable to claim input credit.
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
    // 2 x ₹890 nozzle at 18% GST
    const line = calculateLine({
      unitPricePaise: toPaise('890.00'),
      quantityMilli: 2000,
      gstRatePercent: 18,
    });

    expect(fromPaise(line.grossPaise)).toBe('1780.00');
    expect(fromPaise(line.lineSubtotalPaise)).toBe('1780.00');
    expect(fromPaise(line.gstAmountPaise)).toBe('320.40');
    expect(fromPaise(line.lineTotalPaise)).toBe('2100.40');
  });

  it('applies a discount before tax', () => {
    const line = calculateLine({
      unitPricePaise: toPaise('1000.00'),
      quantityMilli: 1000,
      discountPercent: 10,
      gstRatePercent: 18,
    });

    expect(fromPaise(line.discountPaise)).toBe('100.00');
    expect(fromPaise(line.lineSubtotalPaise)).toBe('900.00');
    expect(fromPaise(line.gstAmountPaise)).toBe('162.00');
    expect(fromPaise(line.lineTotalPaise)).toBe('1062.00');
  });

  it('supports fractional quantities for metred goods', () => {
    // 2.5 metres of cable at ₹340/m
    const line = calculateLine({
      unitPricePaise: toPaise('340.00'),
      quantityMilli: 2500,
      gstRatePercent: 18,
    });
    expect(fromPaise(line.grossPaise)).toBe('850.00');
  });
});

describe('GST treatment by place of supply', () => {
  it('splits CGST/SGST within the same state', () => {
    expect(resolveTaxTreatment('27', '27')).toBe(TaxTreatment.CGST_SGST);
  });

  it('charges IGST across states', () => {
    expect(resolveTaxTreatment('27', '33')).toBe(TaxTreatment.IGST);
  });

  it('defaults to IGST when the customer state is unknown', () => {
    // Charging IGST when CGST+SGST was due is correctable. The reverse leaves
    // the customer unable to claim credit, so this is the safe default.
    expect(resolveTaxTreatment('27', null)).toBe(TaxTreatment.IGST);
  });
});

describe('quote totals — the same basket, both tax treatments', () => {
  // Rajesh's three parts: nozzle, protective window, ceramic ring.
  const lines = [
    { unitPricePaise: toPaise('890.00'), quantityMilli: 2000, gstRatePercent: 18 },
    { unitPricePaise: toPaise('420.00'), quantityMilli: 3000, gstRatePercent: 18 },
    { unitPricePaise: toPaise('180.00'), quantityMilli: 1000, gstRatePercent: 18 },
  ];

  it('intra-state: CGST + SGST, split exactly in half', () => {
    const totals = calculateQuoteTotals({ lines, treatment: TaxTreatment.CGST_SGST });

    expect(fromPaise(totals.taxableAmountPaise)).toBe('3220.00');
    expect(fromPaise(totals.totalGstPaise)).toBe('579.60');
    expect(fromPaise(totals.cgstPaise)).toBe('289.80');
    expect(fromPaise(totals.sgstPaise)).toBe('289.80');
    expect(totals.igstPaise).toBe(0);
    // CGST + SGST must reconstruct the total GST exactly.
    expect(totals.cgstPaise + totals.sgstPaise).toBe(totals.totalGstPaise);
  });

  it('inter-state: IGST at the full rate, same grand total', () => {
    const intra = calculateQuoteTotals({ lines, treatment: TaxTreatment.CGST_SGST });
    const inter = calculateQuoteTotals({ lines, treatment: TaxTreatment.IGST });

    expect(fromPaise(inter.igstPaise)).toBe('579.60');
    expect(inter.cgstPaise).toBe(0);
    expect(inter.sgstPaise).toBe(0);
    // The customer pays the same either way — only the split differs.
    expect(inter.totalPaise).toBe(intra.totalPaise);
  });

  it('rounds the grand total to whole rupees and records the adjustment', () => {
    const totals = calculateQuoteTotals({ lines, treatment: TaxTreatment.IGST });

    // 3220.00 + 579.60 = 3799.60 -> 3800.00, round-off +0.40
    expect(fromPaise(totals.totalPaise)).toBe('3800.00');
    expect(fromPaise(totals.roundOffPaise)).toBe('0.40');

    // The printed lines plus tax plus round-off must equal the printed total.
    expect(totals.taxableAmountPaise + totals.totalGstPaise + totals.roundOffPaise).toBe(
      totals.totalPaise,
    );
  });

  it('splits an odd paise of GST without losing it', () => {
    const totals = calculateQuoteTotals({
      lines: [{ unitPricePaise: toPaise('100.05'), quantityMilli: 1000, gstRatePercent: 18 }],
      treatment: TaxTreatment.CGST_SGST,
    });
    expect(totals.cgstPaise + totals.sgstPaise).toBe(totals.totalGstPaise);
  });

  it('taxes freight at the highest rate on the document', () => {
    const totals = calculateQuoteTotals({
      lines: [{ unitPricePaise: toPaise('1000.00'), quantityMilli: 1000, gstRatePercent: 18 }],
      freightPaise: toPaise('250.00'),
      treatment: TaxTreatment.IGST,
    });

    expect(fromPaise(totals.taxableAmountPaise)).toBe('1250.00');
    expect(fromPaise(totals.igstPaise)).toBe('225.00');
  });

  it('charges no tax when exempt', () => {
    const totals = calculateQuoteTotals({ lines, treatment: TaxTreatment.EXEMPT });
    expect(totals.totalGstPaise).toBe(0);
    expect(fromPaise(totals.totalPaise)).toBe('3220.00');
  });
});
