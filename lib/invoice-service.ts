import "server-only";
import { getSupabaseServer } from "./supabase-server";
import { InvoiceFormData, InvoiceFormSchema, CustomField } from "./schemas";
import { calculateInvoiceTotals, CalculatedInvoiceTotals } from "./invoice-calculations";

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  business_name: string;
  business_email: string | null;
  business_address: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  issue_date: string;
  due_date: string;
  notes: string | null;
  discount_amount: number;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  custom_fields: CustomField[];
  created_at: string;
  updated_at: string;
  items?: InvoiceItemRecord[];
  email_logs?: InvoiceEmailLogRecord[];
}

export interface InvoiceItemRecord {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  position: number;
}

export interface InvoiceEmailLogRecord {
  id: string;
  invoice_id: string | null;
  recipient_email: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export class InvoiceServiceError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "InvoiceServiceError";
    this.code = code;
  }
}

/**
 * Lists invoices with optional search query by customer name or invoice number.
 */
export async function listInvoices(searchQuery?: string): Promise<{
  invoices: InvoiceRecord[];
  isTableMissing?: boolean;
}> {
  const supabase = getSupabaseServer();
  let query = supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      business_name,
      business_email,
      business_address,
      customer_name,
      customer_email,
      customer_address,
      issue_date,
      due_date,
      notes,
      discount_amount,
      tax_rate,
      subtotal,
      tax_amount,
      grand_total,
      custom_fields,
      created_at,
      updated_at,
      invoice_email_logs (
        id,
        recipient_email,
        status,
        created_at
      )
    `
    )
    .order("created_at", { ascending: false });

  if (searchQuery && searchQuery.trim().length > 0) {
    const sanitized = searchQuery.trim().replace(/[%_]/g, "");
    query = query.or(
      `customer_name.ilike.%${sanitized}%,invoice_number.ilike.%${sanitized}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    // Check if table has not been created yet in Supabase
    if (error.code === "PGRST205" || error.message?.includes("schema cache") || error.code === "42P01") {
      return { invoices: [], isTableMissing: true };
    }
    throw new InvoiceServiceError(`Failed to fetch invoices: ${error.message}`, error.code);
  }

  const mapped: InvoiceRecord[] = (data || []).map((row: Record<string, unknown>) => ({
    ...(row as unknown as InvoiceRecord),
    custom_fields: Array.isArray(row.custom_fields)
      ? (row.custom_fields as CustomField[])
      : [],
    email_logs: (row.invoice_email_logs as InvoiceEmailLogRecord[]) || [],
  }));

  return { invoices: mapped, isTableMissing: false };
}

/**
 * Fetches a single invoice with all its line items and email delivery logs.
 */
export async function getInvoiceById(id: string): Promise<InvoiceRecord | null> {
  if (!id || typeof id !== "string") {
    throw new InvoiceServiceError("Invalid invoice ID provided.");
  }

  const supabase = getSupabaseServer();

  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (invoiceError) {
    if (invoiceError.code === "PGRST205" || invoiceError.code === "42P01") {
      return null;
    }
    throw new InvoiceServiceError(`Failed to fetch invoice: ${invoiceError.message}`, invoiceError.code);
  }

  if (!invoiceData) return null;

  // Fetch items ordered by position
  const { data: itemsData, error: itemsError } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("position", { ascending: true });

  if (itemsError) {
    throw new InvoiceServiceError(`Failed to fetch invoice items: ${itemsError.message}`, itemsError.code);
  }

  // Fetch email logs
  const { data: emailLogsData } = await supabase
    .from("invoice_email_logs")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  return {
    ...invoiceData,
    custom_fields: Array.isArray(invoiceData.custom_fields) ? invoiceData.custom_fields : [],
    items: itemsData || [],
    email_logs: emailLogsData || [],
  };
}

/**
 * Fetches email dispatch history logs for a specific invoice.
 */
export async function getInvoiceEmailLogs(invoiceId: string): Promise<InvoiceEmailLogRecord[]> {
  if (!invoiceId) return [];
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("invoice_email_logs")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }
  return (data as InvoiceEmailLogRecord[]) || [];
}

/**
 * Saves (creates or updates) an invoice.
 * Recalculates all line totals, subtotals, tax and grand totals server-side using Decimal math.
 * Uses atomic RPC if available, or a transactional rollback approach.
 */
