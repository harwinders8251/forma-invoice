"use server";

import { revalidatePath } from "next/cache";
import {
  saveInvoice,
  deleteInvoice,
  generateNextInvoiceNumber,
  getInvoiceById,
  InvoiceRecord,
} from "@/lib/invoice-service";
import { InvoiceFormData } from "@/lib/schemas";
import { ZodError } from "zod";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function saveInvoiceAction(
  formData: InvoiceFormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const result = await saveInvoice(formData);
    revalidatePath("/invoices");
    revalidatePath("/invoices", "page");
    revalidatePath("/invoices", "layout");
    revalidatePath(`/invoices/${result.id}`);
    revalidatePath(`/invoices/${result.id}`, "page");
    return { success: true, data: result };
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      err.issues.forEach((issue) => {
        const path = issue.path.join(".");
        fieldErrors[path] = issue.message;
      });
      return {
        success: false,
        error: "Validation failed. Please review the highlighted fields.",
        fieldErrors,
      };
    }

    const message = err instanceof Error ? err.message : "An unexpected error occurred while saving the invoice.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult> {
  try {
    await deleteInvoice(id);
    revalidatePath("/invoices");
    revalidatePath("/invoices", "page");
    revalidatePath("/invoices", "layout");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete the invoice.";
    return { success: false, error: message };
  }
}

export async function getNextInvoiceNumberAction(): Promise<ActionResult<string>> {
  try {
    const nextNumber = await generateNextInvoiceNumber();
    return { success: true, data: nextNumber };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate invoice number.";
    return { success: false, error: message };
  }
}

export async function getInvoiceAction(id: string): Promise<ActionResult<InvoiceRecord>> {
  try {
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid invoice ID provided." };
    }
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return {
        success: false,
        error: "The requested invoice could not be found or may have been deleted.",
      };
    }
    return { success: true, data: invoice };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load the requested invoice.";
    return { success: false, error: message };
  }
}
