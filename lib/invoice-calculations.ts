import Decimal from "decimal.js";

// Configure Decimal.js with banking / standard commercial rounding (HALF_UP)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface InvoiceItemInput {
  description: string;
  quantity: number | string;
  unit_price: number | string;
  position?: number;
}

export interface CalculatedInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  position: number;
}

export interface InvoiceTotalsInput {
  items: InvoiceItemInput[];
  discount_amount?: number | string;
  tax_rate?: number | string;
}

export interface CalculatedInvoiceTotals {
  items: CalculatedInvoiceItem[];
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  isInvalid?: boolean;
  errorMessage?: string;
}

export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculationError";
  }
}

/**
 * Safely parse a numeric value to a positive Decimal.
 */
function toValidDecimal(value: number | string | undefined | null, fieldName: string): Decimal {
  if (value === undefined || value === null || value === "") {
    return new Decimal(0);
  }

  try {
    const d = new Decimal(value);
    if (d.isNaN()) {
      throw new CalculationError(`Invalid numeric value for ${fieldName}: "${value}"`);
    }
    return d;
  } catch (err: unknown) {
    if (err instanceof CalculationError) throw err;
    throw new CalculationError(`Invalid numeric format for ${fieldName}: "${value}"`);
  }
}

/**
 * Rounds a Decimal to 2 decimal places using HALF_UP rounding.
 */
export function roundToTwoDecimals(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Calculates a single line item total: round2(quantity * unit_price).
 */
export function calculateLineTotal(quantity: number | string, unitPrice: number | string): number {
  const qty = toValidDecimal(quantity, "quantity");
  const price = toValidDecimal(unitPrice, "unit price");

  if (qty.isNegative()) {
    throw new CalculationError("Quantity cannot be negative.");
  }
  if (price.isNegative()) {
    throw new CalculationError("Unit price cannot be negative.");
  }

  return roundToTwoDecimals(qty.times(price)).toNumber();
}

/**
 * Performs all financial calculations for an invoice adhering to strict accounting rules:
 * 1. Each line total = round2(quantity * unit_price)
 * 2. Subtotal = sum of line totals
 * 3. Discount cannot be negative and cannot exceed subtotal
 * 4. Tax rate cannot be negative
 * 5. Taxable amount = subtotal - discount
 * 6. Tax amount = round2(taxable amount * (tax_rate / 100))
 * 7. Grand total = subtotal - discount + tax amount
 */
export function calculateInvoiceTotals(input: InvoiceTotalsInput): CalculatedInvoiceTotals {
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const discountDec = toValidDecimal(input.discount_amount, "discount amount");
  const taxRateDec = toValidDecimal(input.tax_rate, "tax rate");

  if (discountDec.isNegative()) {
    throw new CalculationError("Discount cannot be negative.");
  }
  if (taxRateDec.isNegative()) {
    throw new CalculationError("Tax rate cannot be negative.");
  }
  if (taxRateDec.greaterThan(100)) {
    throw new CalculationError("Tax rate cannot exceed 100%.");
  }

  let subtotalDec = new Decimal(0);
  const calculatedItems: CalculatedInvoiceItem[] = [];

  rawItems.forEach((item, index) => {
    const qty = toValidDecimal(item.quantity, `Item ${index + 1} quantity`);
    const price = toValidDecimal(item.unit_price, `Item ${index + 1} unit price`);

    if (qty.isNegative()) {
      throw new CalculationError(`Item ${index + 1} quantity cannot be negative.`);
    }
    if (price.isNegative()) {
      throw new CalculationError(`Item ${index + 1} unit price cannot be negative.`);
    }

    const lineTotalDec = roundToTwoDecimals(qty.times(price));
    subtotalDec = subtotalDec.plus(lineTotalDec);

    calculatedItems.push({
      description: item.description?.trim() || "",
      quantity: qty.toNumber(),
      unit_price: roundToTwoDecimals(price).toNumber(),
      line_total: lineTotalDec.toNumber(),
      position: typeof item.position === "number" ? item.position : index,
    });
  });

  const subtotalRounded = roundToTwoDecimals(subtotalDec);
  const discountRounded = roundToTwoDecimals(discountDec);

  if (discountRounded.greaterThan(subtotalRounded)) {
    throw new CalculationError(
      `Discount ($${discountRounded.toFixed(2)}) cannot exceed subtotal ($${subtotalRounded.toFixed(2)}).`
    );
  }

  const taxableAmountDec = subtotalRounded.minus(discountRounded);
  const taxAmountDec = roundToTwoDecimals(taxableAmountDec.times(taxRateDec.dividedBy(100)));
  const grandTotalDec = roundToTwoDecimals(taxableAmountDec.plus(taxAmountDec));

  return {
    items: calculatedItems,
    subtotal: subtotalRounded.toNumber(),
    discount_amount: discountRounded.toNumber(),
    taxable_amount: taxableAmountDec.toNumber(),
    tax_rate: taxRateDec.toNumber(),
    tax_amount: taxAmountDec.toNumber(),
    grand_total: grandTotalDec.toNumber(),
  };
}

/**
 * Format a number as USD currency: e.g. 99 -> "$99.00"
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === "") {
    return "$0.00";
  }
  const num = typeof amount === "number" ? amount : Number(amount);
  if (isNaN(num)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