export async function saveInvoice(rawInput: InvoiceFormData): Promise<{ id: string }> {
  // 1. Zod Server-side Validation
  const validated = InvoiceFormSchema.parse(rawInput);

  // 2. Strict Server-side Recalculation (NEVER TRUST CLIENT TOTALS)
  const calculated: CalculatedInvoiceTotals = calculateInvoiceTotals({
    items: validated.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      position: it.position,
    })),
    discount_amount: validated.discount_amount,
    tax_rate: validated.tax_rate,
  });

  const supabase = getSupabaseServer();

  // 3. Concurrency-Safe Invoice Number Assignment
  let finalInvoiceNumber = validated.invoice_number;
  if (!validated.id) {
    // Brand new invoice: if invoice_number is missing or already taken, auto-assign next number
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("invoice_number", finalInvoiceNumber)
      .maybeSingle();

    if (existing || !finalInvoiceNumber) {
      finalInvoiceNumber = await generateNextInvoiceNumber();
    }
  } else {
    // Editing existing invoice: strictly preserve the original invoice number
    const { data: existingRecord } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("id", validated.id)
      .maybeSingle();

    if (existingRecord?.invoice_number) {
      finalInvoiceNumber = existingRecord.invoice_number;
    }
  }

  // Prepare invoice payload
  const invoicePayload = {
    ...(validated.id ? { id: validated.id } : {}),
    invoice_number: finalInvoiceNumber,
    business_name: validated.business_name,
    business_email: validated.business_email || null,
    business_address: validated.business_address || null,
    customer_name: validated.customer_name,
    customer_email: validated.customer_email || null,
    customer_address: validated.customer_address || null,
    issue_date: validated.issue_date,
    due_date: validated.due_date,
    notes: validated.notes || null,
    discount_amount: calculated.discount_amount,
    tax_rate: calculated.tax_rate,
    subtotal: calculated.subtotal,
    tax_amount: calculated.tax_amount,
    grand_total: calculated.grand_total,
    custom_fields: validated.custom_fields || [],
  };

  const itemsPayload = calculated.items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    position: item.position ?? index,
  }));

  // Try calling the atomic RPC first
  const { data: rpcInvoiceId, error: rpcError } = await supabase.rpc(
    "upsert_invoice_with_items",
    {
      p_invoice: invoicePayload,
      p_items: itemsPayload,
    }
  );

  if (!rpcError && rpcInvoiceId) {
    return { id: rpcInvoiceId };
  }

  // Handle missing tables / unapplied migrations cleanly
  if (
    rpcError &&
    (rpcError.code === "PGRST205" ||
      rpcError.code === "42P01" ||
      rpcError.message?.includes("schema cache"))
  ) {
    throw new InvoiceServiceError(
      "Supabase database tables are not migrated yet. Please apply migrations (run 'npx supabase db push') to persist invoices.",
      "MIGRATION_REQUIRED"
    );
  }

  // Fallback: If RPC does not exist yet in DB, perform standard sequenced insert/update
  if (
    rpcError &&
    (rpcError.code === "42883" ||
      rpcError.message?.includes("function") ||
      rpcError.code === "PGRST202")
  ) {
    if (validated.id) {
      // Update invoice
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          ...invoicePayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", validated.id);

      if (updateError) {
        if (updateError.code === "23505") {
          throw new InvoiceServiceError(`Invoice number "${validated.invoice_number}" already exists.`, "23505");
        }
        if (updateError.code === "PGRST205" || updateError.code === "42P01") {
          throw new InvoiceServiceError(
            "Supabase database tables are not migrated yet. Please apply migrations to persist invoices.",
            "MIGRATION_REQUIRED"
          );
        }
        throw new InvoiceServiceError(updateError.message, updateError.code);
      }

      // Overwrite items
      await supabase.from("invoice_items").delete().eq("invoice_id", validated.id);
      const itemsToInsert = itemsPayload.map((it) => ({
        ...it,
        invoice_id: validated.id,
      }));

      const { error: itemsInsertError } = await supabase.from("invoice_items").insert(itemsToInsert);
      if (itemsInsertError) {
        throw new InvoiceServiceError(`Failed to save items: ${itemsInsertError.message}`, itemsInsertError.code);
      }

      return { id: validated.id };
    } else {
      // Insert new invoice
      const { data: inserted, error: insertError } = await supabase
        .from("invoices")
        .insert(invoicePayload)
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          throw new InvoiceServiceError(`Invoice number "${validated.invoice_number}" already exists.`, "23505");
        }
        if (insertError.code === "PGRST205" || insertError.code === "42P01") {
          throw new InvoiceServiceError(
            "Supabase database tables are not migrated yet. Please apply migrations to persist invoices.",
            "MIGRATION_REQUIRED"
          );
        }
        throw new InvoiceServiceError(insertError.message, insertError.code);
      }

      const invoiceId = inserted.id;
      const itemsToInsert = itemsPayload.map((it) => ({
        ...it,
        invoice_id: invoiceId,
      }));

      const { error: itemsInsertError } = await supabase.from("invoice_items").insert(itemsToInsert);
      if (itemsInsertError) {
        // Rollback created invoice to prevent partial invoice without items
        await supabase.from("invoices").delete().eq("id", invoiceId);
        throw new InvoiceServiceError(`Failed to save invoice items: ${itemsInsertError.message}`, itemsInsertError.code);
      }

      return { id: invoiceId };
    }
  }

  // Handle unique constraint violation on invoice_number
  if (rpcError?.code === "23505") {
    throw new InvoiceServiceError(`Invoice number "${validated.invoice_number}" already exists.`, "23505");
  }

  throw new InvoiceServiceError(rpcError?.message || "Failed to persist invoice", rpcError?.code);
}

/**
 * Deletes an invoice and its cascading items.
 */
export async function deleteInvoice(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") {
    throw new InvoiceServiceError("Invalid invoice ID.");
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("invoices").delete().eq("id", id);

  if (error) {
    throw new InvoiceServiceError(`Failed to delete invoice: ${error.message}`, error.code);
  }

  return true;
}

/**
 * Generates the next sequential invoice number format: INV-YYYY-XXXX
 */
export async function generateNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_number")
      .ilike("invoice_number", `${prefix}%`);

    if (error || !data || data.length === 0) {
      return `${prefix}0001`;
    }

    let maxSeq = 0;
    const regex = new RegExp(`^INV-${currentYear}-(\\d+)$`, "i");

    for (const row of data) {
      const match = (row.invoice_number || "").match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  } catch {
    return `${prefix}0001`;
  }
}
