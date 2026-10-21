import { z } from "zod";

export const CustomFieldSchema = z.object({
  id: z.string().min(1, "Field ID is required"),
  label: z
    .string()
    .trim()
    .min(1, "Field label cannot be empty")
    .max(80, "Label cannot exceed 80 characters"),
  value: z
    .string()
    .trim()
    .min(1, "Field value cannot be empty")
    .max(300, "Value cannot exceed 300 characters"),
  isVisible: z.boolean().default(true),
});

export type CustomField = z.infer<typeof CustomFieldSchema>;

export const InvoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z
    .string()
    .trim()
    .min(1, "Item description is required")
    .max(500, "Description cannot exceed 500 characters"),
  quantity: z.coerce
    .number({ message: "Quantity must be a valid number" })
    .min(0.0001, "Quantity must be greater than zero"),
  unit_price: z.coerce
    .number({ message: "Unit price must be a valid number" })
    .min(0, "Unit price cannot be negative"),
  line_total: z.coerce.number().optional(),
  position: z.number().int().optional().default(0),
});

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const InvoiceFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    invoice_number: z
      .string()
      .trim()
      .min(1, "Invoice number is required")
      .max(50, "Invoice number cannot exceed 50 characters")
      .regex(/^[a-zA-Z0-9_\-\.\/]+$/, "Invoice number can only contain letters, numbers, hyphens, dots, or slashes"),
    business_name: z
      .string()
      .trim()
      .min(1, "Business name is required")
      .max(120, "Business name cannot exceed 120 characters"),
    business_email: z
      .string()
      .trim()
      .email("Invalid business email address")
      .or(z.literal(""))
      .optional(),
    business_address: z
      .string()
      .trim()
      .max(500, "Business address cannot exceed 500 characters")
      .optional()
      .default(""),
    customer_name: z
      .string()
      .trim()
      .min(1, "Customer name is required")
      .max(120, "Customer name cannot exceed 120 characters"),
    customer_email: z
      .string()
      .trim()
      .email("Invalid customer email address")
      .or(z.literal(""))
      .optional(),
    customer_address: z
      .string()
      .trim()
      .max(500, "Customer address cannot exceed 500 characters")
      .optional()
      .default(""),
    issue_date: z
      .string()
      .regex(dateRegex, "Issue date must be in YYYY-MM-DD format"),
    due_date: z
      .string()
      .regex(dateRegex, "Due date must be in YYYY-MM-DD format"),
    notes: z
      .string()
      .trim()
      .max(2000, "Notes cannot exceed 2000 characters")
      .optional()
      .default(""),
    discount_amount: z.coerce
      .number({ message: "Discount must be a valid number" })
      .min(0, "Discount cannot be negative")
      .default(0),
    tax_rate: z.coerce
      .number({ message: "Tax rate must be a valid number" })
      .min(0, "Tax rate cannot be negative")
      .max(100, "Tax rate cannot exceed 100%")
      .default(0),
    items: z
      .array(InvoiceItemSchema)
      .min(1, "At least one line item is required"),
    custom_fields: z
      .array(CustomFieldSchema)
      .default([]),
  })
  .refine(
    (data) => {
      if (!data.issue_date || !data.due_date) return true;
      return data.due_date >= data.issue_date;
    },
    {
      message: "Due date cannot be earlier than issue date",
      path: ["due_date"],
    }
  )
  .refine(
    (data) => {
      const subtotal = (data.items || []).reduce((acc, item) => {
        const q = Number(item.quantity) || 0;
        const p = Number(item.unit_price) || 0;
        return acc + Math.round(q * p * 100) / 100;
      }, 0);
      return (Number(data.discount_amount) || 0) <= subtotal;
    },
    {
      message: "Discount cannot exceed the subtotal amount",
      path: ["discount_amount"],
    }
  );

export type InvoiceFormData = z.infer<typeof InvoiceFormSchema>;

export const SendInvoiceEmailSchema = z
  .object({
    recipient_email: z
      .string()
      .trim()
      .email("Invalid recipient email address")
      .optional()
      .or(z.literal("")),
    recipients: z
      .array(z.string().trim().email("Invalid recipient email address"))
      .optional(),
    subject: z
      .string()
      .trim()
      .max(150, "Subject cannot exceed 150 characters")
      .optional(),
    message: z
      .string()
      .trim()
      .max(2000, "Message cannot exceed 2000 characters")
      .optional(),
  })
  .refine(
    (data) => {
      const hasList = Array.isArray(data.recipients) && data.recipients.length > 0;
      const hasSingle = typeof data.recipient_email === "string" && data.recipient_email.trim().length > 0;
      return hasList || hasSingle;
    },
    {
      message: "At least one recipient email address is required.",
      path: ["recipients"],
    }
  );

export type SendInvoiceEmailData = z.infer<typeof SendInvoiceEmailSchema>;

export function invoiceRecordToFormData(invoice: {
  id: string;
  invoice_number: string;
  business_name: string;
  business_email?: string | null;
  business_address?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_address?: string | null;
  issue_date: string;
  due_date: string;
  notes?: string | null;
  discount_amount: number;
  tax_rate: number;
  items?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    line_total?: number;
    position?: number;
  }>;
  custom_fields?: CustomField[];
}): InvoiceFormData {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    business_name: invoice.business_name,
    business_email: invoice.business_email || "",
    business_address: invoice.business_address || "",
    customer_name: invoice.customer_name,
    customer_email: invoice.customer_email || "",
    customer_address: invoice.customer_address || "",
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    notes: invoice.notes || "",
    discount_amount: Number(invoice.discount_amount) || 0,
    tax_rate: Number(invoice.tax_rate) || 0,
    items: (invoice.items || []).map((it, idx) => ({
      id: it.id,
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      line_total: it.line_total,
      position: typeof it.position === "number" ? it.position : idx,
    })),
    custom_fields: Array.isArray(invoice.custom_fields) ? invoice.custom_fields : [],
  };
}
