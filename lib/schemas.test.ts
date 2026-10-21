import { describe, it, expect } from "vitest";
import { InvoiceFormSchema, CustomFieldSchema, SendInvoiceEmailSchema } from "./schemas";

describe("InvoiceFormSchema Validation", () => {
  const validInvoice = {
    invoice_number: "INV-2026-001",
    business_name: "Acme Corp",
    business_email: "billing@acme.com",
    business_address: "123 Business Way, New York, NY",
    customer_name: "Globex International",
    customer_email: "ap@globex.com",
    customer_address: "456 Corporate Blvd, Metropolis",
    issue_date: "2026-10-21",
    due_date: "2026-11-20",
    notes: "Payment due within 30 days.",
    discount_amount: 10,
    tax_rate: 8.5,
    items: [
      {
        description: "Software Architecture Consulting",
        quantity: 10,
        unit_price: 150,
      },
    ],
    custom_fields: [
      {
        id: "fld-1",
        label: "PO Number",
        value: "PO-9921",
        isVisible: true,
      },
    ],
  };

  it("validates a complete, valid invoice form", () => {
    const parsed = InvoiceFormSchema.safeParse(validInvoice);
    expect(parsed.success).toBe(true);
  });

  it("rejects due date earlier than issue date", () => {
    const invalid = {
      ...validInvoice,
      issue_date: "2026-10-21",
      due_date: "2026-10-10",
    };
    const parsed = InvoiceFormSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("Due date cannot be earlier than issue date");
    }
  });

  it("rejects empty invoice number", () => {
    const invalid = { ...validInvoice, invoice_number: "" };
    const parsed = InvoiceFormSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects zero items", () => {
    const invalid = { ...validInvoice, items: [] };
    const parsed = InvoiceFormSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("At least one line item is required");
    }
  });

  it("rejects negative quantity or price in items", () => {
    const invalidQty = {
      ...validInvoice,
      items: [{ description: "Item", quantity: -1, unit_price: 50 }],
    };
    expect(InvoiceFormSchema.safeParse(invalidQty).success).toBe(false);

    const invalidPrice = {
      ...validInvoice,
      items: [{ description: "Item", quantity: 1, unit_price: -50 }],
    };
    expect(InvoiceFormSchema.safeParse(invalidPrice).success).toBe(false);
  });

  it("rejects invalid emails", () => {
    const invalid = { ...validInvoice, customer_email: "not-an-email" };
    const parsed = InvoiceFormSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("accepts discount equal to subtotal ($400 discount on $400 subtotal)", () => {
    const boundaryDiscount = {
      ...validInvoice,
      items: [
        { description: "Item 1", quantity: 2, unit_price: 50 },
        { description: "Item 2", quantity: 3, unit_price: 100 },
      ],
      discount_amount: 400,
    };
    const parsed = InvoiceFormSchema.safeParse(boundaryDiscount);
    expect(parsed.success).toBe(true);
  });

  it("rejects discount exceeding subtotal ($402 discount on $400 subtotal)", () => {
    const invalidDiscount = {
      ...validInvoice,
      items: [
        { description: "Item 1", quantity: 2, unit_price: 50 },
        { description: "Item 2", quantity: 3, unit_price: 100 },
      ],
      discount_amount: 402,
    };
    const parsed = InvoiceFormSchema.safeParse(invalidDiscount);
    expect(parsed.success).toBe(false);
  });

  it("rejects negative discount or negative tax rate", () => {
    const negDiscount = { ...validInvoice, discount_amount: -10 };
    expect(InvoiceFormSchema.safeParse(negDiscount).success).toBe(false);

    const negTax = { ...validInvoice, tax_rate: -5 };
    expect(InvoiceFormSchema.safeParse(negTax).success).toBe(false);
  });

  it("validates custom fields correctly", () => {
    expect(
      CustomFieldSchema.safeParse({
        id: "1",
        label: "Project Code",
        value: "PRJ-Alpha",
        isVisible: true,
      }).success
    ).toBe(true);

    expect(
      CustomFieldSchema.safeParse({
        id: "1",
        label: "",
        value: "Val",
        isVisible: true,
      }).success
    ).toBe(false);
  });
});

describe("SendInvoiceEmailSchema Validation", () => {
  it("accepts a valid single recipient_email", () => {
    const res = SendInvoiceEmailSchema.safeParse({
      recipient_email: "accounts@starlight.io",
      subject: "Invoice INV-2026-0007",
    });
    expect(res.success).toBe(true);
  });

  it("accepts multiple valid recipients in an array", () => {
    const res = SendInvoiceEmailSchema.safeParse({
      recipients: ["accounts@starlight.io", "finance@starlight.io", "manager@starlight.io"],
      subject: "Invoice INV-2026-0007",
      message: "Please find attached your invoice.",
    });
    expect(res.success).toBe(true);
  });

  it("rejects an invalid email address inside recipients list", () => {
    const res = SendInvoiceEmailSchema.safeParse({
      recipients: ["valid@company.com", "not-a-valid-email"],
    });
    expect(res.success).toBe(false);
  });

  it("rejects when both recipient_email and recipients are empty", () => {
    const res = SendInvoiceEmailSchema.safeParse({
      recipient_email: "",
      recipients: [],
    });
    expect(res.success).toBe(false);
  });

  it("rejects subject exceeding 150 characters", () => {
    const res = SendInvoiceEmailSchema.safeParse({
      recipients: ["test@example.com"],
      subject: "A".repeat(151),
    });
    expect(res.success).toBe(false);
  });

  it("rejects message exceeding 2000 characters", () => {
    const res = SendInvoiceEmailSchema.safeParse({
      recipients: ["test@example.com"],
      message: "A".repeat(2001),
    });
    expect(res.success).toBe(false);
  });
});
