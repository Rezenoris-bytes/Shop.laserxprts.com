/**
 * Money and Indian GST arithmetic.
 *
 * All arithmetic runs on integer paise. No floating point is used anywhere in
 * this file, because a quote that shows 1,24,999.99 in the admin panel and
 * 1,24,999.98 on the PDF is a commercial credibility problem — and IEEE-754
 * produces exactly that class of drift.
 *
 * This module is deliberately dependency-free so the frontend can render the
 * same totals the API computed, without shipping a decimal library or the
 * Prisma runtime.
 *
 * Rounding policy (fixed, and unit-tested):
 *   - Per line: half-up to 2 decimal places.
 *   - Header grand total: rounded to the nearest whole rupee.
 *   - `roundOff` on the header absorbs the difference, so the printed lines
 *     always add up to the printed total.
 */

import { TaxTreatment } from './enums';

// ── Primitives ──────────────────────────────────────────────────────────────

/** Parses a rupee amount ("1234.56", 1234.56) into integer paise. */
export function toPaise(amount: string | number): number {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) throw new RangeError('Amount must be finite');
    return roundHalfUp(amount * 100);
  }
  const trimmed = amount.trim();
  if (trimmed === '') return 0;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new RangeError(`Not a valid amount: ${amount}`);
  }
  const negative = trimmed.startsWith('-');
  const [whole = '0', fraction = ''] = trimmed.replace('-', '').split('.');
  // Take 3 decimals so we can round the third rather than truncate it.
  const padded = (fraction + '000').slice(0, 3);
  const paise = Number(whole) * 100 + Number(padded.slice(0, 2));
  const thirdDigit = Number(padded[2] ?? '0');
  const rounded = thirdDigit >= 5 ? paise + 1 : paise;
  return negative ? -rounded : rounded;
}

/** Formats integer paise as a plain decimal string, e.g. "1234.56". */
export function fromPaise(paise: number): string {
  const negative = paise < 0;
  const absolute = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${negative ? '-' : ''}${rupees}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Half-up rounding. Note that JavaScript's Math.round is half-*ceiling*, which
 * rounds -0.5 to -0 rather than -1 — wrong for credit notes.
 */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Formats paise for display, e.g. "₹1,24,999.99" using the Indian digit grouping. */
export function formatInr(paise: number, withSymbol = true): string {
  const negative = paise < 0;
  const absolute = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, '0');

  const digits = String(rupees);
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const lastThree = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
  }

  return `${negative ? '-' : ''}${withSymbol ? '₹' : ''}${grouped}.${remainder}`;
}

// ── Line and document calculation ───────────────────────────────────────────

export interface QuoteLineInput {
  /** Unit price in paise. */
  unitPricePaise: number;
  /** Quantity in thousandths, so 2.5 metres is 2500. */
  quantityMilli: number;
  /** Discount percentage, e.g. 7.5 for 7.5%. */
  discountPercent?: number;
  /** GST rate percentage, e.g. 18 for 18%. */
  gstRatePercent: number;
}

export interface QuoteLineResult {
  grossPaise: number;
  discountPaise: number;
  /** Taxable value of the line, after discount. */
  lineSubtotalPaise: number;
  gstAmountPaise: number;
  lineTotalPaise: number;
}

export function calculateLine(input: QuoteLineInput): QuoteLineResult {
  const { unitPricePaise, quantityMilli, discountPercent = 0, gstRatePercent } = input;

  const grossPaise = roundHalfUp((unitPricePaise * quantityMilli) / 1000);
  const discountPaise = roundHalfUp((grossPaise * discountPercent) / 100);
  const lineSubtotalPaise = grossPaise - discountPaise;
  const gstAmountPaise = roundHalfUp((lineSubtotalPaise * gstRatePercent) / 100);
  const lineTotalPaise = lineSubtotalPaise + gstAmountPaise;

  return { grossPaise, discountPaise, lineSubtotalPaise, gstAmountPaise, lineTotalPaise };
}

export interface QuoteTotalsInput {
  lines: QuoteLineInput[];
  /** Freight charged at header level, in paise. */
  freightPaise?: number;
  /** GST rate applied to freight. Defaults to the highest line rate present. */
  freightGstRatePercent?: number;
  treatment: TaxTreatment;
}

export interface QuoteTotalsResult {
  lines: QuoteLineResult[];
  subtotalPaise: number;
  discountPaise: number;
  freightPaise: number;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalGstPaise: number;
  /** Signed adjustment that makes the printed lines sum to the printed total. */
  roundOffPaise: number;
  totalPaise: number;
  treatment: TaxTreatment;
}

export function calculateQuoteTotals(input: QuoteTotalsInput): QuoteTotalsResult {
  const { lines, freightPaise = 0, treatment } = input;

  const lineResults = lines.map(calculateLine);

  const subtotalPaise = lineResults.reduce((sum, line) => sum + line.grossPaise, 0);
  const discountPaise = lineResults.reduce((sum, line) => sum + line.discountPaise, 0);
  const lineTaxablePaise = lineResults.reduce((sum, line) => sum + line.lineSubtotalPaise, 0);
  const lineGstPaise = lineResults.reduce((sum, line) => sum + line.gstAmountPaise, 0);

  // Freight attracts GST at the rate of the principal supply. Absent an explicit
  // rate we use the highest rate on the document, which is the conservative choice.
  const highestLineRate = lines.reduce((max, line) => Math.max(max, line.gstRatePercent), 0);
  const freightGstRate = input.freightGstRatePercent ?? highestLineRate;
  const freightGstPaise = roundHalfUp((freightPaise * freightGstRate) / 100);

  const taxableAmountPaise = lineTaxablePaise + freightPaise;
  const totalGstPaise = lineGstPaise + freightGstPaise;

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (treatment === TaxTreatment.CGST_SGST) {
    // Split half/half. The odd paise goes to CGST so the two always sum exactly.
    cgstPaise = Math.ceil(totalGstPaise / 2);
    sgstPaise = totalGstPaise - cgstPaise;
  } else if (treatment === TaxTreatment.IGST) {
    igstPaise = totalGstPaise;
  }
  // EXEMPT and ZERO_RATED leave all three at zero.

  const grandTotalRawPaise =
    treatment === TaxTreatment.EXEMPT || treatment === TaxTreatment.ZERO_RATED
      ? taxableAmountPaise
      : taxableAmountPaise + totalGstPaise;

  // Round the document total to the nearest whole rupee.
  const totalPaise = roundHalfUp(grandTotalRawPaise / 100) * 100;
  const roundOffPaise = totalPaise - grandTotalRawPaise;

  return {
    lines: lineResults,
    subtotalPaise,
    discountPaise,
    freightPaise,
    taxableAmountPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalGstPaise:
      treatment === TaxTreatment.EXEMPT || treatment === TaxTreatment.ZERO_RATED
        ? 0
        : totalGstPaise,
    roundOffPaise,
    totalPaise,
    treatment,
  };
}

/**
 * Decides the tax treatment from place of supply.
 *
 * Same state  -> CGST + SGST
 * Other state -> IGST
 * Unknown customer state -> IGST, because charging IGST when CGST+SGST was due
 * is correctable, while the reverse leaves the customer unable to claim credit.
 */
export function resolveTaxTreatment(
  supplierStateCode: string | null | undefined,
  customerStateCode: string | null | undefined,
): TaxTreatment {
  if (!supplierStateCode || !customerStateCode) return TaxTreatment.IGST;
  return supplierStateCode === customerStateCode ? TaxTreatment.CGST_SGST : TaxTreatment.IGST;
}
