import { describe, it, expect } from "vitest";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
  formatCurrency,
  CalculationError,
} from "./invoice-calculations";

describe("Invoice Calculations", () => {
  it("calculates the required interview test case ($99.00 grand total)", () => {
    // Quantity: 2
    // Unit price: $50.00
    // Subtotal: $100.00
    // Fixed discount: $10.00
    // Tax rate: 10%
    // Taxable amount: $90.00
    // Tax: $9.00
    // Grand total: $99.00
    const result = calculateInvoiceTotals({
      items: [
        {
          description: "Consulting Services",
          quantity: 2,
          unit_price: 50.0,
        },
      ],
      discount_amount: 10.0,
      tax_rate: 10,
    });

    expect(result.items[0].line_total).toBe(100.0);
    expect(result.subtotal).toBe(100.0);
    expect(result.discount_amount).toBe(10.0);
    expect(result.taxable_amount).toBe(90.0);
    expect(result.tax_rate).toBe(10.0);
    expect(result.tax_amount).toBe(9.0);
    expect(result.grand_total).toBe(99.0);
  });

  it("calculates multiple line items with proper two-decimal rounding", () => {
    // 3 items with fractional amounts:
    // Item 1: 3 * 33.335 = 100.005 -> 100.01
    // Item 2: 1.5 * 19.99 = 29.985 -> 29.99
    // Subtotal: 100.01 + 29.99 = 130.00
    const result = calculateInvoiceTotals({
      items: [
        { description: "Item 1", quantity: 3, unit_price: 33.335 },
        { description: "Item 2", quantity: 1.5, unit_price: 19.99 },
      ],
      discount_amount: 30,
      tax_rate: 8.25,
    });

    expect(result.items[0].line_total).toBe(100.01);
    expect(result.items[1].line_total).toBe(29.99);
    expect(result.subtotal).toBe(130.0);
    expect(result.discount_amount).toBe(30.0);
    expect(result.taxable_amount).toBe(100.0);
    // 100.00 * 0.0825 = 8.25
    expect(result.tax_amount).toBe(8.25);
    expect(result.grand_total).toBe(108.25);
  });

  it("handles empty items list gracefully", () => {
    const result = calculateInvoiceTotals({
      items: [],
      discount_amount: 0,
      tax_rate: 5,
    });

    expect(result.subtotal).toBe(0);
    expect(result.discount_amount).toBe(0);
    expect(result.taxable_amount).toBe(0);
    expect(result.tax_amount).toBe(0);
    expect(result.grand_total).toBe(0);
  });

  it("boundary test: discount equal to subtotal ($400 on $400) dynamically produces $0.00 grand total", () => {
    // Item 1: 2 × $50 = $100.00
    // Item 2: 3 × $100 = $300.00
    // Subtotal: $400.00
    // Fixed Discount: $400.00
    // Taxable Subtotal: $0.00
    // Tax Rate: 10%
    // Tax Amount: $0.00
    // Grand Total: $0.00
    const result = calculateInvoiceTotals({
      items: [
        { description: "Item 1", quantity: 2, unit_price: 50 },
        { description: "Item 2", quantity: 3, unit_price: 100 },
      ],
      discount_amount: 400,
      tax_rate: 10,
    });

    expect(result.items[0].line_total).toBe(100.0);
    expect(result.items[1].line_total).toBe(300.0);
    expect(result.subtotal).toBe(400.0);
    expect(result.discount_amount).toBe(400.0);
    expect(result.taxable_amount).toBe(0.0);
    expect(result.tax_rate).toBe(10.0);
    expect(result.tax_amount).toBe(0.0);
    expect(result.grand_total).toBe(0.0);
  });

  it("boundary test: discount exceeding subtotal ($402 on $400) throws CalculationError and never clamps", () => {
    expect(() =>
      calculateInvoiceTotals({
        items: [
          { description: "Item 1", quantity: 2, unit_price: 50 },
          { description: "Item 2", quantity: 3, unit_price: 100 },
        ],
        discount_amount: 402,
        tax_rate: 10,
      })
    ).toThrowError(/Discount \(\$402\.00\) cannot exceed subtotal \(\$400\.00\)/);
  });

  it("test 1: discount equal to subtotal ($500 subtotal, $500 discount, 12% tax) yields $0.00 grand total", () => {
    // Line 1: 2 × $50 = $100
    // Line 2: 4 × $100 = $400
    // Subtotal: $500.00
    // Fixed Discount: -$500.00
    // Taxable Subtotal: $0.00
    // Tax (12%): $0.00
    // Grand Total: $0.00
    const result = calculateInvoiceTotals({
      items: [
        { description: "Line Item 1", quantity: 2, unit_price: 50 },
        { description: "Line Item 2", quantity: 4, unit_price: 100 },
      ],
      discount_amount: 500,
      tax_rate: 12,
    });

    expect(result.subtotal).toBe(500.0);
    expect(result.discount_amount).toBe(500.0);
    expect(result.taxable_amount).toBe(0.0);
    expect(result.tax_rate).toBe(12.0);
    expect(result.tax_amount).toBe(0.0);
    expect(result.grand_total).toBe(0.0);
  });

  it("test 2: discount less than subtotal ($500 subtotal, $100 discount, 12% tax) yields $448.00 grand total", () => {
    // Subtotal: $500.00
    // Discount: -$100.00
    // Taxable: $400.00
    // Tax (12%): $48.00
    // Grand Total: $448.00
    const result = calculateInvoiceTotals({
      items: [
        { description: "Line Item 1", quantity: 2, unit_price: 50 },
        { description: "Line Item 2", quantity: 4, unit_price: 100 },
      ],
      discount_amount: 100,
      tax_rate: 12,
    });

    expect(result.subtotal).toBe(500.0);
    expect(result.discount_amount).toBe(100.0);
    expect(result.taxable_amount).toBe(400.0);
    expect(result.tax_rate).toBe(12.0);
    expect(result.tax_amount).toBe(48.0);
    expect(result.grand_total).toBe(448.0);
  });

  it("test 3: discount greater than subtotal ($500 subtotal, $501 discount, 12% tax) throws CalculationError", () => {
    expect(() =>
      calculateInvoiceTotals({
        items: [
          { description: "Line Item 1", quantity: 2, unit_price: 50 },
          { description: "Line Item 2", quantity: 4, unit_price: 100 },
        ],
        discount_amount: 501,
        tax_rate: 12,
      })
    ).toThrowError(/Discount \(\$501\.00\) cannot exceed subtotal \(\$500\.00\)/);
  });

  it("throws error when discount exceeds subtotal with custom amounts", () => {
    expect(() =>
      calculateInvoiceTotals({
        items: [{ description: "Item", quantity: 1, unit_price: 50 }],
        discount_amount: 60,
        tax_rate: 0,
      })
    ).toThrowError(CalculationError);
  });

  it("throws error on negative quantity", () => {
    expect(() =>
      calculateLineTotal(-2, 50)
    ).toThrowError("Quantity cannot be negative.");

    expect(() =>
      calculateInvoiceTotals({
        items: [{ description: "Item", quantity: -2, unit_price: 50 }],
      })
    ).toThrowError(CalculationError);
  });

  it("throws error on negative unit price", () => {
    expect(() =>
      calculateLineTotal(2, -50)
    ).toThrowError("Unit price cannot be negative.");

    expect(() =>
      calculateInvoiceTotals({
        items: [{ description: "Item", quantity: 2, unit_price: -50 }],
      })
    ).toThrowError(CalculationError);
  });

  it("throws error on negative discount", () => {
    expect(() =>
      calculateInvoiceTotals({
        items: [{ description: "Item", quantity: 2, unit_price: 50 }],
        discount_amount: -10,
      })
    ).toThrowError("Discount cannot be negative.");
  });

  it("throws error on negative tax rate", () => {
    expect(() =>
      calculateInvoiceTotals({
        items: [{ description: "Item", quantity: 2, unit_price: 50 }],
        tax_rate: -5,
      })
    ).toThrowError("Tax rate cannot be negative.");
  });

  it("formats currency correctly", () => {
    expect(formatCurrency(99)).toBe("$99.00");
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(null)).toBe("$0.00");
  });
});
